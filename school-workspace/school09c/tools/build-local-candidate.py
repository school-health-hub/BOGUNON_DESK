from pathlib import Path
E=Path(__file__).resolve().parents[1];m=next((E/'supabase/migrations').glob('*.sql'))
m.write_text(''.join((E/'sql'/p).read_text()+'\n'for p in ['candidate-guard.sql','auth-bridge.sql','bootstrap-control.sql'])+'COMMIT;\n')
print('Built existing CLI-named LOCAL candidate; public54 contract unchanged; no DB/network operation')
