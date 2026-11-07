"""Offline encryption filter, no DB execution. Ciphertext is UNVERIFIED until producer succeeds."""
import argparse,hashlib,json,os,pathlib,sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from preflight import validate
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('plan');p.add_argument('name',choices=['roles','schema','data','history-schema','history-data']);a=p.parse_args();tmp=None
 try:
  c=json.loads(pathlib.Path(a.plan).read_text());validate(c)
  limit=c['max_plain_file_bytes'];data=sys.stdin.buffer.read(limit+1)
  if not data or len(data)>limit:raise ValueError('EMPTY_OR_TOO_LARGE')
  key=pathlib.Path(c['key_file']).read_bytes();nonce=os.urandom(12)
  ciphertext=nonce+AESGCM(key).encrypt(nonce,data,a.name.encode())
  # O_EXCL prevents overwrite; no plaintext files, default key or key generation.
  tmp=pathlib.Path(c['output_root'])/(a.name+'.aesgcm.unverified')
  fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'wb')as f:f.write(ciphertext);f.flush();os.fsync(f.fileno())
  print(json.dumps({'name':a.name,'state':'UNVERIFIED_PRODUCER_AND_RESTORE','plainBytes':len(data),'plainSha256':hashlib.sha256(data).hexdigest(),'cipherBytes':len(ciphertext),'cipherSha256':hashlib.sha256(ciphertext).hexdigest()}))
 except Exception:
  # No raw exception/SQL/credential/paths are logged; candidate ciphertext remains unverified.
  print('{"state":"FAIL","reason":"SEAL_OR_OFFLINE_CHECK_FAILED"}',file=sys.stderr);raise SystemExit(2)
