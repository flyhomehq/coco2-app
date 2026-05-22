@echo off
chcp 65001 >nul
cd /d "%~dp0server"
title CockpitOS 서버 (이 창 닫지 마세요)
echo.
echo ==========================================
echo   CockpitOS 서버를 켜는 중입니다...
echo   이 검은 창은 닫지 마세요!
echo ==========================================
echo.
echo   서버가 켜지면 브라우저에서 열 주소:
echo   http://localhost:3000
echo.
npm start
echo.
echo 서버가 꺼졌습니다. 아무 키나 누르면 창이 닫힙니다.
pause >nul
