@echo off
chcp 65001 >nul
echo ========================================
echo   LockCloud-app 一键编译
echo ========================================
echo.

set DEV=D:\日常事务\码农\funkandlove\lockcloud\LockCloud-app
set BUILD=E:\englishpath\android-building\LockCloud-app

echo 开发目录: %DEV%
echo 编译目录: %BUILD%
echo.

echo [1/3] 同步代码到编译目录...
robocopy "%DEV%" "%BUILD%" /MIR /XD .dart_tool build .gradle android\build android\.gradle ios\build windows\build linux\build macos\build .idea /XF pubspec.lock /NFL /NDL /NJH /NJS /nc /ns
echo       ✓ 代码同步完成
echo.

echo [2/3] 编译 APK...
cd /d "%BUILD%"
call flutter build apk --debug
if %ERRORLEVEL% NEQ 0 (
    echo       × 编译失败！
    pause
    exit /b 1
)
echo       ✓ 编译完成
echo.

echo [3/3] 同步 APK 回开发目录...
if not exist "%DEV%\build\app\outputs\flutter-apk" mkdir "%DEV%\build\app\outputs\flutter-apk"
copy /Y "%BUILD%\build\app\outputs\flutter-apk\app-debug.apk" "%DEV%\build\app\outputs\flutter-apk\" >nul
echo       ✓ APK 已同步到: %DEV%\build\app\outputs\flutter-apk\app-debug.apk
echo.

echo ========================================
echo   完成！APK 位置:
echo   %DEV%\build\app\outputs\flutter-apk\app-debug.apk
echo ========================================
echo.
pause
