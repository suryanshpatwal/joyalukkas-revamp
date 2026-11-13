"""Cut real Joyalukkas product photos out of their grey studio backgrounds.

    python3 tools/jewellery-experience/cutout_products.py

Downloads each product's front photo from the brand CDN (URLs come from js/products.js
via the SKU table below), removes the background and writes transparent PNGs to
images/jewellery-experience/.

Only background that touches the image edge is removed, plus large enclosed pockets
(the hole inside a ring band). Diamonds are almost the same colour as the backdrop, so
a plain colour key would punch holes in them; small enclosed regions are kept.
"""
import io
import os
import re
import urllib.request

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.environ.get('JX_OUT') or os.path.join(ROOT, 'images', 'jewellery-experience')

# output file -> (SKU, crop of the product photo as fractions, or None)
PRODUCTS = {
    'necklace.png':       ('DSDN00014450', None),
    'earrings-left.png':  ('DSDE00047314', (0.0, 0.0, 0.5, 1.0)),   # the pair, left stud
    'earrings-right.png': ('DSDE00047314', (0.5, 0.0, 1.0, 1.0)),   # right stud
    'bracelet-left.png':  ('DSDB00002216', None),
    'bracelet-right.png': ('DSDB00002216', None),
    'ring-1.png':         ('DSDR00014626', None),
    'ring-2.png':         ('LSDR00019279', None),
}

def product_urls():
    src = open(os.path.join(ROOT, 'js', 'products.js'), encoding='utf-8').read()
    urls = {}
    for m in re.finditer(r'"sku":\s*"([^"]+)".*?"images":\s*\[\s*"([^"]+)"', src, re.S):
        urls.setdefault(m.group(1), m.group(2))
    return urls


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return Image.open(io.BytesIO(r.read())).convert('RGB')


def cutout(img, thresh=12, min_pocket=0.004):
    """Return the product on a transparent background, cropped to its bounds."""
    w, h = img.size
    bg = img.getpixel((2, 2))
    # distance from the backdrop colour (max over channels), then binarise:
    # 0 = backdrop-coloured, 128 = product
    diff = ImageChops.difference(img, Image.new('RGB', img.size, bg))
    r, g, b = diff.split()
    dist = ImageChops.lighter(ImageChops.lighter(r, g), b)
    m = dist.point(lambda v: 0 if v <= thresh else 128)
    # 1. backdrop connected to the border -> 255
    for x in range(0, w, 8):
        for y in (0, h - 1):
            if m.getpixel((x, y)) == 0:
                ImageDraw.floodfill(m, (x, y), 255, thresh=0)
    for y in range(0, h, 8):
        for x in (0, w - 1):
            if m.getpixel((x, y)) == 0:
                ImageDraw.floodfill(m, (x, y), 255, thresh=0)
    # 2. enclosed backdrop pockets: large ones are holes (ring/bangle interior),
    #    small ones are bright facets of a diamond and stay
    for y in range(0, h, 6):
        for x in range(0, w, 6):
            if m.getpixel((x, y)) != 0:
                continue
            ImageDraw.floodfill(m, (x, y), 200, thresh=0)
            area = m.histogram()[200]
            ImageDraw.floodfill(m, (x, y), 255 if area > w * h * min_pocket else 100, thresh=0)
    alpha = m.point(lambda v: 0 if v == 255 else 255)
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = img.copy()
    out.putalpha(alpha)
    return out.crop(alpha.getbbox())


def symmetric(img):
    """Mirror the complete left half around the lowest point of the arc."""
    a = img.getchannel('A')
    w, h = img.size
    # centre = middle of the opaque pixels on the lowest rows
    for y in range(h - 1, 0, -1):
        xs = [x for x in range(w) if a.getpixel((x, y)) > 128]
        if len(xs) > 3:
            cx = (xs[0] + xs[-1]) // 2
            break
    left = img.crop((0, 0, cx, h))
    out = Image.new('RGBA', (cx * 2, h), (0, 0, 0, 0))
    out.paste(left, (0, 0))
    out.paste(left.transpose(Image.FLIP_LEFT_RIGHT), (cx, 0))
    return out.crop(out.getchannel('A').getbbox())


def worn_bangle(img, angle, mirror=False):
    """Level the bangle across the wrist and hide the back arc behind the wrist."""
    img = img.rotate(angle, resample=Image.BICUBIC, expand=True)
    img = img.crop(img.getchannel('A').getbbox())
    w, h = img.size
    a = img.getchannel('A')
    hide = Image.new('L', img.size, 255)
    d = ImageDraw.Draw(hide)
    d.ellipse((w * .02, -h * .75, w * .98, h * .62), fill=0)   # the back arc, where the wrist covers it
    hide = hide.filter(ImageFilter.GaussianBlur(w * .02))
    img.putalpha(ImageChops.multiply(a, hide))
    img = img.crop(img.getchannel('A').getbbox())
    return img.transpose(Image.FLIP_LEFT_RIGHT) if mirror else img


def frac_crop(img, box):
    w, h = img.size
    return img.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))


# what each piece looks like when worn, from the catalogue angle
POST = {
    'necklace.png':       symmetric,
    'earrings-left.png':  lambda im: frac_crop(im, (0.36, 0.0, 0.97, 1.0)),
    'earrings-right.png': lambda im: frac_crop(im, (0.03, 0.0, 0.61, 1.0)),
    'bracelet-left.png':  lambda im: worn_bangle(im, 137),
    'bracelet-right.png': lambda im: worn_bangle(im, 137, mirror=True),
    'ring-1.png':         lambda im: frac_crop(im, (0.0, 0.0, 1.0, 0.44)),
    'ring-2.png':         lambda im: frac_crop(im, (0.0, 0.0, 1.0, 0.36)),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    urls = product_urls()
    cache = {}
    for name, (sku, crop) in PRODUCTS.items():
        if sku not in urls:
            raise SystemExit(f'{sku} not found in js/products.js')
        if sku not in cache:
            cache[sku] = fetch(urls[sku])
        img = cache[sku]
        if crop:
            w, h = img.size
            img = img.crop((int(crop[0] * w), int(crop[1] * h), int(crop[2] * w), int(crop[3] * h)))
        cut = cutout(img)
        if name in POST:
            cut = POST[name](cut)
            cut = cut.crop(cut.getchannel('A').getbbox())
        cut.thumbnail((720, 720), Image.LANCZOS)   # plenty for a 2x close-up; overlays render far smaller
        cut.save(os.path.join(OUT, name), optimize=True)
        print(f'{name:20s} {sku:14s} {cut.size[0]}x{cut.size[1]}')


if __name__ == '__main__':
    main()
