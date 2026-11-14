# Периодическая диаграмма Вороного (numpy): R = расстояние до границы ячейки / 0.12, G и B = случайные числа ячейки
import numpy as np, sys
from PIL import Image
def cells(name, gx, gy, jit, res=1024, seed=1):
    rng = np.random.default_rng(seed); P = np.array([((i + 0.5 + rng.uniform(-jit, jit)) / gx, (j + 0.5 + rng.uniform(-jit, jit)) / gy) for j in range(gy) for i in range(gx)])
    rnd = rng.uniform(0, 1, (len(P), 2)); S = np.concatenate([P + (dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]); ids = np.tile(np.arange(len(P)), 9)
    out = np.zeros((res, res, 3), np.float32); xs = (np.arange(res) + 0.5) / res
    for y0 in range(0, res, 32):
        ys = (np.arange(y0, min(res, y0 + 32)) + 0.5) / res; X, Y = np.meshgrid(xs, ys); p = np.stack([X.ravel(), Y.ravel()], 1)
        d2 = ((p[:, None, :] - S[None, :, :]) ** 2).sum(-1); idx = np.argpartition(d2, 1, axis=1)[:, :2]; a = np.take_along_axis(d2, idx, 1)
        sw = a[:, 0] > a[:, 1]; i1 = np.where(sw, idx[:, 1], idx[:, 0]); i2 = np.where(sw, idx[:, 0], idx[:, 1]); f1 = np.minimum(a[:, 0], a[:, 1]); f2 = np.maximum(a[:, 0], a[:, 1])
        edge = (f2 - f1) / (2 * np.linalg.norm(S[i1] - S[i2], axis=1) + 1e-9)
        out[y0:y0 + len(ys)] = np.stack([np.clip(edge / 0.12, 0, 1), rnd[ids[i1], 0], rnd[ids[i1], 1]], 1).reshape(len(ys), res, 3)
    Image.fromarray((out[::-1] * 255 + 0.5).astype(np.uint8)).save(f"../out/cells_{name}.png")
cells("stone", 5, 5, 0.36, seed=3); cells("rock", 3, 7, 0.42, seed=8); print("cells ok")
