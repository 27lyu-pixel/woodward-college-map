# Local test server that tells the browser never to cache, so edits show up on reload.
# Usage: python3 serve.py   then open http://localhost:8642
# Always serves the folder this file is in, wherever it's started from.
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


ThreadingHTTPServer(("", 8642), partial(NoCache, directory=ROOT)).serve_forever()
