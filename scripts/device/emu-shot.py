import socket, sys, os, time
tok=open(os.path.expanduser('~/.emulator_console_auth_token')).read().strip() if os.path.exists(os.path.expanduser('~/.emulator_console_auth_token')) else ''
s=socket.create_connection(('127.0.0.1',5554),timeout=15)
def rd(wait=0.4):
    time.sleep(wait); s.settimeout(2); buf=b''
    try:
        while True:
            c=s.recv(65536)
            if not c: break
            buf+=c
    except Exception: pass
    return buf.decode(errors='replace')
print(rd()[-120:])
if tok:
    s.sendall(f'auth {tok}\n'.encode()); print('auth:', rd()[-60:].strip())
s.sendall(f'screenrecord screenshot {sys.argv[1]}\n'.encode()); print('shot:', rd(1.5).strip()[-200:])
s.sendall(b'quit\n')
