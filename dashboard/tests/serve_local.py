#!/usr/bin/env python3
"""Serve the production build on loopback only, without reverse-DNS lookup.

This is a local manual-QA helper, not a deployment or CI entry point.
"""
import argparse
import functools
import http.server
from pathlib import Path
import socketserver

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=4173)
parser.add_argument('--source', action='store_true', help='serve source rather than dist')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
root = root if args.source else root / 'dist'
if not (root / 'index.html').is_file():
    parser.error('Build missing. Run npm run build in dashboard first.')

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
with Server(('127.0.0.1', args.port), handler) as server:
    print(f'Local QA only: http://127.0.0.1:{args.port}/ serving {root}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
