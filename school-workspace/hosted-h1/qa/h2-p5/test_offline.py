"""Small offline safety checks; no PostgreSQL/Docker/network or operating credentials."""
import json,os,pathlib,subprocess,sys,tempfile,unittest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from preflight import validate
class Offline(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory(prefix='bogunon-p5-synthetic-');self.root=pathlib.Path(self.t.name)
  for n in ['out','keys','work']:(self.root/n).mkdir(mode=0o700)
  self.key=os.urandom(32);(self.root/'keys/key').write_bytes(self.key);(self.root/'keys/pass').write_bytes(b'SYNTHETIC NOT A CREDENTIAL');os.chmod(self.root/'keys/key',0o600);os.chmod(self.root/'keys/pass',0o600)
  self.c=dict(project_ref='xxownwxxajzrviuvvfiu',approval_record='SYNTHETIC_OFFLINE_ONLY',output_root=str(self.root/'out'),key_root=str(self.root/'keys'),key_file=str(self.root/'keys/key'),db_env_file=str(self.root/'keys/pass'),cli_workdir=str(self.root/'work'),required_free_bytes=4096,max_plain_file_bytes=1024,rpo='SYNTHETIC',rto='SYNTHETIC',retention='SYNTHETIC',key_custodian='SYNTHETIC',restore_target='SYNTHETIC',snapshot_plan='SYNTHETIC')
 def tearDown(self):self.t.cleanup()
 def test_private_plan(self):self.assertEqual(validate(self.c)['offlineChecks'],'PASS')
 def test_missing_approval(self):
  self.c['approval_record']='UNASSIGNED'
  with self.assertRaises(ValueError):validate(self.c)
 def test_symlink(self):
  link=self.root/'alias';link.symlink_to(self.root/'out');self.c['output_root']=str(link)
  with self.assertRaises(ValueError):validate(self.c)
 def test_shared_permissions(self):
  os.chmod(self.root/'out',0o755)
  with self.assertRaises(ValueError):validate(self.c)
 def test_space(self):
  self.c['required_free_bytes']=2**80
  with self.assertRaises(ValueError):validate(self.c)
 def test_seal_and_no_overwrite(self):
  plan=self.root/'plan.json';plan.write_text(json.dumps(self.c));cmd=[sys.executable,str(pathlib.Path(__file__).with_name('seal.py')),str(plan),'data']
  p=subprocess.run(cmd,input=b'SYNTHETIC SQL',capture_output=True);self.assertEqual(p.returncode,0)
  f=self.root/'out/data.aesgcm.unverified';b=f.read_bytes();self.assertEqual(AESGCM(self.key).decrypt(b[:12],b[12:],b'data'),b'SYNTHETIC SQL')
  p=subprocess.run(cmd,input=b'REPLACEMENT',capture_output=True);self.assertNotEqual(p.returncode,0);self.assertEqual(f.read_bytes(),b)
if __name__=='__main__':unittest.main()
