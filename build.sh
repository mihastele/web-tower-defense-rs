#!/usr/bin/env bash
set -e

echo "Building Cyber Bastion WebAssembly Game Engine..."
cargo build --target wasm32-unknown-unknown --release
mkdir -p web/wasm
cp -f target/wasm32-unknown-unknown/release/web_tower_defense_wasm.wasm web/wasm/web_tower_defense_wasm.wasm
echo "[SUCCESS] WASM engine built and copied to web/wasm/!"
echo "Run 'python server.py' to launch the game."
