# Последний фонарь — исходники и сборка приложений

Сюжетная 3D-RPG: исследование пяти локаций, пошаговые бои отрядом из четырёх героев, 13 именных табличек, четыре финала.
Играть в браузере: папка [`../lantern/`](../lantern/) на GitHub Pages этого репозитория.

Одна и та же сборка работает в трёх видах:

| Вид | Что нужно | Статус |
|---|---|---|
| Сайт (GitHub Pages) | ничего | работает |
| PWA — «Добавить на главный экран» в Chrome/Safari, игра без сети после первого запуска | ничего | работает (манифест, иконки, service worker) |
| Приложение Android / iOS через [Capacitor](https://capacitorjs.com) | Android Studio / Mac с Xcode | проект подготовлен, см. ниже |

## Структура

```
lantern/                готовая игра: index.html, game.js, assets/*.glb, иконки, манифест, sw.js
lantern-app/
  src/data.js           сюжет, диалоги, карты, герои, враги, предметы, финалы
  src/battle.js         правила боя (без графики — на нём же работает симулятор баланса)
  src/gfx.js            three.js: загрузка моделей, уровни, арена, эффекты
  src/bview.js          экран боя
  src/game.js           мир, сценарии, меню, сохранения, главный цикл
  src/core.js           состояние, звук, утилиты
  src/index.html        разметка и стили
  tools/build.mjs       сборка в ../lantern и в dist/lantern.html (вся игра одним файлом)
  tools/sim.mjs         проверка данных и симуляция баланса всей кампании
  tools/assets.mjs      пересборка моделей из исходных наборов KayKit (не обязательна)
  capacitor.config.json настройки приложения (appId, имя, webDir)
  resources/icon.*      исходник иконки
```

## Сборка веб-версии

Нужен Node.js 22 или новее.

```bash
cd lantern-app
npm ci
npm run build     # пишет ../lantern и dist/lantern.html
npm run sim       # проверка карт и диалогов + симуляция всех боёв кампании (по 300 прогонов)
```

Игра не обращается к сети: движок, шрифты и модели лежат в сборке.

## Android

Нужны Android Studio (вместе с ним ставятся SDK и JDK) и Node.js 22+.

```bash
cd lantern-app
npm ci
npm run android:add   # один раз: создаёт папку android/ (в git не хранится)
npm run icons         # один раз: иконки и заставка из resources/icon.png
npm run android       # сборка игры + копирование в проект + открыть Android Studio
```

В Android Studio: кнопка ▶ ставит игру на подключённый телефон или эмулятор.
APK без Android Studio (если SDK уже установлен): `npm run apk` → `android/app/build/outputs/apk/debug/app-debug.apk`.
Для Google Play: Build → Generate Signed App Bundle, свой ключ подписи и аккаунт разработчика Google Play.

Минимальная версия Android — 7.0 (API 24), так задано шаблоном Capacitor 8.

## iOS

Нужны Mac с Xcode и Node.js 22+. На Windows и Linux собрать iOS-приложение нельзя — это ограничение Apple.

```bash
cd lantern-app
npm ci
npm run ios:add       # один раз: создаёт папку ios/
npm run icons
npm run ios           # сборка + копирование + открыть Xcode
```

В Xcode: выбрать свою команду в Signing & Capabilities, затем ▶. Бесплатный Apple ID позволяет ставить игру на свой телефон (подпись живёт 7 дней), для App Store нужна платная программа Apple Developer.

## Что уже учтено для телефонов

- сенсорное управление: плавающий джойстик, крупные кнопки, портрет и ландшафт;
- вырезы экрана: отступы через `env(safe-area-inset-*)`;
- автоподстройка графики: при низкой частоте кадров игра сама снижает разрешение и отключает свечение и тени (возвращается в настройках);
- сохранение в `localStorage` — автоматически у фонарей, после боёв и при сворачивании;
- звук и музыка синтезируются на лету (Web Audio), файлов нет.

Идентификатор приложения `io.github.emptyfoxs.lastlantern` меняется в `capacitor.config.json` — до первой команды `android:add` / `ios:add`.

## Что проверено

- `tools/sim.mjs`: все карты проходимы, ссылки диалогов и предметов целы; автобой побеждает боссов в 89–100 % прогонов.
- Автотест в браузере (Chromium, эмуляция телефона): бот проходит игру от пролога до каждого из четырёх финалов через тот же код, что и игрок.
- `npx cap add android` и `npx cap add ios` создают проекты из этой конфигурации. Сами APK/IPA здесь не собирались — для этого нужны Android SDK и Xcode.

## Авторы ресурсов

- 3D-модели и анимации — **KayKit** © [Kay Lousberg](https://www.kaylousberg.com): Character Pack: Adventurers, Character Pack: Skeletons, Dungeon Remastered, Halloween Bits. Лицензия [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- 3D-движок — [three.js](https://threejs.org), лицензия MIT.
- Шрифты Rubik и Cormorant Garamond — SIL Open Font License.
- Сюжет, тексты, код, звук и музыка написаны для этой игры.
