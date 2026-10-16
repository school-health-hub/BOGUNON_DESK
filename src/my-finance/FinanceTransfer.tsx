import { useEffect, useId, useRef, useState } from "react";
import { cancelFinanceBackup, exportFinanceBackup, inspectFinanceBackup, restoreFinanceBackup, selectFinanceBackup, type FinanceSnapshot, type RestorePreview } from "./repository";
import { FinanceConfirmation } from "./FinanceConfirmation";

/** Passwords stay in this temporary form; never enter settings, events or logs. */
export function FinanceTransfer({ snapshot, onClose, onRestored, onUncertain }: { snapshot: FinanceSnapshot; onClose: () => void; onRestored: (next: FinanceSnapshot) => void; onUncertain: () => void }) {
  const [mode, setMode] = useState<"export" | "restore">("export");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [datasetConsent, setDatasetConsent] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const locked = useRef(false);
  const selectedToken = useRef<string | null>(null);
  function dispose() { const previous = selectedToken.current; selectedToken.current = null; if (previous) void cancelFinanceBackup(previous).catch(() => {}); }
  const active = useRef(true);
  const dialog = useRef<HTMLDivElement>(null);
  const title = useId();
  useEffect(() => {
    active.current = true;
    const previous = document.activeElement;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      active.current = false;
      dispose();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    if (!token) return;
    const timeout = window.setTimeout(() => {
      if (locked.current) return;
      setToken(null); setPreview(null); setDatasetConsent(false); setPassword(""); setConfirmation(false);
      setError("검사 시간이 만료되었습니다. 파일을 다시 선택해 주세요.");
      dispose();
    }, 300_000);
    return () => window.clearTimeout(timeout);
  }, [token]);
  function reset(next: "export" | "restore") {
    if (locked.current) return;
    dispose();
    setMode(next); setPassword(""); setRepeat(""); setPreview(null); setDatasetConsent(false); setToken(null); setError(null); setNotice(null);
  }
  async function work(task: () => Promise<void>, failure: string) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null); setNotice(null);
    try { await task(); } catch { if (active.current) setError(failure); }
    finally { locked.current = false; if (active.current) { setBusy(false); setPassword(""); setRepeat(""); } }
  }
  function exportFile() {
    const length = new TextEncoder().encode(password).length;
    if (length < 12 || length > 1024 || password !== repeat) { setError("비밀번호는 12~1024바이트로 입력하고 확인란과 같아야 합니다."); return; }
    const secret = password; setPassword(""); setRepeat("");
    void work(async () => {
      const saved = await exportFinanceBackup(snapshot.identity, secret);
      if (active.current) setNotice(saved ? "암호화 백업 파일을 저장했습니다. 비밀번호를 잊으면 복구할 수 없습니다." : "파일 저장을 취소했습니다.");
    }, "백업을 저장하지 못했습니다. 최신 목록과 저장 위치를 확인하고, 기존 파일과 다른 새 파일명을 선택해 주세요.");
  }
  function selectFile() {
    dispose();
    setToken(null); setPreview(null); setDatasetConsent(false); setPassword("");
    void work(async () => {
      const selected = await selectFinanceBackup();
      if (active.current) { selectedToken.current = selected; setToken(selected); if (!selected) setNotice("파일 선택을 취소했습니다."); }
      else if (selected) await cancelFinanceBackup(selected);
    }, "백업 파일을 선택하지 못했습니다. 지원하는 암호화 파일인지 확인해 주세요.");
  }
  function inspect() {
    if (!token || !password) return;
    const secret = password; setPassword(""); setPreview(null); setDatasetConsent(false);
    void work(async () => {
      const result = await inspectFinanceBackup(token, secret);
      if (active.current) setPreview(result);
    }, "백업을 검사하지 못했습니다. 비밀번호, 파일 손상 또는 지원 버전을 확인해 주세요. 현재 데이터는 변경하지 않았습니다.");
  }
  function restore() {
    if (!preview?.eligible || (preview.requiresDatasetConfirmation && !datasetConsent)) return;
    void work(async () => {
      try {
        const next = await restoreFinanceBackup(preview.token, preview.requiresDatasetConfirmation);
        if (active.current) { onRestored(next); onClose(); }
      } catch {
        if (active.current) { setPreview(null); setDatasetConsent(false); setToken(null); setConfirmation(false); setRefreshRequired(true); onUncertain(); }
        throw new Error("restore failed"); // Static marker only; never expose native error payloads.
      }
    }, "복원을 완료하지 못했습니다. 최신 목록을 새로고침해 현재 상태를 확인하고 파일부터 다시 선택해 주세요.");
  }
  return <div className="finance-modal-backdrop"><div ref={dialog} className="finance-transfer" role="dialog" aria-modal="true" aria-labelledby={title} aria-busy={busy} tabIndex={-1} onKeyDown={(e) => {
    if (confirmation) return;
    if (e.key === "Escape" && !locked.current) { e.preventDefault(); onClose(); }
    if (e.key === "Tab") {
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? [])];
      const index = controls.indexOf(document.activeElement as HTMLElement);
      e.preventDefault(); (controls[(index + (e.shiftKey ? -1 : 1) + controls.length) % controls.length] ?? dialog.current)?.focus();
    }
  }}><div inert={confirmation}>
    <span className="finance-eyebrow">LOCAL ENCRYPTED BACKUP</span><h2 id={title}>암호화 백업·안전 복원</h2>
    <p>파일에는 AES-256-GCM 암호화를 적용합니다. 비밀번호는 계정과 동기화하지 않으며, 잊으면 복구할 수 없습니다.</p>
    <div className="finance-transfer-tabs"><button type="button" aria-pressed={mode === "export"} disabled={busy || refreshRequired} onClick={() => reset("export")}>백업 내보내기</button><button type="button" aria-pressed={mode === "restore"} disabled={busy || refreshRequired} onClick={() => reset("restore")}>백업 복원</button></div>
    {error && <p role="alert" className="finance-error">{error}</p>}{notice && <p role="status" className="finance-success">{notice}</p>}
    {refreshRequired ? <p>이 창을 닫고 최신 목록을 새로고침한 뒤 다시 시작해 주세요.</p> : mode === "export" ? <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); exportFile(); }}>
      <label>백업 비밀번호<input type="password" autoComplete="new-password" maxLength={1024} value={password} disabled={busy} onChange={(e) => setPassword(e.target.value)} /></label>
      <label>비밀번호 확인<input type="password" autoComplete="new-password" maxLength={1024} value={repeat} disabled={busy} onChange={(e) => setRepeat(e.target.value)} /></label>
      <small>12바이트 이상 · 새 파일명으로 저장 · 원본 DB와 DPAPI 키는 포함하지 않습니다.</small>
      <button type="submit" className="finance-primary" disabled={busy}>암호화 파일 저장</button>
    </form> : <div className="finance-restore-steps">
      <p>① 파일 선택 → ② 비밀번호 검사 → ③ 복원 가능 여부 확인 → ④ 최종 확인</p>
      <button type="button" disabled={busy} onClick={selectFile}>{token ? "다른 백업 파일 선택" : "백업 파일 선택"}</button>
      {token && !preview && <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); inspect(); }}><p>파일을 선택했습니다. 검사는 5분 동안 유효합니다.</p><label>복원 비밀번호<input type="password" autoComplete="off" maxLength={1024} value={password} disabled={busy} onChange={(e) => setPassword(e.target.value)} /></label><button type="submit" disabled={busy || !password}>복호화 및 유효성 검사</button></form>}
      {preview && <section aria-label="복원 검사 결과"><p role="status">{preview.reason}</p><dl><div><dt>현재 revision</dt><dd>{preview.currentRevision}</dd></div><div><dt>백업 revision</dt><dd>{preview.backupRevision}</dd></div><div><dt>백업 수입</dt><dd>{preview.recordCount}건</dd></div></dl>{preview.requiresDatasetConfirmation && <div className="finance-dataset-change"><strong>최초 PC 이식 · 데이터셋 변경</strong><p>이 PC의 초기 데이터셋을 백업의 데이터셋으로 변경합니다. 백업의 revision과 history를 그대로 채택합니다.</p><dl><div><dt>현재 datasetId</dt><dd>{preview.currentDatasetId}</dd></div><div><dt>이식할 datasetId</dt><dd>{preview.backupDatasetId}</dd></div></dl><label><input type="checkbox" checked={datasetConsent} disabled={busy} onChange={(e) => setDatasetConsent(e.target.checked)} />빈 저장소의 데이터셋 변경에 동의합니다</label></div>}<button type="button" className="finance-primary" disabled={busy || !preview.eligible || (preview.requiresDatasetConfirmation && !datasetConsent)} onClick={() => setConfirmation(true)}>복원 최종 확인</button></section>}
      <p className="finance-beta-note">사용 이력이 없는 빈 저장소에서만 최초 데이터셋 이식을 허용합니다. 사용한 저장소는 같은 데이터셋의 후속 백업만 복원하며, 다른 데이터셋·오래된 백업·충돌은 차단합니다. 복원 직전에 현재 DB 안에 암호화 안전 스냅샷을 보존합니다.</p>
    </div>}
    {busy && <p role="status">로컬 암호화 작업 중입니다. 앱을 종료하지 마세요.</p>}
    <div className="finance-form-actions"><button type="button" disabled={busy} onClick={onClose}>닫기</button></div>
  </div></div>{confirmation && <FinanceConfirmation title={preview?.requiresDatasetConfirmation ? "새 PC로 최초 이식할까요?" : "검사한 백업으로 복원할까요?"} message={preview?.requiresDatasetConfirmation ? `현재 datasetId ${preview.currentDatasetId}에서 백업 datasetId ${preview.backupDatasetId}로 변경합니다. 초기 저장소의 안전 스냅샷을 먼저 보존합니다. 검사 이후 변경되면 이식을 차단합니다.` : "현재 데이터의 암호화 안전 스냅샷을 먼저 보존한 뒤 검사한 백업으로 교체합니다. 검사 이후 데이터가 변경되면 복원을 차단합니다."} confirmLabel={preview?.requiresDatasetConfirmation ? "데이터셋 변경 후 이식" : "안전 스냅샷 후 복원"} busy={busy} onCancel={() => { if (!locked.current) setConfirmation(false); }} onConfirm={restore} />}</div>;
}
