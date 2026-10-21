#!/usr/bin/env python3
"""Update the frame's private shopping URL/key over ADB; no APK rebuild, no secret output."""
import argparse,json,subprocess,urllib.parse,re,tempfile,os
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--serial',required=True,help='ADB serial or Wi-Fi address:5555')
p.add_argument('--config',type=Path,required=True,help='Private JSON with endpoint, apiKey')
a=p.parse_args();c=json.loads(a.config.read_text())
allowed={'endpoint','apiKey'}
c={k:c[k] for k in allowed if k in c} if isinstance(c,dict) else c
if not isinstance(c,dict) or set(c)-allowed or not all(isinstance(v,str) for v in c.values()):p.error('Unexpected configuration fields/types')
u=urllib.parse.urlsplit(c.get('endpoint',''))
if u.scheme!='https' or not u.hostname or u.username or u.password or u.path != '/v1/shopping/dispatch' or u.query or u.fragment:p.error('endpoint must be HTTPS with path /v1/shopping/dispatch')
if not c.get('apiKey'):p.error('apiKey is required')
if any('\n' in v or '\r' in v for k,v in c.items() if k == 'apiKey'):p.error('Keys cannot contain newlines')
c['endpoint']=c['endpoint'].rstrip('/')
adb=['adb','-s',a.serial];base='/data/data/com.wesbos.homehq'
package=subprocess.check_output(adb+['shell','dumpsys package com.wesbos.homehq'],text=True)
match=re.search(r'\buserId=(\d+)',package)
uid=match.group(1) if match else ''
if not re.fullmatch(r'\d+',uid) or int(uid)<10000:raise SystemExit('Unexpected app owner')
folder=base+'/files';dest=folder+'/shopping-connection.json'
subprocess.run(adb+['shell','mkdir -p '+folder],check=True)
with tempfile.NamedTemporaryFile(mode='w',prefix='frame-shopping-',suffix='.json') as temp:
    os.chmod(temp.name,0o600)
    json.dump(c,temp);temp.flush()
    subprocess.run(adb+['push',temp.name,dest+'.new'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,check=True)
command=f'chown {uid}:{uid} {folder} {dest}.new && chmod 600 {dest}.new && mv {dest}.new {dest}'
subprocess.run(adb+['shell',command],stdout=subprocess.DEVNULL,check=True)
check=subprocess.check_output(adb+['exec-out','cat '+dest])
if json.loads(check)!=c:raise SystemExit('Configuration readback mismatch')
print('Shopping configuration saved and verified. The frame reloads it on its next refresh (within one minute).')
