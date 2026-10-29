@echo off
echo ========================================================
echo Building Cyber Bastion WebAssembly Game Engine...
echo ========================================================

cargo build --target wasm32-unknown-unknown --release
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cargo build failed!
    exit /b %ERRORLEVEL%
)

if not exist web\wasm mkdir web\wasm
copy /Y target\wasm32-unknown-unknown\release\web_tower_defense_wasm.wasm web\wasm\web_tower_defense_wasm.wasm

echo ========================================================
echo [SUCCESS] WASM engine built and copied to web/wasm/!
echo Run 'python server.py' to launch the game.
echo ========================================================
