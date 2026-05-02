#!/usr/bin/env python3
"""
generate_icons.py — Generate all FitPulse PWA icons and splash screens
Run: python3 generate_icons.py
Requires: pip install Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

ICONS_DIR = 'icons'
os.makedirs(ICONS_DIR, exist_ok=True)

# FitPulse brand colors
BG = (10, 10, 15)          # #0a0a0f
ACCENT = (0, 229, 160)     # #00e5a0


def make_icon(size):
    """Create a FitPulse app icon at the given pixel size."""
    img = Image.new('RGBA', (size, size), BG + (255,))
    draw = ImageDraw.Draw(img)

    # Rounded rect background (simulate with circle for simplicity)
    padding = int(size * 0.12)
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=int(size * 0.22),
        fill=(19, 19, 28, 255)
    )

    # Draw a simple "F" pulse line mark
    cx, cy = size // 2, size // 2
    lw = max(2, size // 32)

    # Horizontal bar (the "F")
    bar_w = int(size * 0.32)
    bar_h = int(size * 0.06)
    draw.rectangle(
        [cx - bar_w // 2, cy - int(size * 0.18),
         cx + bar_w // 2, cy - int(size * 0.18) + bar_h],
        fill=ACCENT
    )
    draw.rectangle(
        [cx - bar_w // 2, cy - int(size * 0.04),
         cx + int(bar_w * 0.6), cy - int(size * 0.04) + bar_h],
        fill=ACCENT
    )
    draw.rectangle(
        [cx - bar_w // 2, cy + int(size * 0.1),
         cx - bar_w // 2 + bar_h, cy + int(size * 0.28)],
        fill=ACCENT
    )
    # Vertical stem
    draw.rectangle(
        [cx - bar_w // 2, cy - int(size * 0.18),
         cx - bar_w // 2 + bar_h, cy + int(size * 0.28)],
        fill=ACCENT
    )

    # Pulse dot accent
    dot_r = max(3, size // 20)
    draw.ellipse(
        [cx + bar_w // 4 - dot_r, cy - dot_r,
         cx + bar_w // 4 + dot_r, cy + dot_r],
        fill=ACCENT
    )

    return img


def make_splash(width, height):
    """Create a splash screen at the given dimensions."""
    img = Image.new('RGB', (width, height), BG)
    draw = ImageDraw.Draw(img)

    # Center icon
    icon_size = min(width, height) // 4
    icon = make_icon(icon_size)
    x = (width - icon_size) // 2
    y = (height - icon_size) // 2 - icon_size // 6
    img.paste(icon, (x, y), icon)

    # App name text (simple dots since we can't guarantee font availability)
    dot_y = y + icon_size + icon_size // 4
    dot_spacing = icon_size // 8
    for i, color in enumerate([ACCENT, ACCENT, ACCENT]):
        dot_x = width // 2 + (i - 1) * dot_spacing
        r = max(3, icon_size // 24)
        opacity = 255 if i == 1 else 140
        draw.ellipse([dot_x - r, dot_y - r, dot_x + r, dot_y + r],
                     fill=color + (opacity,) if len(color) == 3 else color)

    return img


# Icon sizes required
icon_sizes = [16, 32, 72, 96, 128, 144, 152, 180, 192, 512]

print("Generating icons...")
for size in icon_sizes:
    icon = make_icon(size)
    path = os.path.join(ICONS_DIR, f'icon-{size}.png')
    icon.save(path, 'PNG', optimize=True)
    print(f"  ✓ icon-{size}.png")

# Splash screen sizes for iOS
splash_sizes = [
    (640, 1136, 'splash-640x1136'),
    (750, 1334, 'splash-750x1334'),
    (828, 1792, 'splash-828x1792'),
    (1125, 2436, 'splash-1125x2436'),
    (1242, 2688, 'splash-1242x2688'),
    (1668, 2224, 'splash-1668x2224'),
    (2048, 2732, 'splash-2048x2732'),
]

print("\nGenerating splash screens...")
for w, h, name in splash_sizes:
    splash = make_splash(w, h)
    path = os.path.join(ICONS_DIR, f'{name}.png')
    splash.save(path, 'PNG', optimize=True)
    print(f"  ✓ {name}.png")

print(f"\n✅ All icons generated in ./{ICONS_DIR}/")
print("   Replace these with your own branded icons for production.")
