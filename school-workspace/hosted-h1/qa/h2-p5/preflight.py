"""Offline only: filesystem/plan validation. No network, subprocess, DB or credential reads."""
import argparse,json,os,pathlib,shutil,stat
REF='xxownwxxajzrviuvvfiu'
def private_path(raw,directory=True):
 p=pathlib.Path(raw)
 if not p.is_absolute():raise ValueError('PATH_NOT_ABSOLUTE')
 for q in [p,*p.parents]:
  if q.is_symlink():raise ValueError('SYMLINK_DENIED')
 if not p.exists() or (directory and not p.is_dir()) or (not directory and not p.is_file()):raise ValueError('PATH_MISSING_OR_WRONG_TYPE')
 if os.name!='posix':raise ValueError('WINDOWS_ACL_REVIEW_REQUIRED_USE_APPROVED_POSIX_HOST')
 st=p.stat()
 if st.st_uid!=os.getuid() or stat.S_IMODE(st.st_mode)&0o077:raise ValueError('OWNER_OR_PRIVATE_MODE_INVALID')
 for q in [p if directory else p.parent,*(p.parents)]:
  if (q/'.git').exists():raise ValueError('REPOSITORY_PATH_DENIED')
 return p.resolve()
def validate(c):
 required=['project_ref','approval_record','output_root','key_root','key_file','db_env_file','cli_workdir','required_free_bytes','max_plain_file_bytes','rpo','rto','retention','key_custodian','restore_target','snapshot_plan']
 if any(k not in c or c[k] in('',None,'UNASSIGNED') for k in required):raise ValueError('APPROVAL_OR_PLAN_INCOMPLETE')
 if c['project_ref']!=REF:raise ValueError('PROJECT_MISMATCH')
 if any(k not in required for k in c):raise ValueError('UNRECOGNIZED_OR_SECRET_CONFIG_FIELD')
 out=private_path(c['output_root']);keyroot=private_path(c['key_root']);key=private_path(c['key_file'],False);pgpass=private_path(c['db_env_file'],False);work=private_path(c['cli_workdir'])
 if out==keyroot or out in keyroot.parents or keyroot in out.parents:raise ValueError('KEY_OUTPUT_OVERLAP')
 if keyroot not in key.parents or key.stat().st_size!=32:raise ValueError('AES256_KEY_FILE_INVALID')
 if out in pgpass.parents or out in key.parents:raise ValueError('CREDENTIAL_IN_BACKUP_ROOT')
 if out in work.parents or work in out.parents or out==work:raise ValueError('WORKDIR_OUTPUT_OVERLAP')
 if any(work.glob('.env*')):raise ValueError('AMBIENT_ENV_FILES_DENIED')
 size=c['required_free_bytes'];limit=c['max_plain_file_bytes']
 if type(size)!=int or type(limit)!=int or limit<=0 or size<limit:raise ValueError('SPACE_BUDGET_INVALID')
 if shutil.disk_usage(out).free<size:raise ValueError('INSUFFICIENT_APPROVED_SPACE')
 mem=pathlib.Path('/proc/meminfo')
 if not mem.exists():raise ValueError('MEMORY_BUDGET_REVIEW_REQUIRED')
 available=int(next(x.split()[1] for x in mem.read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 if available<4*limit:raise ValueError('ENCRYPTION_MEMORY_BUDGET_EXCEEDED')
 return {'offlineChecks':'PASS','operatingAccess':'NOT RUN','executionAuthorizedByTool':False,'storageEncryption':'AES256-GCM only ciphertext output; key outside output','remaining':'human approval verification, exact target/credential/tool/client inventory and restore compatibility before execution'}
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('plan');args=a.parse_args()
 try:
  # Do not print plan values, paths, credential contents or exception traces.
  result=validate(json.loads(pathlib.Path(args.plan).read_text()))
 except (ValueError,OSError,KeyError,TypeError,StopIteration):
  print(json.dumps({'offlineChecks':'BLOCKED','reason':'PLAN_OR_PRIVATE_PATH_CHECK_FAILED','operatingAccess':'NOT RUN'}));raise SystemExit(2)
 print(json.dumps(result))
