#!/usr/bin/env python3
"""Remove white/black background from brand logo and generate icon sizes."""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "brand-logo-source.png"
# Fallback to user-provided asset name if not copied yet
FALLBACK = Path(
    "/Users/mac/.cursor/projects/Users-mac-Documents-Web-Dev-new-projects-Fetcher-io/assets/"
    "ChatGPT_Image_Jul_15__2026__08_55_47_PM-7a568eda-3dd6-4bbf-85ec-213591a207d8.png"
)

EXT_ICONS = ROOT / "apps" / "extension" / "public" / "icons"
WEB_PUBLIC = ROOT / "apps" / "web" / "public"
SIZES = [16, 32, 48, 128, 180, 192, 512]


def is_background(r: int, g: int, b: int, a: int = 255) -> bool:
    if a < 10:
        return True
    # Pure/near black outer canvas
    if r < 35 and g < 35 and b < 35:
        return True
    # White / light gray rounded card
    if r > 225 and g > 225 and b > 225:
        return True
    # Very light lavender fade on motion lines
    if r > 210 and g > 210 and b > 235 and abs(r - g) < 25:
        return True
    return False


def remove_background(img: Image.Image) -> Image.Image:
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if is_background(r, g, b, a):
                pixels[x, y] = (r, g, b, 0)
    return img


def crop_transparent(img: Image.Image, padding: int = 8) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(img.width, right + padding)
    bottom = min(img.height, bottom + padding)
    return img.crop((left, top, right, bottom))


def resize_square(img: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.thumbnail((size, size), Image.Resampling.LANCZOS)
    x = (size - img.width) // 2
    y = (size - img.height) // 2
    canvas.paste(img, (x, y), img)
    return canvas


def main() -> None:
    src = SOURCE if SOURCE.exists() else FALLBACK
    if not src.exists():
        raise SystemExit(f"Source logo not found: {src}")

    img = Image.open(src)
    img = remove_background(img)
    img = crop_transparent(img, padding=12)

    EXT_ICONS.mkdir(parents=True, exist_ok=True)
    WEB_PUBLIC.mkdir(parents=True, exist_ok=True)

    # Master transparent logo for website
    master = resize_square(img.copy(), 512)
    master.save(WEB_PUBLIC / "logo.png")

    for size in SIZES:
        icon = resize_square(img.copy(), size)
        if size in (16, 32, 48, 128):
            icon.save(EXT_ICONS / f"icon-{size}.png")
        if size == 32:
            icon.save(WEB_PUBLIC / "favicon.png")
        if size == 180:
            icon.save(WEB_PUBLIC / "apple-touch-icon.png")
        if size == 192:
            icon.save(WEB_PUBLIC / "icon-192.png")

    # ICO for legacy browsers
    fav32 = Image.open(WEB_PUBLIC / "favicon.png")
    fav32.save(WEB_PUBLIC / "favicon.ico", format="ICO", sizes=[(32, 32)])

    print(f"Processed logo from {src}")
    print(f"Extension icons -> {EXT_ICONS}")
    print(f"Web assets -> {WEB_PUBLIC}")


if __name__ == "__main__":
    main()
