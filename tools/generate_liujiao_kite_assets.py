"""Create the original, local pixel-art assets for the traditional board kites.

The palette and design language are derived from the user-supplied reference:
cinnabar paper borders, cream panels, jade cloud motifs, bamboo spars and
a dark wooden whistle.  No input image is embedded or distributed.
"""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1] / 'electron' / 'vscode-pets' / 'media' / 'liujiao-kite'
ART_SIZE = 90
SCALE = 4
OUTPUT_SIZE = 180
CANVAS = ART_SIZE * SCALE

PALETTE = {
    'outline': '#472a20',
    'red': '#bb4c36',
    'red_dark': '#87352b',
    'paper': '#ead8a5',
    'paper_light': '#f5e5b4',
    'jade': '#4d8d7d',
    'jade_dark': '#2f655c',
    'yellow': '#d2a64c',
    'bamboo': '#9b7439',
    'wood': '#563225',
    'wood_light': '#935d36',
    'tail': '#304c49',
}


def pt(points):
    return [(x * SCALE, y * SCALE) for x, y in points]


def polygon(draw, points, fill, width=0, outline=None):
    draw.polygon(pt(points), fill=fill)
    if outline:
        draw.line(pt(points + [points[0]]), fill=outline, width=width * SCALE, joint='curve')


def line(draw, points, fill, width=1):
    draw.line(pt(points), fill=fill, width=width * SCALE, joint='curve')


def ellipse(draw, box, fill, outline=None, width=1):
    scaled = tuple(value * SCALE for value in box)
    draw.ellipse(scaled, fill=fill, outline=outline, width=width * SCALE)


def cloud(draw, x, y, flip=1):
    """A compact folk-cloud curl, readable after 55px downscaling."""
    line(draw, [(x, y), (x + 3 * flip, y - 3), (x + 6 * flip, y), (x + 4 * flip, y + 3), (x + 1 * flip, y + 2)], PALETTE['jade_dark'], 1)
    ellipse(draw, (x + 2 * flip - 1.5, y - 1.5, x + 2 * flip + 1.5, y + 1.5), PALETTE['jade'])


def flower(draw, x, y, radius=5):
    """A small painted rosette, based on the seven-star reference's roundels."""
    ellipse(draw, (x - radius, y - radius, x + radius, y + radius), '#a62f4b', PALETTE['outline'])
    for dx, dy in [(0, -2), (2, -1), (2, 1), (0, 2), (-2, 1), (-2, -1)]:
        ellipse(draw, (x + dx - 1.8, y + dy - 1.8, x + dx + 1.8, y + dy + 1.8), '#f0a6b6')
    ellipse(draw, (x - 1.5, y - 1.5, x + 1.5, y + 1.5), '#e8c56b')


def draw_kite(wing_mode, bob=0, with_ball=False):
    """Render the flat six-sided board kite from the reference photo.

    ``wing_mode`` is retained as an animation-state name for the pet engine;
    it only controls a tiny rigid tilt.  The board never grows wings, legs,
    eyes, or any other animal anatomy.
    """
    im = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cy = 46 + bob

    # Flat six-sided frame and paper panels; this is a board, not a bird.
    body = [(45, cy - 30), (72, cy - 8), (68, cy + 17), (45, cy + 29), (22, cy + 17), (18, cy - 8)]
    polygon(d, body, PALETTE['red_dark'], 2, PALETTE['outline'])
    inner = [(45, cy - 26), (67, cy - 6), (63, cy + 15), (45, cy + 24), (27, cy + 15), (23, cy - 6)]
    polygon(d, inner, PALETTE['paper_light'], 1, PALETTE['yellow'])
    # Red corner fields and jade cloud seals echo the painted paper borders.
    polygon(d, [(45, cy - 26), (67, cy - 6), (57, cy - 8), (45, cy - 17)], PALETTE['red'])
    polygon(d, [(23, cy - 6), (45, cy - 26), (45, cy - 17), (33, cy - 8)], PALETTE['red'])
    polygon(d, [(27, cy + 15), (45, cy + 24), (45, cy + 14), (36, cy + 8)], PALETTE['red'])
    polygon(d, [(63, cy + 15), (45, cy + 24), (45, cy + 14), (54, cy + 8)], PALETTE['red'])
    cloud(d, 38, cy - 13, 1)
    cloud(d, 52, cy - 13, -1)
    cloud(d, 34, cy + 12, 1)
    cloud(d, 56, cy + 12, -1)
    line(d, [(45, cy - 26), (45, cy + 24)], PALETTE['bamboo'], 1)
    line(d, [(23, cy - 6), (67, cy + 15)], PALETTE['bamboo'], 1)
    line(d, [(67, cy - 6), (27, cy + 15)], PALETTE['bamboo'], 1)
    # Wooden sound boxes are mounted on the face in the source object.
    for x, y in [(32, cy - 1), (45, cy + 3), (58, cy - 1)]:
        ellipse(d, (x - 6, y - 4, x + 6, y + 4), PALETTE['wood'], PALETTE['outline'])
        line(d, [(x - 3, y), (x + 3, y)], PALETTE['wood_light'], 1)

    if with_ball:
        ellipse(d, (65, cy + 9, 77, cy + 21), PALETTE['red'], PALETTE['outline'])
        line(d, [(67, cy + 12), (75, cy + 18)], PALETTE['yellow'], 1)

    angle = {'up': -2, 'mid': 0, 'down': 2}.get(wing_mode, 0)
    im = im.rotate(angle, resample=Image.Resampling.BICUBIC, center=(CANVAS / 2, CANVAS / 2), expand=False)
    return im.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)


