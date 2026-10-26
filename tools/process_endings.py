"""process_endings.py: Picture library/5 Endings -> reit-game-2/assets/endings.
Crops to 16:9, 1280x720, one colour grade and vignette for all, JPEG q80.
Fixes known spellings (eleonor -> eleanor, tower_apartment -> tower_apartments,
you_wineyard -> you_vineyard, 'ending receivers' -> ending_receivers).
Only new or changed files are processed unless --all is given.
Run from the REIT 2.0 folder: python3 reit-game-2/tools/process_endings.py [--all]"""
import os, sys
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw
SRC, DST = 'Picture library/5 Endings', 'reit-game-2/assets/endings'
REN = {'eleonor_held': 'eleanor_held', 'eleonor_card': 'eleanor_card', 'eleonor_ruling': 'eleanor_ruling',
       'ending receivers': 'ending_receivers', 'you_wineyard': 'you_vineyard', 'tower_apartment': 'tower_apartments', "Gary's_scrap_metal_yard": 'yard_quiet'}
def vignette(im, strength=0.22):
    w, h = im.size; m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
    d.ellipse((-w * 0.15, -h * 0.25, w * 1.15, h * 1.25), fill=255); m = m.filter(ImageFilter.GaussianBlur(w * 0.08))
    return Image.composite(im, ImageEnhance.Brightness(im).enhance(1 - strength), m)
os.makedirs(DST, exist_ok=True); done = []
for f in sorted(os.listdir(SRC)):
    if not f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')): continue
    k = os.path.splitext(f)[0]; k = REN.get(k, k).strip().replace(' ', '_')
    src, out = os.path.join(SRC, f), os.path.join(DST, k + '.jpg')
    if '--all' not in sys.argv and os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src): continue
    im = Image.open(src).convert('RGB'); w, h = im.size
    tw = int(h * 16 / 9)
    im = im.crop(((w - tw) // 2, 0, (w - tw) // 2 + tw, h)) if tw < w else im.crop((0, (h - int(w * 9 / 16)) // 2, w, (h - int(w * 9 / 16)) // 2 + int(w * 9 / 16)))
    im = im.resize((1280, 720), Image.LANCZOS)
    r, g, b = im.split(); im = Image.merge('RGB', (r.point(lambda v: min(255, int(v * 1.03))), g, b.point(lambda v: int(v * 0.97))))
    im = vignette(ImageEnhance.Contrast(ImageEnhance.Color(im).enhance(0.92)).enhance(1.04))
    im.save(out, quality=80, optimize=True, progressive=True); done.append(k)
print(len(done), 'processed:', ', '.join(done))
