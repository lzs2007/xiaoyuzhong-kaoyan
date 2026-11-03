#!/usr/bin/env python3
"""Fetch official catalogs and stage evidence for review; never publish eligibility automatically."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

MANIFEST = Path(__file__).resolve().parents[1] / 'docs/.vitepress/data/catalogSources.json'
CODE = re.compile(r'(?<!\d)202(?!\d)')


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
        if tag in ('tr', 'p', 'div', 'br', 'h1', 'h2', 'h3'):
            self.parts.append('\n')
        if tag in ('td', 'th'):
            self.parts.append(' | ')

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def extract(data, kind):
    if kind == 'html':
        parser = VisibleText()
        parser.feed(data.decode('utf-8-sig'))
        return ''.join(parser.parts)
    if kind == 'pdf':
        if not data.startswith(b'%PDF'):
            raise ValueError('返回内容不是PDF，可能为验证码或错误页；请人工检查官方入口')
        import fitz
        with fitz.open(stream=data, filetype='pdf') as doc:
            return '\n'.join(f'\n[PDF第{i + 1}页]\n' + page.get_text() for i, page in enumerate(doc))
    if kind == 'xls':
        import xlrd
        book = xlrd.open_workbook(file_contents=data, formatting_info=True)
        parts = []
        for sheet in book.sheets():
            merged = {}
            for r1, r2, c1, c2 in sheet.merged_cells:
                for row in range(r1, r2):
                    for col in range(c1, c2):
                        merged[row, col] = sheet.cell_value(r1, c1)
            for row in range(sheet.nrows):
                values = [str(merged.get((row, col), sheet.cell_value(row, col))).replace('\n', '') for col in range(sheet.ncols)]
                parts.append(f'[{sheet.name}第{row + 1}行] ' + ' | '.join(values))
        return '\n'.join(parts)
    if kind == 'xlsx':
        from openpyxl import load_workbook
        book = load_workbook(BytesIO(data), data_only=True)
        return '\n'.join(f'[{sheet.title}第{i}行] ' + ' | '.join(str(value or '') for value in row) for sheet in book for i, row in enumerate(sheet.values, 1))
    if kind == 'image':
        if not (data.startswith(b'\x89PNG') or data.startswith(b'\xff\xd8')):
            raise ValueError('返回内容不是可识别的目录图片')
        return ''
    raise ValueError(f'不支持的文件格式：{kind}')


def collect(source, output):
    report = { 'sourceId': source['id'], 'university': source['university'], 'year': source['year'],
               'url': source['assetUrl'], 'fetchedAt': datetime.now(timezone.utc).isoformat(),
               'verification': 'pending', 'candidates': [] }
    directory = output / source['id']
    directory.mkdir(parents=True, exist_ok=True)
    try:
        request = Request(source['assetUrl'], headers={'User-Agent': 'XiaoyuzhongCatalogCollector/1.0', 'Accept': '*/*'})
        with urlopen(request, timeout=30) as response:
            data = response.read(32 * 1024 * 1024 + 1)
            if len(data) > 32 * 1024 * 1024:
                raise ValueError('目录超过32MiB上限，请人工处理')
            report['resolvedUrl'] = response.url
        digest = sha256(data).hexdigest()
        report.update(sha256=digest, matchesReviewedFingerprint=digest == source['sha256'], bytes=len(data))
        extension = 'png' if source['format'] == 'image' and data.startswith(b'\x89PNG') else source['format']
        (directory / f'original.{extension}').write_bytes(data)
        text = extract(data, source['format'])
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        for index, line in enumerate(lines):
            if CODE.search(line):
                report['candidates'].append({'textLine': index + 1, 'context': '\n'.join(lines[max(0, index-5):index+6]), 'verification': 'pending'})
        if text:
            (directory / 'extracted.txt').write_text(text, encoding='utf-8')
        report['status'] = 'manual_image_review' if source['format'] == 'image' else 'fetched_for_review'
        report['note'] = '候选中的202可能为院系编号；年度、专业、方向、考试方式和外国语列必须复核。零候选不代表不可报考。'
    except Exception as error:
        report.update(status='error', error=f'{type(error).__name__}: {error}')
    (directory / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', action='append', help='manifest source id; repeat to collect multiple sources')
    parser.add_argument('--output', type=Path, default=Path('.cache/catalog-collection'))
    parser.add_argument('--list', action='store_true')
    args = parser.parse_args()
    sources = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if args.list:
        for source in sources:
            print(source['id'], source['university'], source['year'], source['format'])
        return 0
    unknown = set(args.source or []) - {source['id'] for source in sources}
    if unknown:
        parser.error('未知来源：' + ', '.join(sorted(unknown)))
    selected = [source for source in sources if not args.source or source['id'] in args.source]
    args.output.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        reports = list(pool.map(lambda source: collect(source, args.output), selected))
    index = [{key: report.get(key) for key in ('sourceId', 'status', 'verification', 'sha256', 'matchesReviewedFingerprint', 'error')} | {'candidateCount': len(report['candidates'])} for report in reports]
    (args.output / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    for report in index:
        print(json.dumps(report, ensure_ascii=False))
    return 1 if any(report['status'] == 'error' for report in reports) else 0


if __name__ == '__main__':
    raise SystemExit(main())
