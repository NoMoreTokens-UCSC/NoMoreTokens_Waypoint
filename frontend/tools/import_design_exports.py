"""Import original user exports, split sheet references, and reuse identical SVG layers.

References are QA artifacts only. Asset reuse requires an identical layer signature,
including dimensions, paints, stroke properties, and nested relative geometry.
"""
import json
import hashlib
import shutil
from pathlib import Path
from PIL import Image

Image.MAX_IMAGE_PIXELS = 250_000_000
PROJECT = Path(__file__).resolve().parents[1]
EXPORTS = PROJECT.parent / 'figma-exports'
PUBLIC = PROJECT / 'public/figma'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def walk(node, ancestors=()):
    yield node, ancestors
    for child in node.get('children', []):
        yield from walk(child, ancestors + (node,))

def clean(value):
    if isinstance(value, float):
        return round(value, 2)
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items() if k != 'boundVariables'}
    return value

def signature(node, origin=None):
    box = node.get('absoluteBoundingBox', {})
    origin = origin or box
    keys = ['name', 'type', 'fills', 'strokes', 'strokeWeight', 'strokeAlign',
            'strokeCap', 'strokeJoin', 'cornerRadius', 'rectangleCornerRadii', 'opacity']
    data = {k: node[k] for k in keys if k in node}
    data['box'] = {k: box.get(k, 0) - (origin.get(k, 0) if k in ('x', 'y') else 0)
                   for k in ('x', 'y', 'width', 'height')}
    data['children'] = [signature(c, origin) for c in node.get('children', [])]
    return clean(data)

