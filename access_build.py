"""Compile public catalogues and an authoritative private asset manifest."""
import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
from urllib.parse import urlparse


def _paths(output):
    public = Path(output).resolve()
    private = public.parent / 'private'
    if public.name != 'dist' or private.parent != public.parent:
        raise ValueError('Unexpected build directories')
    return public, private


def _inside(root, relative):
    target = (root / relative).resolve()
    if target == root or root not in target.parents:
        raise ValueError('Asset path escapes build directory')
    return target


def restore_cache(output):
    public, private = _paths(output)
    manifest = private / 'manifest.json'
    if not manifest.is_file():
        return
    data = json.loads(manifest.read_text(encoding='utf-8'))
    for key, asset in data.get('assets', {}).items():
        if asset.get('remote'):
            continue
        source = _inside(private / 'media', key)
        target = _inside(public, asset['legacyPath'])
        if source.is_file() and not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            try:
                os.link(source, target)
            except OSError:
                shutil.copyfile(source, target)


def prepare(output, poses, costumes, portraits, depth):
    public, private = _paths(output)
    media = private / 'media'
    media.mkdir(parents=True, exist_ok=True)
    assets, retired, seen = {}, set(), {}

    def register(url, resource):
        if not url:
            return url
        parsed = urlparse(url)
        remote = bool(parsed.scheme)
        if remote:
            if parsed.scheme != 'https' or parsed.netloc != 'ai-pose-depth-gallery.pages.dev' or parsed.query or parsed.fragment:
                raise ValueError('Restricted remote asset origin is not allowed')
            original = url
        else:
            original = url.lstrip('/')
            retired.add('/' + original)
        if original in seen:
            return seen[original]
        suffix = Path(parsed.path).suffix.lower()
        if suffix not in ('.webp', '.png', '.jpg', '.jpeg'):
            raise ValueError('Unexpected asset extension')
        key = hashlib.sha256(('remote:' if remote else 'local:').encode() + original.encode()).hexdigest()[:32] + suffix
        if key in assets:
            raise ValueError('Duplicate asset key')
        asset = {'resource': resource, 'restricted': True}
        if remote:
            asset['remote'] = original
        else:
            source = _inside(public, original)
            target = _inside(media, key)
            if not source.is_file():
                raise FileNotFoundError(source)
            if not target.exists() or not os.path.samefile(source, target):
                if target.exists():
                    target.unlink()
                try:
                    os.link(source, target)
                except OSError:
                    shutil.copyfile(source, target)
            source.unlink()
            asset['legacyPath'] = original
        assets[key] = asset
        result = '/restricted/' + ('remote/' if remote else 'media/') + key
        seen[original] = result
        return result

    inputs = {'pose': poses, 'costume': costumes, 'portrait': portraits, 'depth': depth['payload']['items']}
    public_data, catalogues = {}, {}
    for kind, items in inputs.items():
        public_items, private_items = [], []
        for original in items:
            item = copy.deepcopy(original)
            if kind == 'depth':
                item['a'] = 1
            if not item.get('a'):
                public_items.append(item)
                continue
            for row in item.get('angles', []) or [item]:
                for field in ('t', 'm', 'i', 'o'):
                    if row.get(field):
                        row[field] = register(row[field], kind + ':' + item['id'])
            private_items.append(item)
        public_data[kind] = public_items
        catalogues[kind] = private_items
    depth_public = copy.deepcopy(depth['payload'])
    depth_public['items'] = public_data['depth']
    if isinstance(depth_public.get('pack'), dict):
        depth_public['pack']['note'] = '素材来源与署名见上方说明，显示范围遵循内容偏好。'
        depth_public['pack'].pop('gatedLines', None)
    public_data['depth'] = depth_public
    depth_pack = copy.deepcopy(depth['payload']['pack'])
    depth_pack['note'] = '素材来自原图库，本站展示范围遵循账号的内容偏好。'
    manifest = {'version': 2, 'assets': assets, 'catalogues': catalogues, 'depthPack': depth_pack, 'retiredPaths': sorted(retired)}
    (private / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    patterns = ['/assets/poses.*.json', '/assets/costumes.*.json', '/assets/depths.*.json', '/assets/depths-public.*.json', '/poses.json', '/costumes.json', '/depths.json', '/data.js']
    deny = '@retiredAdult path ' + ' '.join(patterns + sorted(retired)) + '\nrespond @retiredAdult 404\n'
    (private / 'retired.caddy').write_text(deny, encoding='utf-8')
    for paths in public_data.values():
        rows = paths.get('items', []) if isinstance(paths, dict) else paths
        if any(row.get('a') for row in rows):
            raise ValueError('Restricted row remains in public catalogue')
    if any(_inside(public, value.lstrip('/')).exists() for value in retired):
        raise ValueError('Restricted asset remains publicly addressable')
    print('Access build:', {kind: len(items) for kind, items in catalogues.items()}, 'private assets', len(assets))
    return public_data
