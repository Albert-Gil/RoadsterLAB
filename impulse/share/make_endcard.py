from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
BG = (16, 20, 18)
FG = (230, 233, 227)
URL = (197, 208, 185)
MUTED = (127, 142, 118)
RED = (238, 112, 79)
INK = (17, 25, 18)


def font(name, size):
    path = Path(r"C:\Windows\Fonts") / name
    return ImageFont.truetype(str(path), size)


def centered(draw, text, y, fnt, fill, width):
    box = draw.textbbox((0, 0), text, font=fnt)
    x = (width - (box[2] - box[0])) / 2
    draw.text((x, y), text, font=fnt, fill=fill)


def card(width, height, path):
    img = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(img)
    mark = int(height * 0.056)
    mx = (width - mark) // 2
    my = int(height * 0.30)
    draw.rounded_rectangle([mx, my, mx + mark, my + mark], radius=max(3, mark // 16), fill=RED)
    # Bolt
    cx, cy = mx + mark / 2, my + mark / 2
    bolt = [
        (cx + mark * 0.02, cy - mark * 0.28),
        (cx - mark * 0.18, cy + mark * 0.02),
        (cx - mark * 0.02, cy + mark * 0.02),
        (cx - mark * 0.04, cy + mark * 0.28),
        (cx + mark * 0.20, cy - mark * 0.02),
        (cx + mark * 0.04, cy - mark * 0.02),
    ]
    draw.polygon(bolt, fill=INK)
    title = font("segoeuib.ttf", int(height * 0.052))
    url_font = font("consola.ttf", int(height * 0.018))
    small = font("consola.ttf", int(height * 0.013))
    centered(draw, "IMPULSE", my + mark + int(height * 0.04), title, FG, width)
    centered(draw, "albert-gil.github.io/TRoadster/", my + mark + int(height * 0.13), url_font, URL, width)
    centered(
        draw,
        "Independent simulation  ·  illustrative parameters  ·  not Tesla specs",
        my + mark + int(height * 0.18),
        small,
        MUTED,
        width,
    )
    img.save(path)


if __name__ == "__main__":
    card(1920, 1080, ROOT / "endcard-16x9.png")
    card(1080, 1920, ROOT / "endcard-9x16.png")
    print("end cards written")
