"""Generate PNG app icons (no external deps) — a dumbbell on a slate rounded square."""
import zlib, struct, os

OUT = r"C:\Users\benja\Claude\projects\workout-tracker\public"
os.makedirs(OUT, exist_ok=True)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def draw(size):
    bg_top = (26, 42, 74)     # slate blue
    bg_bot = (11, 18, 32)
    bar = (232, 238, 247)     # near white
    plate = (79, 140, 255)    # accent blue
    px = bytearray()
    r = size * 0.16           # corner radius
    cx = cy = size / 2
    # dumbbell geometry (horizontal)
    bar_h = size * 0.10
    bar_w = size * 0.42
    plate_w = size * 0.11
    plate_h = size * 0.34
    inner_h = size * 0.22
    inner_w = size * 0.055
    for y in range(size):
        row = bytearray()
        for x in range(size):
            # rounded-rect background mask
            dx = max(r - x, x - (size - r), 0)
            dy = max(r - y, y - (size - r), 0)
            if dx * dx + dy * dy > r * r:
                row += bytes((0, 0, 0, 0))
                continue
            col = lerp(bg_top, bg_bot, y / size)
            a = 255
            fx = abs(x - cx)
            fy = abs(y - cy)
            # center bar
            if fx <= bar_w / 2 and fy <= bar_h / 2:
                col = bar
            # plates (outer)
            elif (bar_w / 2 - plate_w) <= fx <= (bar_w / 2 + plate_w) and fy <= plate_h / 2:
                col = plate
            # end caps
            elif (bar_w / 2 + plate_w) <= fx <= (bar_w / 2 + plate_w + inner_w) and fy <= inner_h / 2:
                col = bar
            row += bytes((col[0], col[1], col[2], a))
        px += b'\x00' + row
    return bytes(px)

def write_png(path, size):
    raw = draw(size)
    comp = zlib.compress(raw, 9)
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        return c + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    with open(path, 'wb') as f:
        f.write(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', comp) + chunk(b'IEND', b''))
    print('wrote', path, size)

write_png(os.path.join(OUT, 'icon-512.png'), 512)
write_png(os.path.join(OUT, 'icon-192.png'), 192)

# SVG favicon
svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="12" fill="#12203a"/>
<g fill="#e8eef7">
<rect x="18" y="28" width="28" height="8" rx="2"/>
</g>
<g fill="#4f8cff">
<rect x="14" y="21" width="7" height="22" rx="2"/>
<rect x="43" y="21" width="7" height="22" rx="2"/>
</g>
<g fill="#e8eef7">
<rect x="9" y="26" width="5" height="12" rx="2"/>
<rect x="50" y="26" width="5" height="12" rx="2"/>
</g>
</svg>'''
with open(os.path.join(OUT, 'favicon.svg'), 'w', encoding='utf-8') as f:
    f.write(svg)
print('wrote favicon.svg')
