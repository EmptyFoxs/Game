# Игры

Браузерные игры для телефона и компьютера. Играть: откройте сайт этого репозитория на GitHub Pages.

| Игра | Папка | Жанр |
|---|---|---|
| Последний фонарь | `lantern/` | сюжетная 3D-RPG: исследование, пошаговые бои отрядом, 4 финала; готова к сборке под Android и iOS |
| Тессеракт | `tesseract/` | 4D-головоломка: повороты 3D-среза в четвёртое измерение, сюжет, 48 уровней |
| 5D: Ветви | `5d/` | головоломка с параллельными ветвями времени: 89 уровней, ежедневный и бесконечный режимы |
| Кубо: Небесные острова | `kubo/` | 3D-платформер (three.js) с реалистичной графикой: модели и текстуры построены кодом в Blender, свет запечён трассировкой лучей; есть приложение Android |
| Кубо — первая версия | `kubo-classic/` | тот же платформер с мультяшной графикой Kenney |
| Корона Сольмара | `korona/` | стратегия-симулятор короля |
| Вентик | `ventik/` | аркада в духе Flappy Bird |

## Последний фонарь — как устроено

- `lantern/` — готовая игра (её открывает сайт); ставится на телефон как PWA и работает без сети.
- `lantern-app/` — исходники, сборка и проект Capacitor для приложений Android и iOS. Инструкция: [`lantern-app/README.md`](lantern-app/README.md).

## Кубо — как устроено

- `kubo/` — готовая игра (её открывает сайт).
- `kubo-src/` — исходники игры и скрипты Blender, которыми построены герой, предметы, фонарь и текстуры и запечён свет уровней (трассировка лучей в Cycles). Инструкция: [`kubo-src/README.md`](kubo-src/README.md).
- `kubo-app/` — приложение Android (Capacitor). APK собирается на GitHub автоматически при каждом изменении игры:
  **[скачать Kubo.apk](https://github.com/EmptyFoxs/Game/releases/download/apk/Kubo.apk)**. Подробности: [`kubo-app/README.md`](kubo-app/README.md).
- `kubo-classic/` — первая версия; сохранения у обеих версий общие.

## 5D: Ветви — как устроено

- `5d/src/engine.js` — правила, решатель (поиск в ширину) и генератор уровней.
- `5d/src/build_levels.js` — генерация уровней: случайные кандидаты фильтруются решателем по длине решения и обязательному использованию механики мира.
- `5d/src/build_html.py` — сборка игры в один файл `5d/index.html`.

Идея вдохновлена «5D Chess With Multiverse Time Travel» (Thunkspace).

## Тессеракт — как устроено

- Мир — карта высот в четырёх измерениях (X, Z, W + высота). Игрок видит 3D-срез и поворачивает его на 90°, меняя местами оси X и W (идея из Miegakure Марка тен Боша).
- `tesseract/src/engine4.js` — правила, решатель и генератор; уровень принимается, только если без шагов по оси W он нерешаем.

## Авторы ресурсов

- 3D-модели и анимации в «Последнем фонаре» — **KayKit** © Kay Lousberg ([kaylousberg.com](https://www.kaylousberg.com)): наборы Adventurers, Skeletons, Dungeon Remastered, Halloween Bits, лицензия [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- Модели и текстуры новой версии «Кубо» построены кодом в Blender специально для игры (`kubo-src/blender/`).
- 3D-модели, текстуры и небо первой версии «Кубо» (`kubo-classic/`), звуки обеих версий и робот в «5D: Ветви» — **Kenney** ([kenney.nl](https://kenney.nl)), набор «Starter Kit 3D Platformer», лицензия [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- Робот Бит в «Тессеракте» — RobotExpressive, модель Tomás Laulhé (Quaternius), правки Don McCurdy, CC0.
- Лиса Векта — Fox: модель PixelMannen (CC0); риггинг и анимации tomkranis, CC BY 4.0; конвертация @AsoboStudio и @scurest, CC BY 4.0.
- 3D-движок — [three.js](https://threejs.org), лицензия MIT.
- Шрифты Rubik, Unbounded и Cormorant Garamond — SIL Open Font License.
