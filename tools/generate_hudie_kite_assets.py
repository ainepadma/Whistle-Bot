"""Generate the butterfly kite pet assets from a supplied base image.

Workflow:
1. Load the base PNG (RGBA).
2. Remove the dark background by flood-filling from the image borders,
   keeping the painted kite and its soft glow intact.
3. Auto-trim to the visible sprite bounding box WITHOUT downscaling.
4. Build 8fps GIF animations (idle / walk / walk_fast / run / swipe /
   with_ball) at the sprite's native resolution, plus icon and preview.
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


def remove_dark_background(image: Image.Image, tolerance: int = 60) -> Image.Image:
    """Flood-fill dark border-connected pixels and make them transparent."""
    width, height = image.size
    pixels = image.load()
    visited = bytearray(width * height)
    queue = deque()

    def is_dark(r, g, b):
        # 半透明深色雾：低亮度且低饱和即可命中
        mx, mn = max(r, g, b), min(r, g, b)
        return mx < 175 and (mx - mn) < 90

    def seed(x, y):
        if 0 <= x < width and 0 <= y < height and not visited[y * width + x]:
            r, g, b, a = pixels[x, y]
            if a < 24 or is_dark(r, g, b):
                visited[y * width + x] = 1
                queue.append((x, y))

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)

    def distance(r1, g1, b1, r2, g2, b2):
        return ((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) ** 0.5

    while queue:
        x, y = queue.popleft()
        r0, g0, b0, _ = pixels[x, y]
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < width and 0 <= ny < height and not visited[ny * width + nx]:
                r, g, b, a = pixels[nx, ny]
                if (a < 40 or (is_dark(r, g, b) and distance(r, g, b, r0, g0, b0) <= tolerance)):
                    visited[ny * width + nx] = 1
                    queue.append((nx, ny))

    # 背景蒙版：先洪泛，再膨胀以覆盖外围渐变光晕
    mask = Image.new('L', (width, height), 0)
    mask_pixels = mask.load()
    for y in range(height):
        for x in range(width):
            if visited[y * width + x]:
                mask_pixels[x, y] = 255
    before = sum(1 for y in range(height) for x in range(width) if mask_pixels[x, y] > 0)
    # 收缩 1px，保留主体最外圈的深色描边
    mask = mask.filter(ImageFilter.MinFilter(3))
    mask_px2 = mask.load()
    after = sum(1 for y in range(height) for x in range(width) if mask_px2[x, y] > 0)
    print(f'mask coverage: {before / (width * height):.1%} -> {after / (width * height):.1%}')

    output = image.copy()
    out_pixels = output.load()
    mask_px = mask.load()
    for y in range(height):
        for x in range(width):
            if mask_px[x, y] > 0:
                out_pixels[x, y] = (0, 0, 0, 0)
    return output


def trim_to_content(image: Image.Image) -> Image.Image:
    alpha = image.getchannel('A')
    bbox = alpha.getbbox()
    if bbox is None:
        return image
    return image.crop(bbox)


def pose(base: Image.Image, angle: float, dx: int, dy: int) -> Image.Image:
    """Rotate on the native grid; offset by whole pixels; clear wrapped edges."""
    frame = base.rotate(angle, Image.Resampling.BICUBIC, expand=False)
    frame = ImageChops.offset(frame, dx, dy)
    width, height = frame.size
    transparent = (0, 0, 0, 0)
    if dx > 0:
        frame.paste(transparent, (0, 0, dx, height))
    elif dx < 0:
        frame.paste(transparent, (width + dx, 0, width, height))
    if dy > 0:
        frame.paste(transparent, (0, 0, width, dy))
    elif dy < 0:
        frame.paste(transparent, (0, height + dy, width, height))
    return frame


def save_gif(path: Path, frames: list[Image.Image]):
    indexed_frames = []
    for frame in frames:
        alpha = frame.getchannel('A')
        indexed = frame.convert('RGB').quantize(colors=254, method=Image.Quantize.MEDIANCUT)
        indexed.paste(255, mask=alpha.point(lambda value: 255 if value < 128 else 0))
        indexed.info['transparency'] = 255
        indexed_frames.append(indexed)
    indexed_frames[0].save(
        path,
        save_all=True,
        append_images=indexed_frames[1:],
        duration=125,
        loop=0,
        disposal=2,
        transparency=255,
        optimize=False,
    )


def build(input_path: Path, output_dir: Path, tolerance: int):
    output_dir.mkdir(parents=True, exist_ok=True)
    base = Image.open(input_path).convert('RGBA')
    print(f'input: {base.size}')

    cleaned = remove_dark_background(base, tolerance)
    sprite = trim_to_content(cleaned)
    width, height = sprite.size
    # 四周增加透明留白，避免旋转/位移时裁到触角、翅尖与飘带
    pad = max(12, round(max(width, height) * 0.02))
    padded = Image.new('RGBA', (width + pad * 2, height + pad * 2), (0, 0, 0, 0))
    padded.paste(sprite, (pad, pad))
    sprite = padded
    width, height = sprite.size
    print(f'trimmed sprite: {width}x{height}')

    # 透明像素占比（用于质检）
    alpha = sprite.getchannel('A')
    histogram = alpha.histogram()
    transparent_pixels = sum(histogram[:128])
    total_pixels = width * height
    print(f'transparent ratio: {transparent_pixels / total_pixels:.1%}')

    # 位移量按画幅与 96 逻辑网格等比缩放，保持与原宠物一致的运动幅度
    scale = max(width, height) / 96.0

    def scaled(offset):
        return max(1, round(offset * scale))

    animations = {
        'idle': [(0, 0, 0), (-1, 0, -1), (0, 0, 0), (1, 0, 1)],
        'lie': [(0, 0, 0), (-1, 0, 0), (0, 0, 0), (1, 0, 0)],
        'walk': [(-2, -1, 0), (-1, 0, -1), (1, 1, 0), (2, 0, 1)],
        'walk_fast': [(-2, -1, -1), (2, 1, 1), (-1, 0, -1), (1, 0, 1)],
        'run': [(-3, -1, 0), (2, 1, -1), (-2, 0, 1), (3, 1, 0)],
        'swipe': [(0, 0, 0), (-3, -1, 0), (3, 1, 0), (0, 0, 0)],
        'with_ball': [(0, 0, 0), (-1, 0, -1), (0, 0, 0), (1, 0, 1)],
    }
    for name, specs in animations.items():
        frames = [
            pose(sprite, angle, scaled(dx), scaled(dy))
            for angle, dx, dy in specs
        ]
        save_gif(output_dir / f'red_{name}_8fps.gif', frames)

    sprite.resize((32, 32), Image.Resampling.LANCZOS).save(output_dir / 'icon.png')
    sprite.save(output_dir / 'preview.png')
    print('written to', output_dir)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--tolerance', type=int, default=48)
    args = parser.parse_args()
    build(args.input, args.out, args.tolerance)


if __name__ == '__main__':
    main()
