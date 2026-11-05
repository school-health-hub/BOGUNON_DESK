"""Usage: python3 verify_package.py EXTRACTED_ROOT. Read-only SHA-256 verification."""
from pathlib import Path,PurePosixPath
import sys,json,hashlib
root=Path(sys.argv[1]).resolve();manifest=json.loads((root/'PACKAGE_MANIFEST_SHA256.json').read_text())
for name,digest in manifest['files'].items():
 rel=PurePosixPath(name);assert not rel.is_absolute()and'..'not in rel.parts,name
 p=root.joinpath(*rel.parts);assert p.is_file()and not p.is_symlink(),name
 assert p.resolve().is_relative_to(root),name
 assert hashlib.sha256(p.read_bytes()).hexdigest()==digest,name
actual={p.relative_to(root).as_posix()for p in root.rglob('*')if p.is_file()and p.name!='PACKAGE_MANIFEST_SHA256.json'}
assert actual==set(manifest['files']),('Missing/extra files',actual^set(manifest['files']))
print('SHA-256 VERIFIED',len(actual),'files; source',manifest['source_sha'])
