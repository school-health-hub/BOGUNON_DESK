"""Replay frozen SCHOOL08 scenarios without writing to any old-stage evidence.
No source migrations are edited, regenerated or copied over protected versions.
"""
from pathlib import Path
import os,runpy
E=Path(__file__).resolve().parents[1]; R=E.parent/'school08'
s=(R/'tests/install.py').read_text()
s=s.replace("R=Path(__file__).resolve().parents[1];REPO=R.parents[1]",f"R=Path({str(R)!r});E=Path({str(E)!r});REPO=R.parents[1]")
s=s.replace('bogunon-school08-pg','bogunon-school09-pg')
s=s.replace("(R/'evidence/", "(E/'evidence/")
s=s.replace("['run'](R,REPO,D,NAME,ENV,sql)","['run'](E,REPO,D,NAME,ENV,sql)")
s=s.replace("str(R/'tests/reused.py')","str(E/'tests/reused.py')")
s=s.replace("runpy.run_path(str(R.parent/'school07/tests/postgrest.py'))['run'](sql,case,R,D,NAME,ENV)","# Replaced by expanded SCHOOL09 real PostgREST suite below.")
s=s.replace("# actual PostgREST7;", "runpy.run_path(str(E/'tests/audit.py'))['run'](sql,case,E,d)\n# actual PostgREST7;")
s=s.replace("# Additional Main/BFF/UI integration scripts", "runpy.run_path(str(E/'tests/rest.py'))['run'](sql,case,E,D,NAME,ENV)\n# Additional Main/BFF/UI integration scripts")
os.environ['SCHOOL08_FLOW']='0';os.environ['SCHOOL08_BROWSER']='0'
exec(compile(s,'<frozen SCHOOL08 installer + evidence redirection + SCHOOL09 probes>','exec'),{'__name__':'__main__','__file__':str(R/'tests/install.py')})
