@echo off
title C2C Chrome Debug Launcher
echo ======================================================================
echo           DANG KHOI DONG CHROME DEBUG (PORT 9222)
echo ======================================================================

:: 1. Kiem tra xem port 9222 da co san chua
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:9222/json/version' -TimeoutSec 1; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [THONG BAO] Chrome Debug port 9222 da dang chay san tren may!
    goto :success
)

echo Dang mo Chrome tren cong 9222 voi profile tai C:\c2c\chrome-profile...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\c2c\chrome-profile" --no-first-run --no-default-browser-check https://chat.deepseek.com https://muse.ai

:: 2. Cho toi da 5 giay de kiem tra port
powershell -NoProfile -Command "for ($i = 0; $i -lt 10; $i++) { try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:9222/json/version' -TimeoutSec 1; exit 0 } catch { Start-Sleep -Milliseconds 500 } }; exit 1" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    goto :success
) else (
    echo [CANH BAO] Chrome dang khoi dong, vui long kiem tra cua so trinh duyet tren man hinh.
    goto :done
)

:success
echo [THANH CONG] Chrome Debug da san sang tren cong 9222!

:done
echo ======================================================================
echo Luu y: Vui long dang nhap DeepSeek va Muse tren cua so Chrome vua mo.
echo Du lieu session se duoc luu lai tai C:\c2c\chrome-profile.
echo ======================================================================
echo Nhan phim bat ky de dong cua so console nay...
pause >nul
