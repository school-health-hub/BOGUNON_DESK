#!/usr/bin/env python3
"""Offline verification of an already extracted handoff directory."""
import json,hashlib,sys
from pathlib import Path,PurePosixPath
root=Path(sys.argv[1]if len(sys.argv)>1 else'.').resolve()
m=json.loads((root/'PACKAGE_MANIFEST_SHA256.json').read_text())
for f in m['files']:
 p=PurePosixPath(f['path']);assert not p.is_absolute()and'..'not in p.parts,p
 path=root.joinpath(*p.parts);assert path.is_file()and not path.is_symlink(),p
 assert hashlib.sha256(path.read_bytes()).hexdigest()==f['sha256'],p
print('PASS SHA-256',len(m['files']),'files; Source',m['source_sha'])
