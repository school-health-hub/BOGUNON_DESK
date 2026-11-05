#!/usr/bin/env python3
"""Test-only fixture identity adapter; never installed or used by the product."""
import os,sys
args=sys.argv[1:]
# Frozen DB contract tests assume a superuser named postgres for fixture setup.
# Their real authenticated RPC calls use school_client and are never rewritten.
if 'exec'in args and any('bogunon-'+s+'-pg'in args for s in ['school02','school03','school04']):
 for i,v in enumerate(args[:-1]):
  if v=='-U'and args[i+1]=='postgres':args[i+1]='fixture_root'
os.execv('/usr/local/bin/docker',['docker',*args])
