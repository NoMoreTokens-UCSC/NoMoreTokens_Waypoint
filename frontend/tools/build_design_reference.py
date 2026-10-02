"""Compile REST layers into per-screen DOM render data and a traceability inventory.

No screen screenshots are used as implementation assets. Vector groups are exported
separately through Figma REST; text and surfaces remain native browser elements.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
KEEP = ('id', 'name', 'type', 'visible', 'opacity', 'rotation', 'clipsContent',
        'fills', 'strokes', 'strokeWeight', 'strokeAlign', 'strokeJoin', 'strokeCap',
        'cornerRadius', 'rectangleCornerRadii', 'effects', 'characters', 'style',
        'characterStyleOverrides', 'styleOverrideTable', 'constraints', 'scrollBehavior',
        'layoutMode', 'layoutWrap', 'layoutAlign', 'layoutGrow', 'layoutSizingHorizontal',
        'layoutSizingVertical', 'itemSpacing', 'paddingLeft', 'paddingRight', 'paddingTop',
        'paddingBottom', 'primaryAxisAlignItems', 'counterAxisAlignItems', 'layoutPositioning',
        'primaryAxisSizingMode', 'counterAxisSizingMode', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight', 'interactions', 'componentId', 'componentProperties',
        'transitionNodeID', 'transitionDuration', 'transitionEasing', 'overflowDirection')

def walk(node, path=()):
    yield node, path
    for child in node.get('children', []):
        yield from walk(child, path + (node.get('name', ''),))

def slug(value):
    return re.sub(r'[^a-zA-Z0-9_-]', '-', value)

def asset_candidate(node):
    if node['type'] in ('VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'REGULAR_POLYGON'):
        return True
    children = node.get('children', [])
    leaves = [n for n, _ in walk(node) if not n.get('children')]
    return bool(children and any(n['type'] in ('VECTOR', 'BOOLEAN_OPERATION') for n in leaves)
                and all(n['type'] not in ('TEXT', 'INSTANCE') for n in leaves)
                and not any(p.get('type') == 'IMAGE' for n in leaves for p in n.get('fills', [])))

def compile_node(node, parent_box, assets, images):
    if node.get('visible') is False:
        return None
    box = node.get('absoluteBoundingBox')
    if not box:
        return None
    result = {k: node[k] for k in KEEP if k in node}
    # Variable IDs alone do not resolve styles. REST's resolved paint/style values
    # are retained, with variable references stripped from the browser payload.
    for key in ('fills', 'strokes'):
        result[key] = [{k: v for k, v in p.items() if k != 'boundVariables'}
                       for p in result.get(key, [])]
        for paint in result[key]:
            if paint.get('imageRef'):
                images.add(paint['imageRef'])
    result['box'] = {'x': box['x'] - parent_box['x'], 'y': box['y'] - parent_box['y'],
                     'width': box['width'], 'height': box['height']}
    render_box = node.get('absoluteRenderBounds')
    if asset_candidate(node):
        key = slug(node['id'])
        result['asset'] = key
        if render_box:
            result['assetBox'] = {'x': render_box['x'] - box['x'], 'y': render_box['y'] - box['y'],
                                  'width': render_box['width'], 'height': render_box['height']}
        assets[key] = {'nodeId': node['id'], 'name': node['name'], 'path': f'/figma/assets/{key}.svg',
                       'width': box['width'], 'height': box['height']}
    else:
        result['children'] = [c for child in node.get('children', [])
                              if (c := compile_node(child, box, assets, images))]
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sources', nargs='+', type=Path)
    args = parser.parse_args()
    output = PROJECT / 'public/figma/frames'
    output.mkdir(parents=True, exist_ok=True)
    frames, assets, images, all_nodes = {}, {}, set(), {}
    sources = []
    for path in args.sources:
        data = json.loads(path.read_text(encoding='utf-8'))
        sources.append({'path': str(path), 'version': data.get('version'),
                        'lastModified': data.get('lastModified'),
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        roots = [entry['document'] for entry in data.get('nodes', {}).values() if entry]
        if not roots and data.get('document'):
            roots = [data['document']]
        for root in roots:
            for node, ancestors in walk(root):
                all_nodes[node['id']] = node
                if node['type'] != 'FRAME' or node.get('name', '').startswith(('Rationale', 'Archive')):
                    continue
                parent_name = ancestors[-1] if ancestors else ''
                screen = parent_name.startswith('Screen ·') or node.get('name', '').startswith('Screen ·')
                # Screen wrappers contain canvas explanations; render their actual UI child.
                if node.get('name', '').startswith('Screen ·'):
                    continue
                special = node['id'] in ('7:5', '438:154') or node.get('name', '').startswith('Driver / Recovery')
                if not screen and not special:
                    continue
                if 'Archive' in '/'.join(ancestors) or 'Original desktop reference' in ancestors:
                    continue
                box = node.get('absoluteBoundingBox', {})
                if not box:
                    continue
                name = parent_name.removeprefix('Screen ·') if node['name'] == 'Login' else node['name']
                section = next((p for p in ancestors if ('Journey' in p and 'Connected' not in p) or 'Entry & Account' in p or 'Administration' in p), '')
                role = ('entry-account' if 'Entry' in section else 'administration' if 'Administration' in section
                        else 'store-manager' if 'Store' in section else 'loader' if 'Loader' in section
                        else 'driver' if 'Driver' in section else 'dispatcher')
                if node['name'].startswith('Driver / Recovery'):
                    role = 'recovery'
                key = slug(node['id'])
                compiled = compile_node(node, box, assets, images)
                (output / f'{key}.json').write_text(json.dumps(compiled, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
                links = []
                for descendant, _ in walk(node):
                    for interaction in descendant.get('interactions', []):
                        for action in interaction.get('actions', []):
                            if not action:
                                continue
                            links.append({'source': descendant['id'], 'label': descendant['name'],
                                          'trigger': interaction.get('trigger'), 'action': action})
                frames[node['id']] = {'id': node['id'], 'name': name, 'section': role,
                                      'path': list(ancestors), 'width': box['width'], 'height': box['height'],
                                      'viewport': 'mobile' if box['width'] <= 440 else 'tablet' if box['width'] < 1200 else 'desktop',
                                      'url': f'/figma/frames/{key}.json', 'interactions': links}
    # Normalize destinations at every nesting level, including conditional
    # branches, so prototype wrappers never become dead route targets.
    def normalize_action(value):
        if isinstance(value, list):
            for child in value: normalize_action(child)
        elif isinstance(value, dict):
            replacements = {'7:24':'311:20806', '314:20992':'433:21919', '314:20941':'433:21882'}
            if value.get('destinationId') in replacements: value['destinationId'] = replacements[value['destinationId']]
            dest = value.get('destinationId')
            if dest in all_nodes and dest not in frames:
                parent = all_nodes[dest]
                if parent['name'].startswith('Screen ·'):
                    ui = next((n for n in parent.get('children', []) if n['type'] == 'FRAME' and not n['name'].startswith('Rationale')), None)
                    if ui and ui['id'] in frames: value['destinationId'] = ui['id']
            for child in value.values():
                if isinstance(child, (list, dict)): normalize_action(child)
    for frame in frames.values():
        for link in frame['interactions']: normalize_action(link['action'])
    inventory = {'sourceFileKey': 'vIKm5ObsKXbTdEouHUk0iG', 'targetFileKey': 'vIKm5ObsKXbTdEouHUk0iG',
                 'status': 'copy-rest-export', 'sources': sources,
                 'frames': list(frames.values()), 'assets': assets, 'imageRefs': sorted(images)}
    target = PROJECT / 'public/figma/catalog.json'
    target.write_text(json.dumps(inventory, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    doc = PROJECT / 'docs/figma/inventory.json'
    doc.write_text(json.dumps(inventory, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Compiled {len(frames)} active UI frames; {len(assets)} exact vector exports and {len(images)} image fills required.')

if __name__ == '__main__':
    main()
