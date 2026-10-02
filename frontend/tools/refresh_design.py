"""Refresh structured design, exact artwork and screenshot references through REST.

The ignored .env.figma.local file is read locally. Credentials are never logged,
written to output, passed to asset hosts or exposed to Vite's browser environment.
"""
import concurrent.futures
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from figma_export import api_json, request

PROJECT = Path(__file__).resolve().parents[1]
KEY = 'vIKm5ObsKXbTdEouHUk0iG'

def credential():
    token = os.environ.get('FIGMA_TOKEN', '')
    for file in [PROJECT / '.env.figma.local', PROJECT / 'frontend.env.figma.local', PROJECT.parent / 'frontend.env.figma.local']:
        if not token and file.exists():
            content = file.read_text(encoding='utf-8-sig').strip()
            for line in content.splitlines():
                if line.strip().startswith('FIGMA_TOKEN='):
                    token = line.split('=', 1)[1].strip().strip('\"\'')
            if not token and content.startswith('figd_') and not any(c.isspace() for c in content):
                token = content
            if not token and content and '\n' not in content:
                token = content.split('=', 1)[-1].strip().strip('\"\'')
    if not token:
        raise RuntimeError('Configure FIGMA_TOKEN locally; do not paste it into a chat.')
    return token

def api(path, token, params=None):
    for attempt in range(4):
        try:
            return api_json(path, token, params)
        except RuntimeError as error:
            if '429' not in str(error) or attempt == 3:
                raise
            time.sleep(min(15 * (attempt + 1), 45))

def download(item):
    url, target = item
    data, _ = request(url)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return target.name

def main():
    token = credential()
    directory = PROJECT / '.figma-local'
    directory.mkdir(exist_ok=True)
    paths = []
    for node in ['5:3', '425:3']:
        path = directory / f'{node.replace(":", "-")}.json'
        if not path.exists():
            print(f'Retrieving design page {node}…', flush=True)
            data = api(f'/files/{KEY}/nodes', token, {'ids': node})
            path.write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False), encoding='utf-8')
        paths.append(path)
    subprocess.run([sys.executable, str(PROJECT / 'tools/build_design_reference.py'), *map(str, paths)], check=True)
    catalog = json.loads((PROJECT / 'public/figma/catalog.json').read_text(encoding='utf-8'))
    assets = PROJECT / 'public/figma/assets'
    assets.mkdir(parents=True, exist_ok=True)
    mapping = {'images': {}, 'vectors': {}, 'references': {}, 'failed': []}
    if catalog['imageRefs']:
        urls = api(f'/files/{KEY}/images', token).get('meta', {}).get('images', {})
        # Older REST responses can expose images directly.
        if not urls:
            urls = api(f'/files/{KEY}/images', token).get('images', {})
        for ref in catalog['imageRefs']:
            url = urls.get(ref)
            if not url:
                mapping['failed'].append({'kind': 'image', 'id': ref}); continue
            data, mime = request(url)
            ext = '.png' if 'png' in mime else '.webp' if 'webp' in mime else '.jpg'
            target = assets / f'{ref}{ext}'
            target.write_bytes(data)
            mapping['images'][ref] = f'/figma/assets/{target.name}'
        print(f'Downloaded {len(mapping["images"])} original image fills.', flush=True)
    def checkpoint():
        for key in catalog['assets']:
            if (assets / f'{key}.svg').exists(): mapping['vectors'][key] = f'/figma/assets/{key}.svg'
        (PROJECT / 'public/figma/assets.json').write_text(json.dumps(mapping, separators=(',', ':')), encoding='utf-8')
        (PROJECT / 'docs/figma/assets.json').write_text(json.dumps(mapping, indent=2), encoding='utf-8')
    checkpoint()
    jobs = [(key, asset) for key, asset in catalog['assets'].items() if not (assets / f'{key}.svg').exists()]
    # Align the user's first target and supporting sections before bulk exports.
    preferred = []
    for frame in catalog['frames']:
        if frame['id'] == '196:18656' or frame['section'] in ('entry-account', 'administration', 'recovery'):
            def collect(n):
                if n.get('asset'): preferred.append(n['asset'])
                for c in n.get('children', []): collect(c)
            collect(json.loads((PROJECT / 'public' / frame['url'].lstrip('/')).read_text(encoding='utf-8')))
    priorities = set(preferred)
    jobs.sort(key=lambda entry: entry[0] not in priorities)
    for index in range(0, len(jobs), 80):
        batch = jobs[index:index + 80]
        urls = api(f'/images/{KEY}', token, {'ids': ','.join(asset['nodeId'] for _, asset in batch), 'format': 'svg', 'svg_include_id': 'true'}).get('images', {})
        downloads = []
        for key, asset in batch:
            url = urls.get(asset['nodeId'])
            if url: downloads.append((url, assets / f'{key}.svg'))
            else: mapping['failed'].append({'kind': 'vector', 'id': asset['nodeId']})
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(download, downloads))
        print(f'Exact vector assets: {min(index + 80, len(jobs))}/{len(jobs)} checked.', flush=True)
        checkpoint()
        time.sleep(10)
    for key in catalog['assets']:
        if (assets / f'{key}.svg').exists(): mapping['vectors'][key] = f'/figma/assets/{key}.svg'
    references = directory / 'references'
    for index in range(0, len(catalog['frames']), 40):
        batch = [f for f in catalog['frames'][index:index + 40] if not (references / f'{f["id"].replace(":", "-")}.png').exists()]
        if not batch: continue
        urls = api(f'/images/{KEY}', token, {'ids': ','.join(f['id'] for f in batch), 'format': 'png', 'scale': 1}).get('images', {})
        downloads = []
        for frame in batch:
            url = urls.get(frame['id'])
            if url: downloads.append((url, references / f'{frame["id"].replace(":", "-")}.png'))
            else: mapping['failed'].append({'kind': 'reference', 'id': frame['id']})
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(download, downloads))
        print(f'Figma screenshot references: {min(index + 40, len(catalog["frames"]))}/{len(catalog["frames"])} checked.', flush=True)
    for frame in catalog['frames']:
        target = references / f'{frame["id"].replace(":", "-")}.png'
        if target.exists(): mapping['references'][frame['id']] = str(target)
    (PROJECT / 'public/figma/assets.json').write_text(json.dumps(mapping, separators=(',', ':')), encoding='utf-8')
    (PROJECT / 'docs/figma/assets.json').write_text(json.dumps(mapping, indent=2), encoding='utf-8')
    print(f'Refresh complete: {len(mapping["vectors"])} vectors, {len(mapping["images"])} images, {len(mapping["references"])} references, {len(mapping["failed"])} unresolved.', flush=True)

if __name__ == '__main__':
    main()
