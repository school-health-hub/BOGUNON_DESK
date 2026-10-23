import { useEffect, useRef, useState } from "react";
import { MAX_REFERENCE_PACKAGE_BYTES } from "../../official-document/referencePackage";
import type { ReferencePackageValidation } from "../../official-document/referencePackageTypes";
import { defaultReferencePackageService } from "../../official-document/referencePackageService";
import type { OfficialDocumentReferenceRepository } from "../../official-document/referenceTypes";

type PackageService = typeof defaultReferencePackageService;
type Props = {
  readonly service?: PackageService;
  readonly onRepositoryChange: (repository: OfficialDocumentReferenceRepository) => void;
  readonly onBusyChange?: (busy: boolean) => void;
};

export function OfficialDocumentPackageManager({ service = defaultReferencePackageService, onRepositoryChange, onBusyChange }: Props) {
  const [snapshot, setSnapshot] = useState(service.snapshot);
  const [preview, setPreview] = useState<ReferencePackageValidation | null>(null);
  const [mode, setMode] = useState<"session" | "persistent">("session");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const sequence = useRef(0);

  useEffect(() => {
    let active = true;
    const unsubscribe = service.subscribe(() => { if (active) setSnapshot(service.snapshot()); });
    void service.initialize().catch(() => {
      if (active) setError("저장된 참고자료를 확인하지 못했습니다. 기존 파일은 변경하지 않았습니다.");
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; sequence.current += 1; unsubscribe(); };
  }, [service]);

  useEffect(() => {
    onRepositoryChange({ list: () => service.repository.list() });
  }, [snapshot.active, service, onRepositoryChange]);

  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  const readFile = async (file: File | undefined): Promise<void> => {
    const request = ++sequence.current;
    setPreview(null);
    setError(null);
    setDeletePending(false);
    if (file === undefined) return;
    if (file.size > MAX_REFERENCE_PACKAGE_BYTES) {
      setError("JSON 파일은 최대 5MiB까지 반입할 수 있습니다.");
      return;
    }
    if (!file.name.toLocaleLowerCase("en-US").endsWith(".json")) {
      setError("JSON 패키지 파일을 선택해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const result = await service.prepare(await file.text());
      if (sequence.current === request) setPreview(result);
    } catch (failure: unknown) {
      if (!(failure instanceof Error) && typeof failure !== "string") throw failure;
      if (sequence.current === request) setError("파일을 읽지 못했습니다. 기존 참고자료는 유지됩니다.");
    } finally {
      if (sequence.current === request) setBusy(false);
    }
  };

  const activate = async (): Promise<void> => {
    if (preview?.status !== "valid") return;
    const request = ++sequence.current;
    setBusy(true);
    setError(null);
    try {
      await service.activate(preview.package, mode);
      if (sequence.current === request) setPreview(null);
    } catch (failure: unknown) {
      if (!(failure instanceof Error) && typeof failure !== "string") throw failure;
      if (sequence.current === request) setError("패키지를 반입하지 못했습니다. 기존 참고자료와 작성 중인 공문은 유지됩니다.");
    } finally {
      if (sequence.current === request) setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    const request = ++sequence.current;
    setBusy(true);
    setError(null);
    try {
      await service.remove();
      if (sequence.current === request) {
        setDeletePending(false);
        setPreview(null);
      }
    } catch (failure: unknown) {
      if (!(failure instanceof Error) && typeof failure !== "string") throw failure;
      if (sequence.current === request) setError("참고자료를 삭제하지 못했습니다. 기존 참고자료는 유지됩니다.");
    } finally {
      if (sequence.current === request) setBusy(false);
    }
  };

  const metadata = snapshot.active?.metadata;
  return (
    <section className="official-reference official-package" aria-label="로컬 참고자료 패키지">
      <header className="official-reference__header"><strong>로컬 참고자료 패키지</strong><small>{metadata ? `${metadata.packageId} · ${metadata.packageVersion}` : "NOT_CONNECTED"}</small></header>
      <p className="official-reference__notice">검토·승인된 JSON만 수동 반입합니다. 개인정보 점검은 보조 수단이며 유료 자료 복제 방지를 보장하지 않습니다.</p>
      {metadata && <dl className="official-package__metadata"><dt>출처</dt><dd>{metadata.source}</dd><dt>이용 범위</dt><dd>{metadata.usageTerms}</dd><dt>재배포 제한</dt><dd>{metadata.redistribution}</dd><dt>검토</dt><dd>{metadata.review.reviewer} · {metadata.review.reviewedAt}</dd><dt>저장</dt><dd>{snapshot.mode === "persistent" ? "이 PC에 저장됨" : "이번 실행에서만 사용"}</dd></dl>}
      {snapshot.mode === "session" && snapshot.saved && <p className="official-reference__notice">이 PC 저장본: {snapshot.savedMetadata?.packageId ?? "확인 필요"} · {snapshot.savedMetadata?.packageVersion ?? "확인 필요"}. 다음 실행에서는 저장본을 다시 사용합니다.</p>}
      <label className="official-package__file"><span>참고자료 JSON 패키지 선택</span><input type="file" accept=".json,application/json" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void readFile(file); }} /></label>
      {busy && <p role="status" className="official-reference__notice">{metadata ? "참고자료 처리 중…" : "저장된 참고자료 확인 중…"}</p>}
      {(error || snapshot.error) && <p role="alert" className="official-reference__error">{error ?? snapshot.error}</p>}
      {preview && <div className="official-package__preview">
        <p role={preview.status === "error" ? "alert" : "status"}>{preview.status === "error" ? preview.message : `반입 후보: ${preview.package.metadata.packageId} · ${preview.package.metadata.packageVersion}`}</p>
        <p>전체 {preview.report.totalRows}건 · 사용 가능 {preview.report.acceptedRows}건 · 제외 {preview.report.excludedRows}건 · 오류 {preview.report.errorCount}건 · 경고 {preview.report.warningCount}건</p>
        {preview.report.issues.length > 0 && <ul>{preview.report.issues.map((issue, index) => <li key={`${issue.row}-${index}`}>행 {issue.row}: {issue.reason}</li>)}</ul>}
        {preview.status === "valid" && <>
          {snapshot.active && <p className="official-reference__notice">{snapshot.active.contentHash === preview.package.contentHash ? "현재 사용 중인 패키지와 내용이 같습니다." : snapshot.active.metadata.packageId === preview.package.metadata.packageId ? `같은 패키지 갱신: ${snapshot.active.metadata.packageVersion} → ${preview.package.metadata.packageVersion}. 이전 버전인지 확인해 주세요.` : "다른 패키지로 전체 교체합니다."}</p>}
          <dl className="official-package__metadata"><dt>출처</dt><dd>{preview.package.metadata.source}</dd><dt>이용 범위</dt><dd>{preview.package.metadata.usageTerms}</dd><dt>재배포 제한</dt><dd>{preview.package.metadata.redistribution}</dd></dl>
          <p className="official-reference__notice">승인 목록과 해시는 내용 일치 확인용이며 발행자 인증이나 개인정보 안전성을 보증하지 않습니다.</p>
          <label><span>패키지 사용 방식</span><select disabled={busy} value={mode} onChange={(event) => setMode(event.currentTarget.value === "persistent" ? "persistent" : "session")}><option value="session">이번 실행에서만 사용</option><option value="persistent">이 PC에 저장하고 다음 실행에서도 사용</option></select></label>
          <p className="official-reference__notice">반입하면 참고자료 목록 전체를 교체합니다. 작성 중인 공문과 이미 적용한 자료는 자동 수정하지 않습니다.</p>
          <button className="official-reference__apply" type="button" disabled={busy} onClick={() => void activate()}>확인 후 패키지 반입</button>
        </>}
        <button type="button" disabled={busy} onClick={() => { sequence.current += 1; setPreview(null); }}>반입 취소</button>
      </div>}
      {(metadata || snapshot.saved) && <div className="official-package__actions">{deletePending ? <><p>참고자료 목록과 이 PC에 저장한 패키지를 삭제합니다. 작성 중인 공문은 유지됩니다.</p><button type="button" disabled={busy} onClick={() => void remove()}>확인 후 참고자료 삭제</button><button type="button" disabled={busy} onClick={() => setDeletePending(false)}>삭제 취소</button></> : <button type="button" disabled={busy} onClick={() => setDeletePending(true)}>참고자료 패키지 삭제</button>}</div>}
    </section>
  );
}
