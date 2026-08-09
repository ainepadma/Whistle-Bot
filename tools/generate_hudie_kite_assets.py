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
from PIL import ImageFont


# 两只大眼睛的包围盒（占整图百分比，由视觉 API 测量）
EYE_SPECS = [
    (37.6, 14.8, 8.6, 9.5),
    (53.4, 14.8, 8.8, 9.5),
]


def close_eyes(image: Image.Image) -> Image.Image:
    """把风筝的大眼睛彻底改画成放松闭合的眼皮（左右略不对称），并加睡眠符号。"""
    img = image.copy()
    width, height = img.size
    pixels = img.load()
    draw = ImageDraw.Draw(img)

    for (ex, ey, ew, eh) in EYE_SPECS:
        x0 = int(ex / 100.0 * width)
        y0 = int(ey / 100.0 * height)
        x1 = int((ex + ew) / 100.0 * width)
        y1 = int((ey + eh) / 100.0 * height)
        margin = max(2, int((x1 - x0) * 0.06))

        def sample_avg(xs, ys):
            collected = []
            for xx in xs:
                for yy in ys:
                    if 0 <= xx < width and 0 <= yy < height:
                        r, g, b, a = pixels[xx, yy]
                        if a > 0:
                            collected.append((r, g, b))
            if not collected:
                return (248, 55, 20)
            return tuple(sum(c[i] for c in collected) // len(collected) for i in range(3))

        top_color = sample_avg(range(x0 - margin, x1 + margin), range(y0 - margin, y0))
        bottom_color = sample_avg(range(x0 - margin, x1 + margin), range(y1, y1 + margin))

        # 上下渐变填充，避免出现呆板的纯色圆块
        gradient = Image.new('RGB', (1, 2))
        gradient.putpixel((0, 0), top_color)
        gradient.putpixel((0, 1), bottom_color)
        gradient = gradient.resize((x1 - x0 + 1, y1 - y0 + 1), Image.Resampling.BILINEAR)
        eye_mask = Image.new('L', (x1 - x0 + 1, y1 - y0 + 1), 0)
        ImageDraw.Draw(eye_mask).ellipse((0, 0, x1 - x0, y1 - y0), fill=255)
        img.paste(gradient, (x0, y0), eye_mask)

        # 细眼皮弧线：左眼闭得更紧一点，右眼稍放松（不对称更自然）
        lid_width = max(2, int((x1 - x0) * 0.05))
        is_left = ex < 50
        drop = 0.74 if is_left else 0.62
        left = (x0 + int((x1 - x0) * 0.14), y0 + int((y1 - y0) * 0.42))
        right = (x1 - int((x1 - x0) * 0.14), y0 + int((y1 - y0) * 0.42))
        mid = ((left[0] + right[0]) // 2, y0 + int((y1 - y0) * drop))
        draw.line([left, mid, right], fill=(8, 38, 28), width=lid_width, joint='curve')
        # 眼皮下缘再叠一条稍浅的描边，增强“闭眼褶”的质感
        draw.line(
            [(left[0], left[1] + lid_width), (mid[0], mid[1] + lid_width), (right[0], right[1] + lid_width)],
            fill=(60, 70, 60),
            width=max(1, lid_width // 2),
            joint='curve',
        )

    # 头顶侧边加两个由小到大的“z→Z”睡眠符号（斜向上飘）
    try:
        font_small = ImageFont.load_default(size=max(16, int(width * 0.028)))
        font_big = ImageFont.load_default(size=max(24, int(width * 0.045)))
        right_eye = EYE_SPECS[1]
        zx = int((right_eye[0] + right_eye[2]) / 100.0 * width) + int(width * 0.02)
        zy = int(right_eye[1] / 100.0 * height) - int(height * 0.14)
        draw.text((zx, zy), 'z', font=font_small, fill=(214, 171, 69), stroke_width=max(1, lid_width // 3), stroke_fill=(8, 38, 28))
        draw.text((zx + int(width * 0.045), zy - int(height * 0.055)), 'Z', font=font_big, fill=(255, 247, 223), stroke_width=max(1, lid_width // 3), stroke_fill=(8, 38, 28))
    except Exception:
        pass

    return img


def lying_pose(image: Image.Image, squash: float = 0.70, lean: float = 0.16, dy: int = 0) -> Image.Image:
    """四角透视变形：上窄下宽、整体侧倾并压扁，瘫睡在画面底部。"""
    width, height = image.size
    top_w = max(1, int(width * (1 - lean)))
    bot_w = max(1, int(width * (1 - lean * 0.55)))
    bot_y = max(1, int(height * squash))
    x_off = int(width * lean * 0.30)
    dest = [
        (x_off, 0),                                    # TL
        (x_off + top_w, int(height * 0.05)),           # TR
        (x_off + bot_w, bot_y),                        # BR
        (x_off + (top_w - bot_w) // 2, bot_y),         # BL
    ]
    warped = image.transform(
        (width, height),
        Image.Transform.QUAD,
        [coord for point in dest for coord in point],
        Image.Resampling.BICUBIC,
    )
    bbox = warped.getbbox()
    if bbox:
        warped = warped.crop(bbox)

    canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    w2, h2 = warped.size
    x = (width - w2) // 2 - int(width * 0.03)
    y = height - h2 - 1 - dy
    canvas.paste(warped, (x, y), warped)
    return canvas


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

    # 睡觉姿态：闭眼 + 瘫睡贴底 + 缓慢呼吸起伏
    eyes_closed = close_eyes(sprite)
    lie_specs = [(0.68, 1), (0.72, 0), (0.70, 0), (0.71, 1), (0.69, 0), (0.72, 0)]
    lie_frames = [lying_pose(eyes_closed, sq, 0.16, d) for sq, d in lie_specs]
    save_gif(output_dir / 'red_lie_8fps.gif', lie_frames)
    lie_frames[0].save(output_dir / 'preview_sleep.png')

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