def draw_nine_star(wing_mode, bob=0, with_ball=False):
    """A compact nine-panel star board with the reference's black/white geometry."""
    im = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cy = 45 + bob
    outer = {
        'up': [(45, cy - 31), (57, cy - 22), (73, cy - 25), (69, cy - 9), (79, cy), (69, cy + 9), (73, cy + 25), (57, cy + 22), (45, cy + 31), (33, cy + 22), (17, cy + 25), (21, cy + 9), (11, cy), (21, cy - 9), (17, cy - 25), (33, cy - 22)],
        'mid': [(45, cy - 28), (58, cy - 20), (75, cy - 18), (68, cy - 5), (81, cy), (68, cy + 5), (75, cy + 18), (58, cy + 20), (45, cy + 28), (32, cy + 20), (15, cy + 18), (22, cy + 5), (9, cy), (22, cy - 5), (15, cy - 18), (32, cy - 20)],
        'down': [(45, cy - 24), (58, cy - 17), (76, cy - 9), (68, cy + 3), (80, cy + 13), (66, cy + 14), (68, cy + 29), (56, cy + 20), (45, cy + 31), (34, cy + 20), (22, cy + 29), (24, cy + 14), (10, cy + 13), (22, cy + 3), (14, cy - 9), (32, cy - 17)],
    }[wing_mode]
    polygon(d, outer, '#17191c', 2, PALETTE['outline'])
    # White spokes echo the alternating monochrome kite panels.
    for points in [
        [(45, cy), (45, cy - 27), (57, cy - 20)],
        [(45, cy), (68, cy - 5), (75, cy)],
        [(45, cy), (68, cy + 5), (57, cy + 20)],
        [(45, cy), (45, cy + 27), (33, cy + 20)],
        [(45, cy), (22, cy + 5), (15, cy)],
        [(45, cy), (22, cy - 5), (33, cy - 20)],
    ]:
        polygon(d, points, PALETTE['paper_light'])
    # Nine round boards: eight satellites around one larger center panel.
    centers = [(29, cy - 16), (45, cy - 17), (61, cy - 16), (28, cy), (45, cy), (62, cy), (29, cy + 16), (45, cy + 17), (61, cy + 16)]
    for index, (x, y) in enumerate(centers):
        radius = 8 if index == 4 else 6
        ellipse(d, (x - radius, y - radius, x + radius, y + radius), PALETTE['red'], PALETTE['outline'])
        ellipse(d, (x - radius + 2, y - radius + 2, x + radius - 2, y + radius - 2), PALETTE['paper_light'], PALETTE['red_dark'])
        cloud(d, x - 2, y, 1 if index % 2 else -1)
    # Matching upper/lower wood whistles: both ends remain board units, not a tail.
    for y in (cy - 24, cy + 18):
        ellipse(d, (38, y, 53, y + 10), PALETTE['wood'], PALETTE['outline'])
        ellipse(d, (41, y + 2, 50, y + 6), PALETTE['wood_light'])
    if with_ball:
        ellipse(d, (67, cy + 13, 78, cy + 24), PALETTE['red'], PALETTE['outline'])
    angle = {'up': -2, 'mid': 0, 'down': 2}.get(wing_mode, 0)
    im = im.rotate(angle, resample=Image.Resampling.BICUBIC, center=(CANVAS / 2, CANVAS / 2), expand=False)
    return im.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)