def main():
    catalog, manifest = read(PUBLIC / 'catalog.json'), read(PUBLIC / 'assets.json')
    # Rebuild crops from original references to prevent stale canvas offsets.
    manifest['vectors'] = {key:path for key,path in manifest['vectors'].items() if not path.endswith('.png')}
    manifest['references'] = {key:path for key,path in manifest.get('references', {}).items() if any(frame['id'] == key for frame in catalog['frames'])}
    nodes, parents = {}, {}
    for source in ('5-3', '425-3'):
        data = read(PROJECT / f'.figma-local/{source}.json')
        for entry in data['nodes'].values():
            for node, ancestors in walk(entry['document']):
                nodes[node['id']] = node
                parents[node['id']] = ancestors
    imported = PUBLIC / 'originals'
    imported.mkdir(exist_ok=True)
    for directory in ('icons', 'Images'):
        shutil.copytree(EXPORTS / directory, imported / directory, dirs_exist_ok=True)
    # These source nodes were checked against the supplied SVG geometry/paints.
    originals = {'200-18699': 'bell.svg', '200-18704': 'UserProfileButton.svg'}
    for key, filename in originals.items():
        if (EXPORTS / 'icons' / filename).exists():
            manifest['vectors'][key] = '/figma/originals/icons/' + filename
    # User-exported BrandMark is the exact 28px dark mark (white arrow).
    for key, asset in catalog['assets'].items():
        node = nodes.get(asset['nodeId'])
        marker_files = {'MapAnchor/CurrentLocation': 'CurrentLocation.svg',
                        'MapAnchor/DestinationMarker': 'DestinationMarker.svg',
                        'MapAnchor/VehicleMarker/VEH055': 'VEH055.svg'}
        if node and node['name'] in marker_files and node.get('absoluteRenderBounds'):
            filename = marker_files[node['name']]
            bounds = node['absoluteRenderBounds']
            expected = 52 if filename == 'CurrentLocation.svg' else 40 if filename == 'VEH055.svg' else 28
            if round(bounds['width']) == expected and round(bounds['height']) == expected:
                manifest['vectors'][key] = '/figma/originals/icons/' + filename
        if node and node['name'] == 'BrandMark' and signature(node).get('box', {}).get('width') == 28:
            fill = next((p.get('color') for p in node.get('fills', []) if p.get('type') == 'SOLID'), None)
            if fill and abs(fill['r'] - 34 / 255) < .001:
                manifest['vectors'][key] = '/figma/originals/icons/BrandMark.svg'
    known = {}
    for key, path in manifest['vectors'].items():
        asset = catalog['assets'].get(key)
        if asset and asset['nodeId'] in nodes:
            digest = hashlib.sha256(json.dumps(signature(nodes[asset['nodeId']]), sort_keys=True).encode()).hexdigest()
            known[digest] = path
    for key, asset in catalog['assets'].items():
        if key not in manifest['vectors'] and asset['nodeId'] in nodes:
            digest = hashlib.sha256(json.dumps(signature(nodes[asset['nodeId']]), sort_keys=True).encode()).hexdigest()
            if digest in known:
                manifest['vectors'][key] = known[digest]
    references = PROJECT / '.figma-local/references'
    references.mkdir(exist_ok=True)
    sheets = []
    for file in (EXPORTS / 'UI').glob('*.png'):
        image = Image.open(file)
        direct = {'Desktop web · Load workspace': '103:15769', 'Tablet web · Current route': '94:9310'}
        candidates = [nodes[direct[file.stem]]] if file.stem in direct else [n for n in nodes.values() if n['name'] == file.stem and n.get('absoluteBoundingBox')]
        candidates.sort(key=lambda n: abs(n['absoluteBoundingBox']['width'] - image.width) + abs(n['absoluteBoundingBox']['height'] - image.height))
        if not candidates:
            continue
        sheet = candidates[0]
        box = sheet['absoluteBoundingBox']
        if sheet['id'] in ('103:15769', '94:9310'):
            target = references / (sheet['id'].replace(':', '-') + '.png')
            if image.size == (round(box['width']), round(box['height'])):
                image.save(target)
            else:
                wrapper = next((parent for parent in reversed(parents[sheet['id']]) if parent['name'].startswith('Screen \u00b7')), None)
                if not wrapper: continue
                origin = wrapper['absoluteBoundingBox']
                x, y = round(box['x']-origin['x']), round(box['y']-origin['y'])
                w, h = round(box['width']), round(box['height'])
                if x < 0 or y < 0 or x+w > image.width or y+h > image.height: continue
                image.crop((x,y,x+w,y+h)).save(target)
            manifest['references'][sheet['id']] = str(target)
            continue
        sheets.append({'file': file.name, 'node': sheet['id'], 'export': image.size, 'source': [box['width'], box['height']]})
        for frame in catalog['frames']:
            if not any(n['id'] == sheet['id'] for n in parents[frame['id']]):
                continue
            b = nodes[frame['id']]['absoluteBoundingBox']
            x, y = round(b['x'] - box['x']), round(b['y'] - box['y'])
            # The exported Store sheet was moved 60px after the REST snapshot.
            # Its screen geometry remains unchanged; verified against its first frame.
            if sheet['id'] == '434:22331':
                x -= 60
            w, h = round(b['width']), round(b['height'])
            if x < 0 or y < 0 or x + w > image.width or y + h > image.height:
                continue
            target = references / (frame['id'].replace(':', '-') + '.png')
            image.crop((x, y, x + w, y + h)).save(target)
            manifest['references'][frame['id']] = str(target)
    # Raster fallbacks contain only original vector groups/icons, never text or
    # whole screens. Prefer original SVG exports whenever an exact match exists.
    raster = {}
    manifest.setdefault('renderBoxes', {})
    for frame in catalog['frames']:
        reference = manifest['references'].get(frame['id'])
        if not reference:
            continue
        image = Image.open(reference)
        origin = nodes[frame['id']]['absoluteBoundingBox']
        for node, _ in walk(nodes[frame['id']]):
            key = node['id'].replace(':', '-').replace(';', '-')
            if key not in catalog['assets'] or key in manifest['vectors']:
                continue
            b = node.get('absoluteBoundingBox')
            if not b:
                continue
            logical = b
            render = node.get('absoluteRenderBounds')
            if render and (b['y'] + b['height'] > origin['y'] + image.height or b['x'] + b['width'] > origin['x'] + image.width):
                b = render
            x, y = round(b['x'] - origin['x']), round(b['y'] - origin['y'])
            w, h = round(b['width']), round(b['height'])
            if x < 0 or y < 0 or x + w > image.width or y + h > image.height or w < 1 or h < 1:
                continue
            target = PUBLIC / 'assets' / (key + '.png')
            image.crop((x, y, x + w, y + h)).save(target)
            manifest['vectors'][key] = '/figma/assets/' + target.name
            if b is not logical:
                manifest['renderBoxes'][key] = {'x': b['x'] - logical['x'], 'y': b['y'] - logical['y'], 'width': b['width'], 'height': b['height']}
            raster[key] = {'sourceFrame': frame['id'], 'crop': [x, y, w, h]}
    # A crop from one frame can also resolve identical copies outside another
    # frame's visible viewport, without inventing their geometry or colors.
    for key, path in manifest['vectors'].items():
        asset = catalog['assets'].get(key)
        if asset and asset['nodeId'] in nodes:
            digest = hashlib.sha256(json.dumps(signature(nodes[asset['nodeId']]), sort_keys=True).encode()).hexdigest()
            known[digest] = path
    for key, asset in catalog['assets'].items():
        if key not in manifest['vectors'] and asset['nodeId'] in nodes:
            digest = hashlib.sha256(json.dumps(signature(nodes[asset['nodeId']]), sort_keys=True).encode()).hexdigest()
            if digest in known:
                manifest['vectors'][key] = known[digest]
    missing = [{'key': key, **asset} for key, asset in catalog['assets'].items() if key not in manifest['vectors']]
    # Figma explicitly reports these empty/off-viewport nodes without render
    # bounds. Preserve geometry in the layer reference, but do not invent art.
    manifest['nonRenderingVectors'] = [asset['key'] for asset in missing
        if asset['nodeId'] in nodes and nodes[asset['nodeId']].get('absoluteRenderBounds') is None
        and asset['name'] != 'MenuButton']
    report = {'referenceCount': len(manifest['references']), 'vectorCount': len(manifest['vectors']),
              'missingVectors': missing, 'missingReferences': [f for f in catalog['frames'] if f['id'] not in manifest['references']],
              'sheets': sheets, 'originalRasterAssets': raster}
    # Absolute QA paths stay local; the browser manifest only exposes public assets.
    (PROJECT / 'docs/figma/export-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    browser_manifest = {**manifest, 'references': {}}
    (PUBLIC / 'assets.json').write_text(json.dumps(browser_manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    (PROJECT / '.figma-local/imported-assets.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"Imported {len(manifest['references'])} frame references, resolved {len(manifest['vectors'])} vector assets; {len(missing)} vector nodes remain unresolved.")

if __name__ == '__main__':
    main()
