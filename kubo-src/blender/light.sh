#!/bin/sh
# Запекание света уровней (трассировка лучей в Cycles). Запускать из папки blender/ после любого изменения
# уровней, островов, фонарей или травы: иначе тени в игре не совпадут с геометрией.
# Нужны: собранная игра (npm run build), playwright с Chromium, pip install bpy numpy pillow
set -e
(cd .. && npm run build && node tools/export-level.cjs)      # игра сама выгружает неподвижную геометрию уровней в ../out
RES=2048 SPP=96 GI=1024 SPPGI=192 VOX=0.4 python3 bakelight.py   # все уровни (или номера через пробел) -> ../../kubo/light и ../src/light.json
(cd .. && npm run build)                                     # вшить размеры объёмных карт и собрать игру заново
