#!/usr/bin/env python3
"""Start localhost with an in-memory deployer secret. Never writes the key to disk."""
import getpass
import os
from pathlib import Path
import re
import signal
import socket
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
if not sys.stdin.isatty():
    sys.exit('Run this command in an interactive terminal on your computer.')
with socket.socket() as probe:
    if probe.connect_ex(('127.0.0.1', 3000)) == 0:
        sys.exit('Port 3000 is already running. Stop that Hive server, then run this command again.')
print('Hive deployer: 0x31A9Fb923F1bcB2cEb1221dbdc06B94A6a749De2')
print('The key stays in this server process. Launches still require confirmation in the admin page.')
key = getpass.getpass('Deployer private key (hidden): ').strip()
if not key.startswith('0x'):
    key = '0x' + key
if not re.fullmatch(r'0x[0-9a-fA-F]{64}', key):
    sys.exit('Invalid private key format.')
env = dict(os.environ, PONS_MANAGED_PRIVATE_KEY=key)
check = subprocess.run(['node', '--input-type=module', '-e', "import {privateKeyToAccount} from 'viem/accounts'; try { const a=privateKeyToAccount(process.env.PONS_MANAGED_PRIVATE_KEY); if(a.address.toLowerCase()!=='0x31a9fb923f1bcb2ceb1221dbdc06b94a6a749de2')process.exit(1); } catch {process.exit(1)}"], cwd=ROOT, env=env, capture_output=True)
if check.returncode:
    sys.exit('This key does not belong to the Hive deployer.')
env.update(PONS_MANAGED_LAUNCH_ENABLED='true', PONS_APP_ORIGIN='http://localhost:3000')
print('Opening Hive at http://localhost:3000/admin?section=agents')
# The companion receives no signing key; it calls the authenticated recovery API.
worker_env = {name: value for name, value in env.items() if name != 'PONS_MANAGED_PRIVATE_KEY'}
children = []
try:
    server = subprocess.Popen(['npm', 'run', 'start', '--', '--hostname', '127.0.0.1', '--port', '3000'], cwd=ROOT, env=env, start_new_session=True)
    children.append(server)
    children.append(subprocess.Popen(['node', 'scripts/tokenization/local-worker.mjs'], cwd=ROOT, env=worker_env, start_new_session=True))
    server.wait()
except KeyboardInterrupt:
    pass
finally:
    for child in children:
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGTERM)
    for child in children:
        try:
            child.wait(timeout=8)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait()
