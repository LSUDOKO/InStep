import socket, sys, os, time
# usage: emu-key.py KEY_ENTER KEY_DOWN sleep:1 KEY_BACK ...   (Linux input key names; press+release)
tok=open(os.path.expanduser('~/.emulator_console_auth_token')).read().strip()
s=socket.create_connection(('127.0.0.1',5554),timeout=15)
def rd(wait=0.25):
    time.sleep(wait); s.settimeout(1); buf=b''
    try:
        while True:
            c=s.recv(65536)
            if not c: break
            buf+=c
    except Exception: pass
    return buf.decode(errors='replace')
rd(); s.sendall(f'auth {tok}\n'.encode()); rd()
for k in sys.argv[1:]:
    if k.startswith('sleep:'): time.sleep(float(k[6:])); continue
    s.sendall(f'event send EV_KEY:{k}:1\n'.encode()); r1=rd(0.08)
    s.sendall(f'event send EV_KEY:{k}:0\n'.encode()); r2=rd(0.08)
    print(k, 'ok' if 'OK' in r1 and 'OK' in r2 else (r1+r2).strip()[-120:]); time.sleep(0.5)
s.sendall(b'quit\n')