def draw_seven_star(wing_mode, bob=0, with_ball=False):
    """Seven connected diamond boards, with no string or animal appendages."""
    im = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cy = 45 + bob
    # Seven repeated star units: two upper, three middle, two lower.
    centers = [(36, cy - 21), (54, cy - 21), (25, cy), (45, cy), (65, cy), (36, cy + 21), (54, cy + 21)]
    # Bamboo joining lines are visible in the reference and sit behind the paper panels.
    line(d, [(36, cy - 21), (54, cy - 21), (65, cy), (54, cy + 21), (36, cy + 21), (25, cy), (36, cy - 21)], PALETTE['bamboo'], 1)
    for index, (x, y) in enumerate(centers):
        outer = [(x, y - 12), (x + 12, y), (x, y + 12), (x - 12, y)]
        inner = [(x, y - 9), (x + 9, y), (x, y + 9), (x - 9, y)]
        polygon(d, outer, '#25242b', 2, PALETTE['outline'])
        polygon(d, inner, '#f7f1e5', 1, '#5a5760')
        # Four inked corner fields frame the flower roundel.
        for triangle in [
            [(x, y - 9), (x + 4, y - 5), (x - 4, y - 5)],
            [(x + 9, y), (x + 5, y + 4), (x + 5, y - 4)],
            [(x, y + 9), (x - 4, y + 5), (x + 4, y + 5)],
            [(x - 9, y), (x - 5, y - 4), (x - 5, y + 4)],
        ]:
            polygon(d, triangle, '#3e3a44')
        flower(d, x, y, 5 if index == 3 else 4.5)
    if with_ball:
        ellipse(d, (68, cy + 12, 79, cy + 23), PALETTE['red'], PALETTE['outline'])
    angle = {'up': -2, 'mid': 0, 'down': 2}.get(wing_mode, 0)
    im = im.rotate(angle, resample=Image.Resampling.BICUBIC, center=(CANVAS / 2, CANVAS / 2), expand=False)
    return im.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.LANCZOS)


def save_gif(name, poses, with_ball=False):
    frames = [draw_kite(pose, bob, with_ball) for pose, bob in poses]
    frames[0].save(
        ROOT / f'red_{name}_8fps.gif',
        save_all=True,
        append_images=frames[1:],
        duration=125,
        loop=0,
        disposal=2,
        transparency=0,
    )


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    save_gif('idle', [('mid', 0), ('up', -1), ('mid', 0), ('down', 1)])
    save_gif('walk', [('up', 0), ('mid', -1), ('down', 0), ('mid', 1)])
    save_gif('walk_fast', [('up', -1), ('down', 1), ('up', -1), ('down', 1)])
    save_gif('run', [('down', 0), ('up', -1), ('down', 1), ('up', 0)])
    save_gif('swipe', [('up', 0), ('up', -1), ('mid', 0)])
    save_gif('with_ball', [('mid', 0), ('up', -1), ('mid', 0)], with_ball=True)
    draw_kite('mid').resize((32, 32), Image.Resampling.LANCZOS).save(ROOT / 'icon.png')

    star_root = ROOT.parent / 'jiulian-star-kite'
    star_root.mkdir(parents=True, exist_ok=True)
    def save_star(name, poses, with_ball=False):
        frames = [draw_nine_star(pose, bob, with_ball) for pose, bob in poses]
        frames[0].save(star_root / f'red_{name}_8fps.gif', save_all=True, append_images=frames[1:], duration=125, loop=0, disposal=2, transparency=0)
    save_star('idle', [('mid', 0), ('up', -1), ('mid', 0), ('down', 1)])
    save_star('walk', [('up', 0), ('mid', -1), ('down', 0), ('mid', 1)])
    save_star('walk_fast', [('up', -1), ('down', 1), ('up', -1), ('down', 1)])
    save_star('run', [('down', 0), ('up', -1), ('down', 1), ('up', 0)])
    save_star('swipe', [('up', 0), ('up', -1), ('mid', 0)])
    save_star('with_ball', [('mid', 0), ('up', -1), ('mid', 0)], with_ball=True)
    draw_nine_star('mid').resize((32, 32), Image.Resampling.LANCZOS).save(star_root / 'icon.png')

    seven_root = ROOT.parent / 'qilian-star-kite'
    seven_root.mkdir(parents=True, exist_ok=True)
    def save_seven(name, poses, with_ball=False):
        frames = [draw_seven_star(pose, bob, with_ball) for pose, bob in poses]
        frames[0].save(seven_root / f'red_{name}_8fps.gif', save_all=True, append_images=frames[1:], duration=125, loop=0, disposal=2, transparency=0)
    save_seven('idle', [('mid', 0), ('up', -1), ('mid', 0), ('down', 1)])
    save_seven('walk', [('up', 0), ('mid', -1), ('down', 0), ('mid', 1)])
    save_seven('walk_fast', [('up', -1), ('down', 1), ('up', -1), ('down', 1)])
    save_seven('run', [('down', 0), ('up', -1), ('down', 1), ('up', 0)])
    save_seven('swipe', [('up', 0), ('up', -1), ('mid', 0)])
    save_seven('with_ball', [('mid', 0), ('up', -1), ('mid', 0)], with_ball=True)
    draw_seven_star('mid').resize((32, 32), Image.Resampling.LANCZOS).save(seven_root / 'icon.png')


if __name__ == '__main__':
    main()
