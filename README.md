# Joyalukkas concept landing page

A concept landing page for Joyalukkas, built with plain HTML, CSS, and JavaScript. No build step. It uses real products, prices, photos, and videos from the brand's own site and CDN.

## Design system

- **Motion:** smooth scrolling (Lenis, loaded from unpkg), headings that rise in word by word, images revealed through a mask that opens upward, and blocks that fade up. Everything starts after a short logo loader, which a maroon silk drape with a gold zari hem rises over and then lifts away from the film.
- **Type:** Cormorant Garamond for headings and italic accents, Mulish for text. Flat gold and maroon accents, no gradients.
- **Colour:** an ivory page with two dark velvet chapters (the film and the bridal collection).
- **Details:** a custom cursor that shows "View", "Drag" or "Play", buttons that pull toward the cursor, a faint film grain, and a nav that hides while scrolling down.
- **Photos:** studio shots are brightened and multiplied so their grey backgrounds disappear into the ivory surfaces.
- **Reduced motion:** with reduced motion enabled in system settings, the loader, smooth scroll, cursor and animations are switched off.

The previous version of the page is in `../joyalukkas-landing-backup-v3`.

## Files

- `index.html`: page structure
- `css/styles.css`: layout, colors, motion, responsive styles
- `js/main.js`: rendering and interactions for every section
- `js/products.js`: real products (name, SKU, price, regular price, photos, product link), generated from the joyalukkas.in Magento GraphQL API
- `js/videos.js`: the Muse Film and the reel videos found in the joyalukkas.in homepage CMS blocks
- `css/hero-sequence.css`, `js/hero-sequence.js`, `images/hero-sequence/`: the scroll-scrubbed hero film
- `tools/`: scripts that regenerate `js/products.js`, the jewellery experience assets and the hero film frames

## Sections

1. **Hero, From sketch to heirloom:** a pinned film that plays as you scroll, cut from six shots of the Primora brand film: the forest, the pencil sketch, the stones being set, the muse, the necklace being fastened, and the finished necklace. Each shot has its own caption, and a chapter rail along the bottom shows progress. The first chapter carries the "Crafted for Forever." headline and buttons. When the film ends, the italic marquee and the next section slide up over it. See *Hero film* below.
2. **The Art of Adornment:** a pinned, scroll-scrubbed section (GSAP + ScrollTrigger from cdnjs). A model stands in an arch while drop earrings, a necklace, two bracelets and two rings appear on her one by one, with the product copy changing beside her and a final "Explore the Collection" link. See *Jewellery experience* below.
3. **The Making:** a second pinned section in which the Antique Temple Grandeur necklace is made as you scroll: a pencil sketch draws itself on drafting paper, molten gold pours in and leaves a dull raw casting, the 25 green drops are set one at a time, a polishing light brings up the lustre, and the full product photo fades in with the live price and link. See *The Making* below.
4. **Six Moods:** an editorial grid. The Antique Temple Grandeur necklace fills a large arch-topped tile beside five product tiles and one wide banner. Clicking a tile filters the vault.
5. **Try the Look:** eight looks of five real products each, as a drag and scroll carousel. The panel lists each piece with its live price and link. The 10% bundle price is a concept, not a real offer.
6. **Pick a Gem:** five coloured cards with real ruby, emerald, diamond, rose gold, and temple gold pieces. They tilt, press, and sparkle.
7. **The Vault:** 40 real pieces (8 each of necklaces, earrings, rings, bangles and bridal) on stands with filter chips. Clicking opens the detail view with the front and second product photo, sizes, wishlist, and a link to the product page.
8. **The Muse Film:** the Singapore testimonial film in a gold frame, with a working sound toggle and product photo columns on each side.
9. **Reels:** five brand videos on a 3D arc. The centre reel plays muted with a progress bar and advances when it ends. Tapping it opens full screen with sound.
10. **Bridal Collection:** seven bridal pieces on a curved carousel. The discount tags use each product's real regular and final price.

## Hero film

