"""Export a Figma frame's JSON and referenced assets using the REST API.

Usage:
    python figma_export.py "https://www.figma.com/design/FILEKEY/Name?node-id=1-2" --out figma-export

Set FIGMA_TOKEN in your environment first. Requires Python 3.9+; no packages.
"""

import argparse
import json
import mimetypes
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


API = "https://api.figma.com/v1"


def request(url, token=None):
    headers = {"User-Agent": "figma-frame-export/1.0"}
    if token:
        headers["X-Figma-Token"] = token
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as response:
            return response.read(), response.headers.get("Content-Type", "")
    except urllib.error.HTTPError as error:
        message = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"HTTP {error.code} for {url.split('?')[0]}: {message}") from error


def api_json(path, token, params=None):
    url = API + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data, _ = request(url, token)
    return json.loads(data)


def parse_link(link):
    parsed = urllib.parse.urlparse(link)
    if parsed.hostname not in {"figma.com", "www.figma.com"}:
        raise ValueError("Use a figma.com file or frame link.")
    match = re.match(r"^/(?:design|file|proto)/([^/]+)", parsed.path)
    if not match:
        raise ValueError("Could not find the file key in this Figma link.")
    node_id = urllib.parse.parse_qs(parsed.query).get("node-id", [None])[0]
    if not node_id:
        raise ValueError("This link has no node-id. In Figma, select the frame and copy its link.")
    return match.group(1), node_id.replace("-", ":")


def walk(node):
    yield node
    for child in node.get("children", []):
        yield from walk(child)


def safe_name(value):
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-.")[:60] or "asset"


def download(url, destination):
    data, content_type = request(url)
    destination.write_bytes(data)
    return content_type


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("frame_link", help="Figma link to a selected frame (must contain node-id)")
    parser.add_argument("--out", type=Path, default=Path("figma-export"))
    parser.add_argument("--svg-node", action="append", default=[], help="Extra icon/group node ID to export as SVG; repeatable")
    args = parser.parse_args()

    token = os.environ.get("FIGMA_TOKEN")
    if not token:
        parser.error("Set the FIGMA_TOKEN environment variable first.")
    file_key, node_id = parse_link(args.frame_link)
    output = args.out.resolve()
    assets = output / "assets"
    assets.mkdir(parents=True, exist_ok=True)

    result = api_json(f"/files/{file_key}/nodes", token, {"ids": node_id})
    entry = result.get("nodes", {}).get(node_id)
    if not entry or not entry.get("document"):
        raise RuntimeError(f"Node {node_id} was not found. Check the frame link and file access.")
    frame = entry["document"]
    (output / "frame.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")

    image_refs = set()
    svg_nodes = {}
    for node in walk(frame):
        for property_name in ("fills", "strokes", "background"):
            for paint in node.get(property_name, []) or []:
                if paint.get("type") == "IMAGE" and paint.get("imageRef"):
                    image_refs.add(paint["imageRef"])
        if any(setting.get("format") == "SVG" for setting in node.get("exportSettings", [])):
            svg_nodes[node["id"]] = node.get("name", "svg")
    for extra_id in args.svg_node:
        svg_nodes[extra_id.replace("-", ":")] = "extra-svg"

    manifest = {"source": args.frame_link, "fileKey": file_key, "frameId": node_id,
                "frameName": frame.get("name"), "imageFills": {}, "svgExports": {}}
    if image_refs:
        fill_urls = api_json(f"/files/{file_key}/images", token).get("images", {})
        for image_ref in sorted(image_refs):
            url = fill_urls.get(image_ref)
            if not url:
                print(f"Warning: no URL for image fill {image_ref}", file=sys.stderr)
                continue
            data, content_type = request(url)
            mime = content_type.split(";")[0]
            extension = mimetypes.guess_extension(mime) or ".bin"
            if extension == ".jpe":
                extension = ".jpg"
            name = f"image-{safe_name(image_ref)}{extension}"
            (assets / name).write_bytes(data)
            manifest["imageFills"][image_ref] = f"assets/{name}"

    if svg_nodes:
        exports = api_json(f"/images/{file_key}", token,
                           {"ids": ",".join(svg_nodes), "format": "svg"}).get("images", {})
        for svg_id, label in svg_nodes.items():
            url = exports.get(svg_id)
            if not url:
                print(f"Warning: SVG export failed for {svg_id}", file=sys.stderr)
                continue
            name = f"{safe_name(label)}-{safe_name(svg_id)}.svg"
            download(url, assets / name)
            manifest["svgExports"][svg_id] = f"assets/{name}"

    preview = api_json(f"/images/{file_key}", token,
                       {"ids": node_id, "format": "png", "scale": 1}).get("images", {}).get(node_id)
    if preview:
        download(preview, output / "frame-preview.png")
        manifest["preview"] = "frame-preview.png"
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Saved {frame.get('name', node_id)} to {output}")
    print(f"Image fills: {len(manifest['imageFills'])}; SVG exports: {len(manifest['svgExports'])}")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
