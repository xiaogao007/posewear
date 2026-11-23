"""Validate the actual public/private build boundary, including every variant."""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
public=root/'dist';private=root/'private'
manifest=json.loads((private/'manifest.json').read_text(encoding='utf-8'))
counts={}
for kind,name in [('pose','poses'),('costume','costumes'),('portrait','portraits')]:
    files=list((public/'assets').glob(name+'-public.*.json'))
    assert len(files)==1,(kind,'ambiguous public catalogue')
    payload=json.loads(files[0].read_text(encoding='utf-8'))
    rows=payload.get('items',[]) if isinstance(payload,dict) else payload
    assert all(not row.get('a') for row in rows),(kind,'restricted public metadata')
    counts[kind]=len(rows)
    for row in rows:
        for angle in row.get('angles',[]) or [row]:
            for field in ['t','m','i','o']:
                url=angle.get(field)
                if url and not url.startswith('https://'):
                    assert not url.startswith('/restricted/'),(kind,'private reference in public catalogue')
                    assert (public/url.lstrip('/')).is_file(),url
for kind,rows in manifest['catalogues'].items():
    for row in rows:
        assert row.get('a'),(kind,'unclassified private record')
        for angle in row.get('angles',[]) or [row]:
            for field in ['t','m','i','o']:
                url=angle.get(field)
                if url:
                    assert url.startswith('/restricted/'),url
                    key=url.rsplit('/',1)[1]
                    assert key in manifest['assets'],url
for key,asset in manifest['assets'].items():
    if 'remote' in asset:
        assert asset['remote'].startswith('https://ai-pose-depth-gallery.pages.dev/')
    else:
        assert (private/'media'/key).is_file(),key
        assert not (public/asset['legacyPath']).exists(),asset['legacyPath']
        assert ('/'+asset['legacyPath']) in manifest['retiredPaths']
assert not list((public/'assets').glob('depths*.json')),'Depth metadata must not be public'
assert len(manifest['catalogues']['depth'])==288,'Entire depth gallery must be restricted'
for name in ['poses','costumes','depths']:
    assert not list((public/'assets').glob(name+'.*.json')),'Legacy full catalogue remains'
    assert not (public/(name+'.json')).exists(),'Legacy unhashed catalogue remains'
sw=(public/'sw.js').read_text(encoding='utf-8')
assert "startsWith('/restricted/')" in sw
assert "startsWith('posewear-')" in sw
print('PUBLIC_PRIVATE_BUILD_OK',counts,'protected resources',len(manifest['assets']))
