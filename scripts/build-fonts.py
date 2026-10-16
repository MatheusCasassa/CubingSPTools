"""Gera as fontes do PDF em public/fonts + o manifesto de subconjuntos.

Uso (só quando atualizar as fontes; o resultado já vai versionado no repo):
    pip install fonttools brotli
    npm i  (para ter @fontsource/* em node_modules)
    python scripts/build-fonts.py

Fonte da súmula: Arimo (métricas e desenho do Arial/Liberation Sans) — é a
fonte em que o Modelo_Aprovado foi renderizado (pesos: regular e negrito).

Por que reconverter: o fontkit (motor de fontes do react-pdf) tem bugs com
alguns arquivos do @fontsource — WOFF2 com glifos compostos (ex.: "i") quebra
no subset, e um WOFF do Noto SC vem com cmap ilegível. Reempacotar via
fontTools em WOFF (zlib) produz arquivos limpos que passam em todos os testes.

  Arimo (latin, latin-ext, cyrillic(-ext), greek(-ext), hebrew, vietnamese) — 400/700
  Noto Sans SC / KR (fallback CJK, peso 700) — ~100 subconjuntos cada
"""
import json, os, re
from fontTools.ttLib import TTFont

ROOT = os.getcwd()
NM = os.path.join(ROOT, 'node_modules', '@fontsource')
OUT = os.path.join(ROOT, 'public', 'fonts')


def parse_css(path):
    css = open(path, encoding='utf8').read()
    faces = []
    for body in re.findall(r'@font-face\s*{([^}]*)}', css):
        f = re.search(r'url\(\./files/([^)]+?\.woff2)\)', body)
        r = re.search(r'unicode-range:\s*([^;]+);', body)
        if not f or not r:
            continue
        ranges = []
        for part in r.group(1).split(','):
            a, _, b = part.strip()[2:].partition('-')
            lo = int(a, 16)
            ranges.append([lo, int(b, 16) if b else lo])
        faces.append((f.group(1), ranges))
    return faces


def convert(src, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    font = TTFont(src)
    font.flavor = 'woff'
    font.save(dest)


manifest = {'base': [], 'fallback': []}

for w in (400, 700):
    for file, ranges in parse_css(os.path.join(NM, 'arimo', f'{w}.css')):
        subset = re.match(r'arimo-(.+)-\d00-normal\.woff2', file).group(1)
        name = file.replace('.woff2', '.woff')
        convert(os.path.join(NM, 'arimo', 'files', file), os.path.join(OUT, name))
        entry = next((e for e in manifest['base'] if e['subset'] == subset), None)
        if entry is None:
            entry = {'subset': subset, 'ranges': ranges, 'files': {}}
            manifest['base'].append(entry)
        entry['files'][str(w)] = f'fonts/{name}'

for pkg, tag in (('noto-sans-sc', 'sc'), ('noto-sans-kr', 'kr')):
    for file, ranges in parse_css(os.path.join(NM, pkg, '700.css')):
        n = re.search(rf'{pkg}-(\d+)-700', file)
        if not n:
            continue
        name = file.replace('.woff2', '.woff')
        convert(os.path.join(NM, pkg, 'files', file), os.path.join(OUT, tag, name))
        manifest['fallback'].append(
            {'family': f'{tag}-{n.group(1)}', 'file': f'fonts/{tag}/{name}', 'ranges': ranges}
        )

# latin primeiro (é o caso comum e o primeiro da pilha).
manifest['base'].sort(key=lambda e: (e['subset'] != 'latin', e['subset']))
dest = os.path.join(ROOT, 'src', 'tools', 'scorecomps', 'pdf', 'fontManifest.json')
with open(dest, 'w') as fh:
    json.dump(manifest, fh, separators=(',', ':'))
print(f"Arimo: {len(manifest['base'])} subconjuntos · fallback CJK: {len(manifest['fallback'])}")
