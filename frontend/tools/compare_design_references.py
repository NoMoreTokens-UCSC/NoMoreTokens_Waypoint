"""Report pixel differences against original Figma exports, never approve a new baseline."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

PROJECT = Path(__file__).resolve().parents[1]
Image.MAX_IMAGE_PIXELS = 250_000_000
report = []
for capture in json.loads((PROJECT / (sys.argv[1] if len(sys.argv) > 1 else 'docs/figma/browser-render-audit.json')).read_text(encoding='utf8')):
    original = PROJECT / '.figma-local/references' / (capture['id'].replace(':', '-') + '.png')
    if not capture.get('path'):
        report.append({**capture, 'comparison': 'capture failed'})
        continue
    if not original.exists():
        report.append({**capture, 'comparison': 'missing original reference'})
        continue
    expected = Image.open(original).convert('RGB')
    actual = Image.open(PROJECT / capture['path']).convert('RGB')
    if actual.size != expected.size:
        report.append({**capture, 'comparison': 'dimensions differ'})
        continue
    difference = ImageChops.difference(expected, actual)
    changed = difference.convert('L').point(lambda value: 255 if value > 12 else 0)
    count = changed.histogram()[255]
    report.append({**capture, 'comparison': 'requires review',
                   'changedPercentAbove12': round(count / (actual.width * actual.height) * 100, 3),
                   'meanChannelDifference': round(sum(ImageStat.Stat(difference).mean) / 3, 3)})
(PROJECT / (sys.argv[2] if len(sys.argv) > 2 else 'docs/figma/pixel-comparisons.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
for row in report:
    print(row['id'], row.get('changedPercentAbove12', row['comparison']))
