"""Build public/og-image.jpg (1200x630) from a production capture of CST.

Usage: python3 scripts/seo/make-social-preview.py <capture-1440x900.jpg>
The capture is the live site's CST arrival view; the orientation card on the
right is cropped away and a title band is drawn over the lower edge.
"""
import sys
from PIL import Image, ImageDraw, ImageFont

src = Image.open(sys.argv[1]).convert('RGB')
crop = src.crop((0, 60, 1070, 622)).resize((1200, 630), Image.LANCZOS)
band = Image.new('RGBA', crop.size, (0, 0, 0, 0))
d = ImageDraw.Draw(band)
for y in range(400, 630):
    a = int(225 * min(1, (y - 400) / 120))
    d.line([(0, y), (1200, y)], fill=(14, 17, 26, a))
out = Image.alpha_composite(crop.convert('RGBA'), band)
d = ImageDraw.Draw(out)
bold = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 58)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 24)
d.text((56, 492), 'Harsh Jha', font=bold, fill=(246, 239, 222))
d.text((58, 566), 'SOFTWARE · AI · SCIENTIFIC COMPUTING — WALK A 3D MUMBAI PORTFOLIO', font=small, fill=(232, 196, 120))
out.convert('RGB').save(sys.argv[2] if len(sys.argv) > 2 else 'public/og-image.jpg', quality=86, optimize=True)
