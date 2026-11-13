#!/usr/bin/env python3
"""Fill The Vault with more real products from the joyalukkas.in Magento GraphQL API.

Keeps the pieces already in the vault, then tops every category up to PER_CATEGORY with
products found by the searches below (each with at least two photos, no duplicates anywhere
in js/products.js). Only the "vault" list of js/products.js is rewritten.

    python3 tools/vault/fetch_vault.py            # write js/products.js
    python3 tools/vault/fetch_vault.py --dry-run  # just print what would be added
"""
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PRODUCTS_JS = os.path.join(ROOT, 'js', 'products.js')
API = 'https://www.joyalukkas.in/graphql'
UA = {'User-Agent': 'Mozilla/5.0', 'Store': 'default'}
PER_CATEGORY = 8
# The CDN ignores the size and some sizes 404; this one works for every image (see README).
SIZE = 'optimize=medium&bg-color=255,255,255&fit=bounds&height=800&width=800'

# category: (searches, which product names belong)
CATEGORIES = {
    'necklaces': (['diamond necklace', 'gold necklace', 'necklace'], r'\bnecklace\b'),
    'earrings':  (['diamond earrings', 'gold earrings', 'jhumka', 'chandbali'], r'\b(earrings?|jhumkas?|chandbalis?|studs?|drops?|hoops?)\b'),
    'rings':     (['gold ring', 'gemstone ring', 'diamond ring', 'ring'], r'\brings?\b'),
    'bangles':   (['gold bangle', 'diamond bangle', 'bangle'], r'\bbangles?\b'),
    'bridal':    (['antique necklace', 'temple necklace', 'antique choker', 'necklace set', 'bridal necklace'], r'\b(necklace|choker|haram|set|vanki|bangles?|jhumkas?|chandbalis?|earrings?)\b'),
}
# Products whose first photo is a tight close-up (the piece runs off the edge): they read badly on a stand.
EXCLUDE = {'IDN000785', 'DSDN00015583'}
BRIDAL_HINT = re.compile(r'(bridal|temple|antique|heritage|lakshmi|kundan|polki|haram|choker|grandeur|dynasty|divine)', re.I)

QUERY = '''query($q: String!) { products(search: $q, pageSize: 40) { items {
  __typename sku name url_key stock_status
  price_range { minimum_price { final_price { value } regular_price { value } } }
  media_gallery { url disabled position }
  categories { name }
} } }'''


def gql(q):
    body = json.dumps({'query': QUERY, 'variables': {'q': q}}).encode()
    req = urllib.request.Request(API, data=body, headers={**UA, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)['data']['products']['items']


def load():
    src = open(PRODUCTS_JS, encoding='utf-8').read()
    head, _, rest = src.partition('window.JL = ')
    data = json.loads(rest.strip().rstrip(';'))
    return head, data


def known_skus(data):
    out = set()
    def walk(o):
        if isinstance(o, list):
            for x in o: walk(x)
        elif isinstance(o, dict):
            if 'sku' in o: out.add(o['sku'])
            for v in o.values(): walk(v)
    walk(data)
    return out


def image_urls(item):
    imgs = [m for m in (item.get('media_gallery') or []) if not m.get('disabled')]
    imgs.sort(key=lambda m: m.get('position') or 0)
    urls = []
    for m in imgs:
        base = m['url'].split('?')[0]
        if base.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')) and base not in urls:
            urls.append(base)
    return [u + '?' + SIZE for u in urls[:2]]


def is_dark(url):
    """Lifestyle shots have dark backgrounds and fill the frame; studio shots sit on light grey."""
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as r:
        im = Image.open(io.BytesIO(r.read())).convert('L').resize((64, 64))
    px = im.load()
    border = [px[x, y] for x in range(64) for y in (0, 1, 62, 63)] + [px[x, y] for y in range(64) for x in (0, 1, 62, 63)]
    return sum(border) / len(border) < 200


def product(item, urls, typ):
    price = item['price_range']['minimum_price']
    return {
        'sku': item['sku'],
        'name': item['name'].strip(),
        'type': typ,
        'url': f"https://www.joyalukkas.in/{item['url_key']}.html",
        'price': round(price['final_price']['value']),
        'regular': round(price['regular_price']['value']),
        'images': urls,
        'dark': [is_dark(u) for u in urls],
    }


TYPES = [(r'jhumka', 'Jhumkas'), (r'chandbali', 'Chandbali'), (r'earring|stud|drop|hoop', 'Earrings'), (r'choker', 'Choker'),
         (r'necklace|haram', 'Necklace'), (r'bangle', 'Bangle'), (r'\bring', 'Ring'), (r'set', 'Set')]


def type_of(name):
    for pat, t in TYPES:
        if re.search(pat, name, re.I):
            return t
    return 'Jewellery'


def main():
    dry = '--dry-run' in sys.argv
    head, data = load()
    vault = [v for v in data['vault'] if v['p']['sku'] not in EXCLUDE]
    taken = known_skus(data) | EXCLUDE
    by_cat = {c: [v for v in vault if v['cat'] == c] for c in CATEGORIES}

    for cat, (searches, name_re) in CATEGORIES.items():
        need = PER_CATEGORY - len(by_cat[cat])
        for q in searches:
            if need <= 0:
                break
            for item in gql(q):
                if need <= 0:
                    break
                name = item.get('name') or ''
                if item['sku'] in taken or item.get('stock_status') == 'OUT_OF_STOCK':
                    continue
                if not re.search(name_re, name, re.I):
                    continue
                cats = ' '.join(c['name'] for c in item.get('categories') or [])
                if cat == 'bridal':
                    value = item['price_range']['minimum_price']['final_price']['value'] or 0
                    # a bridal word in the name, or a bridal category on a substantial piece
                    if value < 60000 or not (BRIDAL_HINT.search(name) or (re.search(r'bridal', cats, re.I) and value >= 100000)):
                        continue
                    if re.search(r'pendant', name, re.I):
                        continue
                if cat != 'bridal' and BRIDAL_HINT.search(name) and re.search(r'temple|antique|bridal', name, re.I):
                    continue  # keep heavy temple/bridal pieces for the Bridal chip
                if not item['price_range']['minimum_price']['final_price']['value']:
                    continue
                urls = image_urls(item)
                if len(urls) < 2:
                    continue
                try:
                    p = product(item, urls, type_of(name))
                except Exception as e:  # an image that won't load: skip the product
                    print('  skip', item['sku'], e)
                    continue
                by_cat[cat].append({'cat': cat, 'p': p})
                taken.add(item['sku'])
                need -= 1
                print(f"{cat:9s} + {p['name']}  ₹{p['price']:,}  dark={p['dark']}")
        if need > 0:
            print(f'{cat}: only found {PER_CATEGORY - need}')

    # Interleave the categories so "All pieces" mixes them.
    order = list(CATEGORIES)
    new_vault = []
    for i in range(max(len(v) for v in by_cat.values())):
        for c in order:
            if i < len(by_cat[c]):
                new_vault.append(by_cat[c][i])
    data['vault'] = new_vault
    print(f'vault: {len(new_vault)} pieces', {c: len(v) for c, v in by_cat.items()})
    if dry:
        return
    with open(PRODUCTS_JS, 'w', encoding='utf-8') as f:
        f.write(head + 'window.JL = ' + json.dumps(data, indent=1, ensure_ascii=False) + ';\n')


if __name__ == '__main__':
    main()
