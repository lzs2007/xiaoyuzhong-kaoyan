"""Repeatable sharing flow checks. Requires Node 22+, Python Playwright and Chromium.
Build and preview first, then: python3 tests/browser-sharing.py --base http://localhost:4173/xiaoyuzhong-kaoyan/
Uses isolated browser contexts; never changes a real browser's stored shortlist.
"""
from pathlib import Path
from urllib.parse import urlencode, urlsplit, parse_qs
import argparse
import csv
import io
import json
import subprocess
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--base', default='http://localhost:4173/xiaoyuzhong-kaoyan/')
args = parser.parse_args()
BASE = args.base.rstrip('/') + '/schools/find'
REPO = Path(__file__).resolve().parents[1]
fixture = json.loads(subprocess.check_output(['node', '--experimental-strip-types', '--input-type=module', '-e', '''
import { defaults, filterMajors, searchMajors } from './docs/.vitepress/data/majorSearch.ts';
import { makeComparison } from './docs/.vitepress/data/majorComparison.ts';
const a=filterMajors(searchMajors,{...defaults,school:'heu',topic:'instrument'}).find(e=>e.code==='080400');
const items=[makeComparison(a,{language:'202',mode:'全日制'}),makeComparison(a,{language:'203',mode:'全日制'})];
const baseline=filterMajors(searchMajors,defaults).filter(e=>e.id!==a.id).slice(0,5).map(e=>makeComparison(e,defaults));
const old=makeComparison(filterMajors(searchMajors,{...defaults,year:'2026'})[0],defaults);
console.log(JSON.stringify({items,baseline,old}));
'''], cwd=REPO, text=True))
ITEMS, LOCAL, OLD = fixture['items'], fixture['baseline'], fixture['old']
KEY = 'major-comparison-v1'
MODES = {'': 'a', '全日制': 'f', '非全日制': 'p', '待核实': 'u'}
OUT = REPO / '.cache/browser-sharing'
OUT.mkdir(parents=True, exist_ok=True)
errors = []


def wire(items):
    return 'v1' + ('~' + ','.join(':'.join([i['id'], i['year'], i['language'], MODES[i['mode']]]) for i in items) if items else '')


def link(items, **params):
    return BASE + '?' + urlencode({'region': 'northeast', 'topic': 'instrument', 'compare': wire(items), **params})


def monitor(page):
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', lambda r: errors.append(f'HTTP {r.status}: {r.url}') if r.status >= 400 else None)


def visit(page, url):
    page.goto(url, wait_until='networkidle')


def seed(page, items):
    page.evaluate('(x)=>localStorage.setItem(x.key,JSON.stringify({version:1,items:x.items}))', {'key': KEY, 'items': items})


def stored(page):
    return page.evaluate('(key)=>{const raw=localStorage.getItem(key);return raw?JSON.parse(raw).items:null}', KEY)


def panel(page):
    return page.get_by_role('region', name='选校对比', exact=True)


def preview(page, count):
    expect(panel(page)).to_contain_text(f'分享预览（{count}/4）')


def copy_result(page, compare=True):
    page.evaluate('window.__copied = null')
    page.get_by_role('button', name='复制对比链接' if compare else '复制筛选链接', exact=True).click()
    page.wait_for_function('window.__copied !== null')
    result = page.evaluate('window.__copied')
    page.get_by_role('button', name='关闭分享提示', exact=True).click()
    return result