- Files: `css/hero-sequence.css`, `js/hero-sequence.js`, `js/hero-sequence-frames.js` (generated), `images/hero-sequence/desktop/` (16:9, 1440 × 810) and `images/hero-sequence/mobile/` (9:16, 540 × 960, used when the screen is taller than it is wide).
- The frames are drawn to a canvas. Neighbouring frames are blended, so the motion stays smooth between frames. Each shot gets a slow camera push and crossfades into the next. Frames load coarse to fine (the first frame of every shot, then every 8th, 4th and 2nd), so scrubbing works before everything has arrived. A thin gold bar along the top shows loading progress.
- Tuning (scroll length per shot, crossfade, push, caption timing) is at the top of `js/hero-sequence.js`. Captions are the `.hs-cap` blocks in `index.html`, matched to shots by `data-chapter`.
- To change the shots, edit `CHAPTERS` (start, end and the subject's horizontal `focus` for the phone crop) in `tools/hero-sequence/extract_frames.py` and run `python3 tools/hero-sequence/extract_frames.py [film.mp4]`. It needs ffmpeg, either on PATH or from `pip install imageio-ffmpeg`. Without a path it downloads the Primora film from the CDN.
- With reduced motion, no JS or no canvas, the hero is a single still with the headline.

## Jewellery experience

- Files: `css/jewellery-experience.css`, `js/jewellery-experience.js`, `images/jewellery-experience/`. Nothing else on the page depends on them.
- Each piece flies in from outside the arch (large and spinning, on a curved path), shrinks onto the body and snaps into place with a small press and a glint. Flight paths are in `SEQUENCE` (`from`, `scale`, `spin`).
- After landing, each piece briefly swells to about twice its size (`POP`), then settles back with a soft light halo so it stands out on the gown.
- Once a piece lands, a pulsing gold dot appears just beside it (never on top of it) with a callout showing the piece enlarged on a velvet disc, plus the product type, name and live price, linking to the product page. The piece being presented has a dark callout. They are set in `HOTSPOTS` (which piece, SKU, which side the callout points, and `dy` to move a callout up or down when two sit close). On phones the callouts shrink to the type only and show just for the current piece.
- Placements live in `PIECES` at the top of the script, as percentages of the 1024 x 1536 model photo (`x`, `y`, `width`, an optional `rotate`, plus each asset's own `anchor` point). Timing lives in `SEQUENCE` and `STEPS`, in percent of the pinned scroll.
- `model-base.webp` is the supplied studio photo. The jewellery is five real products (Emerald Radiance earrings, Inverted Arc necklace, Timeless bracelet, Glimmering and Consummate rings), cut out of their catalogue photos by `python3 tools/jewellery-experience/cutout_products.py`. The script also turns each catalogue angle into a worn view: the earring backs are trimmed, the necklace is mirrored to a symmetric front view, the bangle is levelled and its back arc hidden, and the rings keep only the head and top of the band. Change the SKUs in its `PRODUCTS` table to use other pieces.
- Prices and product links in the copy are filled in from `js/products.js` by SKU (`data-jx-sku`), so they follow the gold rate when that file is regenerated.
- To re-fit after changing the photo or a piece, open `index.html?jx-debug`: every piece is shown and draggable (Shift + wheel resizes), and the panel prints the new values to paste into `PIECES`.
- With reduced motion, no JS, or no GSAP, the section shows the finished look and all four pieces as a list instead of pinning.
- `window.JewelleryExperience.destroy()` / `.init()` remove and rebuild it, including its ScrollTrigger.

## The Making

- Files: `css/necklace-making.css`, `js/necklace-making.js`, `images/necklace-making/`. Nothing else on the page depends on them.
- Every stage comes from the one real product photo, so the layers line up exactly. `python3 tools/necklace-making/build_assets.py` (needs numpy, scipy and Pillow) downloads it and writes `scene.webp` (finished photo), `gold.webp` (polished necklace without the drops), `cast.webp` (the same, as a dull raw casting), `sketch.webp` and `outline.webp` (pencil drawing), `stones.webp` (only the drops) and `stones.json` (each drop's position, in setting order). After rebuilding, paste `stones.json` into `STONES` in the script.
- Timing lives in `STAGES` and `STEPS` at the top of the script, in percent of the pinned scroll.
- The copy makes no number claims (stone counts, hours, karat), because the product data has none. Add real figures from the product page if you have them.
- The price and the "View the necklace" link come from `js/products.js` by the section's `data-nm-sku`.
- With reduced motion, no JS, or no GSAP, the section shows the finished photo beside the four steps.
- `window.NecklaceMaking.destroy()` / `.init()` remove and rebuild it.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
```

## Refresh the products

Prices change with the gold rate. To refresh them:

```bash
python3 tools/fetch_products.py /tmp/products-raw.json
python3 tools/gen_products.py /tmp/products-raw.json js/products.js
```

`gen_products.py` picks products by SKU for each section. Edit the SKU lists there to change what appears.

To add more pieces to The Vault (keeps the current ones, tops every category up to `PER_CATEGORY`, rewrites only the vault list):

```bash
python3 tools/vault/fetch_vault.py --dry-run   # preview
python3 tools/vault/fetch_vault.py
```

It searches the same API, skips duplicates, products with fewer than two photos and anything in `EXCLUDE` (close-up photos that crop badly), and marks dark lifestyle photos automatically.

## Notes

- Photos and videos load from cdn.joyalukkas.in and static.joyalukkas.com, and Lenis loads from unpkg, so the page needs an internet connection. Without Lenis it falls back to normal scrolling.
- The CDN ignores the image size parameter and returns the full 1696px photo, and some size values return 404. The page keeps the one size that works for every image and relies on lazy loading instead.
- The bag, wishlist, sizes, and showroom search work only inside the page. Nothing is sent anywhere.
- The Instagram reel uses the CDN's `?tr=` transformed version, because Chrome can't play the original file.
- Only one regional bride video exists on the CDN (Andhra). Other names like `KERALA-BRIDE.mp4` return a 7 KB fallback file.
# joyalukkas-revamp
