#!/bin/sh
# Полная пересборка графики. Запускать из папки blender/. Нужны: pip install bpy numpy pillow
# Время на 2 ядрах CPU: набор предметов ~4,5 мин, фонарь ~1,5 мин.
set -e
mkdir -p ../out ../../kubo/models
python3 cells.py                                  # карты ячеек для камня и скал
python3 tiles.py                                  # бесшовные текстуры: камень, скала, трава
python3 tex.py                                    # PNG -> WebP в ../../kubo/tex
RES=2048 AO=16 python3 kitbake.py                 # герой, монета, блоки, платформы -> ../out/kit_raw.glb
RES=1024 AO=16 python3 lamplow.py                 # фонарь -> ../out/lamp_low.glb
cp ../out/kit_raw.glb ../../kubo/models/kit.glb
cp ../out/lamp_low.glb ../../kubo/models/lamp.glb
echo done
