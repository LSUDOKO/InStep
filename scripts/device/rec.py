import socket,sys,time
# usage: rec.py start /home/arpit/emushots/x.webm | rec.py stop
tok=open('/home/arpit/.emulator_console_auth_token').read().strip()
s=socket.create_connection(('127.0.0.1',5554),timeout=10); time.sleep(0.4); s.recv(65536); s.sendall(f'auth {tok}\n'.encode()); time.sleep(0.4); s.recv(65536)
cmd='screenrecord start --size 1280x720 --fps 12 --bit-rate 3M '+sys.argv[2]+'\n' if sys.argv[1]=='start' else 'screenrecord stop\n'
s.sendall(cmd.encode()); time.sleep(1.5); s.settimeout(1)
try: print(s.recv(65536).decode().strip()[-40:])
except Exception: print('?')
s.sendall(b'quit\n')
