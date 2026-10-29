import http.server
import socketserver
import os
import sys

PORT = 8088
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")

class WasmHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable Cross-Origin isolation if needed and correct wasm mime
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".wasm"):
            return "application/wasm"
        if path.endswith(".js"):
            return "application/javascript"
        return super().guess_type(path)

def find_open_server(start_port=8080, max_tries=20):
    for offset in range(max_tries):
        port = start_port + offset
        try:
            httpd = socketserver.TCPServer(("", port), WasmHandler)
            return httpd, port
        except OSError as e:
            # Address already in use, try next port
            continue
    raise RuntimeError(f"Could not bind to any port from {start_port} to {start_port + max_tries}")

if __name__ == "__main__":
    desired_port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    httpd, actual_port = find_open_server(desired_port)
    print("=" * 60)
    print(f"[CYBER BASTION] Web Server running at: http://localhost:{actual_port}")
    print(f"[CYBER BASTION] Serving directory: {DIRECTORY}")
    print("Press Ctrl+C to stop.")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
