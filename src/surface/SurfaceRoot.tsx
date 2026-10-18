export function SurfaceRoot() {
  return (
    <main className="surface-shell">
      <section className="surface-card" aria-labelledby="surface-title">
        <header className="surface-header">
          <span className="surface-brand">BOGUNON DESK</span>
          <span className="surface-kind">Surface</span>
        </header>
        <div className="surface-status" role="status">
          <span className="surface-dot" aria-hidden="true" />연결되지 않음
        </div>
        <h1 id="surface-title">Surface 준비 중</h1>
        <p className="surface-description">연결이 준비되면 이곳에서 상태를 확인할 수 있습니다.</p>
        <div className="surface-empty">
          <strong>Unavailable</strong>
          <p>실제 업무 데이터가 없습니다.</p>
        </div>
        <div className="surface-actions" aria-describedby="surface-action-help">
          <button type="button" disabled>OpenMain</button>
          <button type="button" disabled>RefreshProjection</button>
        </div>
        <p id="surface-action-help" className="surface-help">아직 연결되지 않아 사용할 수 없습니다.</p>
      </section>
    </main>
  );
}
