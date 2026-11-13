"""Build the layers for "The Making" section from one real product photo.

    python3 tools/necklace-making/build_assets.py      (needs numpy, scipy, Pillow)

Downloads the Antique Temple Grandeur necklace photo (URL from js/products.js), cuts the
necklace out of its brown backdrop and writes every stage of the scroll story to
images/necklace-making/, all on the same canvas so the layers stay pixel-aligned:

    scene.webp      the finished photo (final stage)
    gold.webp       polished necklace, emerald drops removed (stage 4)
    cast.webp       the same, as a dull raw casting (stage 2)
    sketch.webp     pencil detail lines (stage 1)
    outline.webp    pencil outline, drawn before the detail (stage 1)
    stones.webp     only the emerald drops (stage 3)
    stones.json     each drop's centre and radius in % of the canvas, in setting order
"""
import io
import json
import os
import re
import urllib.request

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.environ.get('NM_OUT') or os.path.join(ROOT, 'images', 'necklace-making')
SKU = 'DS1400104748'
CROP = (110, 130, 1120, 1140)   # square around the necklace in the 1200px photo
SIZE = 1000


def photo():
    src = open(os.path.join(ROOT, 'js', 'products.js'), encoding='utf-8').read()
    m = re.search(r'"sku":\s*"%s".*?"images":\s*\[\s*"([^"]+)"' % SKU, src, re.S)
    url = re.sub(r'height=\d+&width=\d+', 'height=1200&width=1200', m.group(1))
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB')


def hsv_planes(img):
    hsv = np.asarray(img.convert('HSV')).astype(float) / 255
    return hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]


def largest(mask):
    lab, n = nd.label(mask)
    sizes = nd.sum(mask, lab, range(1, n + 1))
    return lab == (np.argmax(sizes) + 1)


def necklace_mask(img):
    H, S, V = hsv_planes(img)
    gold = (H > 24) & (H < 60) & (S > .35) & (V > .22)
    green = (H > 80) & (H < 200) & (S > .2) & (V > .04)
    pearl = (S < .35) & (V > .6)
    m = nd.binary_closing(gold | green | pearl, structure=np.ones((9, 9)), iterations=2)
    m = largest(nd.binary_opening(nd.binary_fill_holes(m), structure=np.ones((5, 5))))
    # near the edge, drop anything that looks like the brown backdrop
    inner = nd.binary_erosion(m, iterations=10)
    backdrop = (H >= 5) & (H <= 24) & (S > .3) & (S < .65) & (V < .8) & ~gold & ~green & ~pearl
    m = m & ~(backdrop & ~inner)
    m = nd.binary_fill_holes(largest(nd.binary_opening(m, structure=np.ones((2, 2)))))
    return m, green & m


def find_stones(green):
    g = nd.binary_fill_holes(nd.binary_closing(nd.binary_opening(green), structure=np.ones((5, 5))))
    dt = nd.distance_transform_edt(g)
    peaks = (dt == nd.maximum_filter(dt, size=15)) & (dt > 5)
    lab, n = nd.label(peaks)
    pts = np.array(nd.center_of_mass(peaks, lab, range(1, n + 1)))
    keep = []
    for p in pts[np.argsort(-dt[tuple(pts.astype(int).T)])]:
        if all(np.hypot(*(p - q)) > 14 for q in keep):
            keep.append(p)
    yy, xx = np.mgrid[:green.shape[0], :green.shape[1]]
    near = nd.binary_dilation(g, iterations=3)
    stones, mask = [], np.zeros_like(green)
    for y, x in keep:
        r = dt[int(y), int(x)] + 4
        mask |= ((yy - y) ** 2 + (xx - x) ** 2 <= r * r) & near
        stones.append((x, y, r))
    return stones, mask


def setting_order(stones):
    """Centre drop first, then outwards, alternating sides, like a setter working the fringe."""
    cx = np.mean([s[0] for s in stones])
    left = sorted([s for s in stones if s[0] < cx], key=lambda s: -s[0])
    right = sorted([s for s in stones if s[0] >= cx], key=lambda s: s[0])
    out = []
    for i in range(max(len(left), len(right))):
        out += right[i:i + 1] + left[i:i + 1]
    return out


def feather(mask, r=0.9):
    return Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))


def with_alpha(rgb, alpha):
    out = rgb.copy()
    out.putalpha(alpha)
    return out


def raw_cast(img):
    """Fresh from the mould: no lustre, a duller greyer gold, flattened contrast."""
    a = np.asarray(img).astype(float) / 255
    lum = (a @ [.3, .59, .11])[..., None]
    dull = np.array([.62, .5, .34]) * (.35 + .65 * lum)
    out = a * .25 + dull * .75
    out = .5 + (out - .5) * .8 - .04
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


def pencil(img, mask):
    """Colour-dodge pencil sketch (grey / inverted blur), drawn only inside the necklace."""
    g = np.asarray(img.convert('L')).astype(float)
    blur = nd.gaussian_filter(255 - g, 6)
    dodge = np.clip(g * 255 / np.maximum(1, 255 - blur), 0, 255)
    dark = np.clip(((255 - dodge) / 255 - .08) / .6, 0, 1) ** 1.7
    dark *= nd.binary_erosion(mask, iterations=3)
    # the outline: a smoothed silhouette edge, like a confident first pencil pass
    soft = nd.gaussian_filter(mask.astype(float), 2.5) > .5
    edge = nd.binary_dilation(soft, iterations=1) & ~nd.binary_erosion(soft, iterations=1)
    graphite = Image.new('RGB', img.size, (52, 46, 44))
    return (with_alpha(graphite, Image.fromarray((dark * 175).astype(np.uint8))),
            with_alpha(graphite, feather(edge, 0.8).point(lambda v: int(v * .8))))


def save(im, name):
    im.resize((SIZE, SIZE), Image.LANCZOS).save(os.path.join(OUT, name), quality=82, alpha_quality=70, method=6)
    print(name)


def main():
    os.makedirs(OUT, exist_ok=True)
    img = photo().crop(CROP)
    neck, green = necklace_mask(img)
    stones, stone_mask = find_stones(green)
    body = neck & ~stone_mask

    save(img, 'scene.webp')
    save(with_alpha(img, feather(body)), 'gold.webp')
    save(with_alpha(raw_cast(img), feather(body)), 'cast.webp')
    save(with_alpha(img, feather(stone_mask & neck, .6)), 'stones.webp')
    sketch, outline = pencil(img, neck)
    save(sketch, 'sketch.webp')
    save(outline, 'outline.webp')

    w = img.size[0]
    data = [{'x': round(x / w * 100, 2), 'y': round(y / w * 100, 2), 'r': round(r / w * 100, 2)}
            for x, y, r in setting_order(stones)]
    json.dump(data, open(os.path.join(OUT, 'stones.json'), 'w'), separators=(',', ':'))
    print(f'stones.json  {len(data)} stones')


if __name__ == '__main__':
    main()
