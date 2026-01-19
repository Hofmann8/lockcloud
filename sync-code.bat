@echo off
chcp 65001 >nul

set DEV=D:\日常事务\码农\funkandlove\lockcloud\LockCloud-app
set BUILD=E:\englishpath\android-building\LockCloud-app

echo 同步代码到编译目录...
robocopy "%DEV%" "%BUILD%" /MIR /XD .dart_tool build .gradle android\build android\.gradle ios\build windows\build linux\build macos\build .idea /XF pubspec.lock /NFL /NDL /NJH /NJS /nc /ns
echo ✓ 同步完成
