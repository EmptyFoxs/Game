#!/bin/bash
# Проверка APK на эмуляторе Android (запускается из .github/workflows/kubo-apk-test.yml):
# ставит приложение, открывает, запускает первый уровень, дважды жмёт «назад» (пауза, продолжить) и снимает экран на каждом шаге.
set -x
mkdir -p smoke
adb install -r Kubo.apk || exit 1
# системная подсказка «Viewing full screen» перекрывает экран и перехватывает «назад» — отключаем её
adb shell settings put secure immersive_mode_confirmations confirmed
SIZE=$(adb shell wm size | grep -o '[0-9]*x[0-9]*' | tail -1); W=${SIZE%x*}; H=${SIZE#*x}
echo "screen ${W}x${H}" > smoke/info.txt
# На эмуляторе без видеокарты системная оболочка иногда «не отвечает» и закрывает экран своим окном — нажимаем в нём «Wait»
dismiss() {
  if adb shell dumpsys window | grep -q "Application Not Responding"; then
    echo "ANR dialog dismissed before $1" >> smoke/info.txt
    adb shell input tap $((W * 30 / 100)) $((H * 566 / 1000)); sleep 3
  fi
}
sleep 30
adb logcat -c
adb shell am start -W -n io.github.emptyfoxs.kubo/.MainActivity || exit 1
sleep 75
dismiss menu; dismiss menu
adb exec-out screencap -p > smoke/1-menu.png
# кнопка первого уровня — верхняя в списке (на экране 1080x2400 её центр на 37 % высоты)
adb shell input tap $((W / 2)) $((H * 37 / 100))
sleep 40
dismiss level
adb exec-out screencap -p > smoke/2-level.png
adb shell input keyevent 4
sleep 6
dismiss pause
adb exec-out screencap -p > smoke/3-back-pause.png
adb shell input keyevent 4
sleep 6
dismiss resume
adb exec-out screencap -p > smoke/4-back-resume.png
adb shell dumpsys activity activities | grep -E "ResumedActivity" >> smoke/info.txt
adb shell dumpsys package io.github.emptyfoxs.kubo | grep -E "versionName|versionCode" >> smoke/info.txt
adb shell dumpsys webviewupdate | grep -i -E "current webview package|version" | head -3 >> smoke/info.txt
adb logcat -d -v brief | grep -E "Capacitor|chromium|AndroidRuntime|io.github.emptyfoxs" | tail -150 > smoke/logcat.txt
ls -l smoke
exit 0
