import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('catalog_collector', Path(__file__).parents[1] / 'scripts/collect_catalogs.py')
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class CollectorTests(unittest.TestCase):
    def test_html_keeps_foreign_column_and_ignores_scripts(self):
        data = '<h1>2027目录</h1><table><tr><td>080400仪器</td><td>②201或202俄语</td></tr></table><script>token=secret</script>'.encode()
        text = collector.extract(data, 'html')
        self.assertIn('080400仪器', text)
        self.assertIn('②201或202俄语', text)
        self.assertNotIn('secret', text)

    def test_captcha_pdf_is_an_error_not_empty_catalog(self):
        with self.assertRaisesRegex(ValueError, '不是PDF'):
            collector.extract(b'<html>captcha</html>', 'pdf')

    def test_2027_is_not_a_202_subject(self):
        self.assertFalse(collector.CODE.search('2027年招生202602记录'))
        self.assertTrue(collector.CODE.search('②201或202俄语'))

    def test_candidates_are_pending_even_when_download_succeeds(self):
        source = {'id': 'fixture', 'university': '示例院校', 'year': '2027', 'assetUrl': 'https://example.edu.cn/catalog', 'format': 'html', 'sha256': 'old'}
        response = io.BytesIO('<p>2027目录</p><p>080400仪器：②201或202俄语</p>'.encode())
        response.url = source['assetUrl']
        with tempfile.TemporaryDirectory() as directory, patch.object(collector, 'urlopen', return_value=response):
            report = collector.collect(source, Path(directory))
            self.assertEqual(report['verification'], 'pending')
            self.assertFalse(report['matchesReviewedFingerprint'])
            self.assertEqual(len(report['candidates']), 1)
            self.assertEqual(report['candidates'][0]['verification'], 'pending')
            written = json.loads((Path(directory) / 'fixture/report.json').read_text())
            self.assertEqual(written['verification'], 'pending')

    def test_failed_download_is_recorded_for_review(self):
        source = {'id': 'fixture', 'university': '示例院校', 'year': '2027', 'assetUrl': 'https://example.edu.cn/catalog', 'format': 'pdf', 'sha256': ''}
        with tempfile.TemporaryDirectory() as directory, patch.object(collector, 'urlopen', side_effect=TimeoutError('timeout')):
            report = collector.collect(source, Path(directory))
            self.assertEqual(report['status'], 'error')
            self.assertEqual(report['verification'], 'pending')
            self.assertEqual(report['candidates'], [])


if __name__ == '__main__':
    unittest.main()
