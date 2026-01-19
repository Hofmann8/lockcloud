@echo off
chcp 65001 >nul

set DEV=D:\日常事务\码农\funkandlove\lockcloud\LockCloud-app
set BUILD=E:\englishpath\android-building\LockCloud-app

echo [1/2] 编译 APK...
cd /d "%BUILD%"
call flutter build apk --debug
if %ERRORLEVEL% NEQ 0 (
    echo × 编译失败！
    pause
    exit /b 1
)
echo ✓ 编译完成

echo [2/2] 同步 APK 回开发目录...
if not exist "%DEV%\build\app\outputs\flutter-apk" mkdir "%DEV%\build\app\outputs\flutter-apk"
copy /Y "%BUILD%\build\app\outputs\flutter-apk\app-debug.apk" "%DEV%\build\app\outputs\flutter-apk\" >nul
echo ✓ APK: %DEV%\build\app\outputs\flutter-apk\app-debug.apk
