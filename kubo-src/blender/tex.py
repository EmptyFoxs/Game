# PNG-текстуры из ../out -> WebP в папке игры (по умолчанию ../../kubo/tex)
from PIL import Image
import os, sys
q = int(sys.argv[1]) if len(sys.argv) > 1 else 84
dst = os.environ.get("TEX", "../../kubo/tex"); os.makedirs(dst, exist_ok=True)
for n in ("stone", "rock", "grass"):
    for ch in ("color", "rm", "normal"): Image.open(f"../out/{n}_{ch}.png").convert("RGB").save(f"{dst}/{n}_{ch}.webp", quality=q + (4 if ch == "normal" else 0), method=6)
print("tex ok")