def csv_download(page):
    with page.expect_download() as d:
        panel(page).get_by_role('button', name='导出对比 CSV', exact=True).click()
    return list(csv.DictReader(io.StringIO(Path(d.value.path()).read_text(encoding='utf-8-sig'))))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    context.add_init_script('''
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(value)=>{window.__copied=value}}});
const originalSet=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){if(key==='major-comparison-v1') window.__writes=(window.__writes||0)+1;return originalSet.call(this,key,value)};
''')
    page = context.new_page()
    monitor(page)
    visit(page, BASE)
    expect(page.locator('.result-row')).to_have_count(226)
    # Legacy autosave remains intact with no compare parameter.
    page.locator('.result-row').first.get_by_role('button', name='加入对比', exact=False).click()
    assert len(stored(page)) == 1
    page.reload(wait_until='networkidle')
    expect(panel(page)).to_contain_text('已选对比（1/4）')
    seed(page, LOCAL[:1])
    visit(page, link(ITEMS, compare=wire(ITEMS) + ',removed:2027:202:a'))
    preview(page, 2)
    expect(panel(page)).to_contain_text('已忽略1项')
    assert stored(page) == LOCAL[:1]
    assert page.evaluate('window.__writes || 0') == 0
    # Filter navigation retains compare; history restoration is read-only.
    page.get_by_label('地区范围', exact=True).select_option('other')
    assert 'compare' in parse_qs(urlsplit(page.url).query)
    preview(page, 2)
    page.go_back(wait_until='networkidle')
    expect(page.get_by_label('地区范围', exact=True)).to_have_value('northeast')
    preview(page, 2)
    page.go_forward(wait_until='networkidle')
    expect(page.get_by_label('地区范围', exact=True)).to_have_value('other')
    assert page.evaluate('window.__writes || 0') == 0
    # Two contexts of the same program differ only in language; shared fields hide.
    before_csv = csv_download(page)
    page.get_by_role('switch', name='仅看差异项', exact=True).check()
    expect(panel(page).locator('dt[data-field="year"]')).to_have_count(0)
    expect(panel(page).locator('dt[data-field="language"]')).to_have_count(2)
    expect(panel(page).get_by_text('官方依据', exact=True)).to_have_count(2)
    expect(panel(page).locator('.comparison-reminder')).to_have_count(2)
    assert csv_download(page) == before_csv
    shared_url = copy_result(page)
    query = parse_qs(urlsplit(shared_url).query)
    assert query['diff'] == ['1'] and query['region'] == ['other']
    assert query['compare'] == [wire(ITEMS)]
    filters_url = copy_result(page, False)
    assert 'compare' not in parse_qs(urlsplit(filters_url).query)
    assert 'diff' not in parse_qs(urlsplit(filters_url).query)
    # Fresh recipient restores URL, not storage; detail navigation preserves it.
    fresh_context = browser.new_context()
    recipient = fresh_context.new_page()
    monitor(recipient)
    visit(recipient, shared_url)
    preview(recipient, 2)
    expect(recipient.get_by_role('switch', name='仅看差异项')).to_be_checked()
    assert stored(recipient) is None
    panel(recipient).get_by_text('查看对应专业 →', exact=True).first.click()
    expect(recipient.locator('section.targeted')).to_be_visible()
    recipient.go_back(wait_until='networkidle')
    preview(recipient, 2)
    assert stored(recipient) is None
    # Empty preview remains explicit across reload, never replacing local items.
    history_length = page.evaluate('history.length')
    panel(page).get_by_role('button', name='移除对比', exact=False).first.click()
    preview(page, 1)
    assert page.evaluate('history.length') == history_length
    panel(page).get_by_role('button', name='清空对比', exact=True).click()
    preview(page, 0)
    assert parse_qs(urlsplit(page.url).query)['compare'] == ['v1']
    page.reload(wait_until='networkidle')
    preview(page, 0)
    assert stored(page) == LOCAL[:1]
    panel(page).get_by_role('button', name='返回本机清单', exact=True).click()
    expect(panel(page)).to_contain_text('已选对比（1/4）')
    page.go_back(wait_until='networkidle')
    preview(page, 0)
    assert stored(page) == LOCAL[:1]
    for suffix in ['compare=v2~bad', 'compare=v1~removed:2027:202:a', 'compare=v1&compare=v1', 'compare=' + 'x'*1025]:
        visit(page, BASE + '?' + suffix)
        preview(page, 0)
        expect(panel(page).locator('.share-notice')).to_be_visible()
        assert stored(page) == LOCAL[:1]
        assert page.evaluate('window.__writes || 0') == 0
    # Valid merge under the cap preserves all local items; repeated save deduplicates.
    visit(page, link(ITEMS))
    panel(page).get_by_role('button', name='保存到本机', exact=True).click()
    assert stored(page) == LOCAL[:1] + ITEMS
    panel(page).get_by_role('button', name='保存到本机', exact=True).click()
    assert stored(page) == LOCAL[:1] + ITEMS
    # Over-cap merge requires explicit, non-truncated choices.
    seed(page, LOCAL[:4])
    visit(page, link(ITEMS))
    panel(page).get_by_role('button', name='保存到本机', exact=True).click()
    chooser = page.get_by_role('form', name='选择本机保留项', exact=True)
    expect(chooser.get_by_role('checkbox')).to_have_count(6)
    assert stored(page) == LOCAL[:4]
    chooser.get_by_role('button', name='取消合并', exact=True).click()
    assert stored(page) == LOCAL[:4]
    panel(page).get_by_role('button', name='保存到本机', exact=True).click()
    chooser.get_by_role('checkbox').nth(0).uncheck()
    chooser.get_by_role('checkbox').nth(4).check()
    chooser.get_by_role('button', name='确认保存所选项', exact=True).click()
    assert stored(page) == LOCAL[1:4] + ITEMS[:1]
    preview(page, 2)
    # Storage modified while the selection form is open cannot be overwritten.
    seed(page, LOCAL[:4])
    visit(page, link(ITEMS))
    panel(page).get_by_role('button', name='保存到本机', exact=True).click()
    seed(page, LOCAL[1:5])
    chooser.get_by_role('button', name='确认保存所选项', exact=True).click()
    assert stored(page) == LOCAL[1:5]
    expect(panel(page)).to_contain_text('本机清单已变化')
    panel(page).get_by_role('button', name='保存到本机', exact=True).click()
    other = context.new_page()
    visit(other, BASE)
    seed(other, LOCAL[:4])
    expect(chooser).to_have_count(0)
    expect(panel(page)).to_contain_text('其他页面变化')
    preview(page, 2)
    # Fixed per-item old/new years are independent of the page's current year.
    visit(page, link([ITEMS[0], OLD]))
    expect(panel(page).locator('dd[data-field="year"]')).to_contain_text(['2027', '2026'])
    expect(page.get_by_label('招生年度', exact=True)).to_have_value('2027')
    # Phone viewport, both preview and merge controls, must fit.
    mobile = context.new_page()
    monitor(mobile)
    for width in [320, 390]:
        mobile.set_viewport_size({'width': width, 'height': 844})
        visit(mobile, link(ITEMS, diff='1'))
        preview(mobile, 2)
        assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth')
        panel(mobile).get_by_role('button', name='保存到本机', exact=True).click()
        expect(mobile.get_by_role('form', name='选择本机保留项')).to_be_visible()
        assert mobile.evaluate('document.documentElement.scrollWidth <= innerWidth')
        mobile.screenshot(path=str(OUT / f'mobile-{width}.png'), full_page=True)
    # Clipboard denied and storage denied are recoverable, with manual selection.
    denied_context = browser.new_context()
    denied_context.add_init_script('''
Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('denied')}}});
const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
Storage.prototype.getItem=function(key){if(key==='major-comparison-v1')throw Error('blocked');return get.call(this,key)};
Storage.prototype.setItem=function(key,value){if(key==='major-comparison-v1')throw Error('blocked');return set.call(this,key,value)};
''')
    denied = denied_context.new_page()
    monitor(denied)
    visit(denied, link(ITEMS))
    preview(denied, 2)
    panel(denied).get_by_role('button', name='保存到本机', exact=True).click()
    expect(panel(denied)).to_contain_text('无法读取本机清单')
    panel(denied).get_by_role('button', name='复制对比链接', exact=True).click()
    fallback = denied.get_by_label('手动复制链接', exact=True)
    expect(fallback).to_be_visible()
    value = fallback.input_value()
    assert parse_qs(urlsplit(value).query)['compare'] == [wire(ITEMS)]
    fallback.click()
    assert fallback.evaluate('(e)=>e.selectionStart===0 && e.selectionEnd===e.value.length')
    denied.get_by_role('button', name='关闭分享提示', exact=True).click()
    denied.get_by_role('button', name='复制筛选链接', exact=True).click()
    assert 'compare' not in parse_qs(urlsplit(fallback.input_value()).query)
    # Local edits still work in memory when writes fail.
    visit(denied, BASE + '?topic=instrument')
    denied.locator('.result-row').first.get_by_role('button', name='加入对比', exact=False).click()
    expect(panel(denied)).to_contain_text('当前浏览器无法保存')
    assert not errors, errors
    visit(page, shared_url)
    page.screenshot(path=str(OUT / 'desktop.png'), full_page=True)
    browser.close()
print(json.dumps({'passed': 'URL roundtrip, partial/total invalid input, empty preview, no load-time storage writes, filter/history/route recovery, clipboard success+fallback, explicit merge+cap+concurrency, per-item context, diff rows and full CSV, legacy autosave, mobile 320/390, blocked storage', 'page_or_http_errors': errors, 'csv_direction_rows': len(before_csv)}, ensure_ascii=False))
