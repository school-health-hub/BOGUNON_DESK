# Latest integration functional stability

Base: `1169db25f85f5d4ab1bfc46f06528d39b1d02ebe`.
Candidate branch: `fix/td2-functional-stability`. Integration/main are not updated.

## Existing selected-row-copy failure

On the unmodified base in a fresh worktree, school-profile-ui reports 5 PASS / 1 FAIL at the clipboard assertion. CSV preview/mapping uses TypeScript; the later adminReview operation requires the original native purchase-excel CLI. The prior presentation-only test preparation did not build it. A missing executable becomes a safe IPC STORAGE_ERROR, so the UI never calls the clipboard port. This is a test prerequisite failure, not a product clipboard or TD2 regression.

With the unchanged original Linux CLI explicitly selected (native source diff against the earlier Windows lineage is empty), all six original tests pass. No Rust/compiler is installed in the current Cloud; no global tools are installed. The Windows job builds the locked original CLI from this checkout before testing.

The test now fails early with a prerequisite instruction if CLI is missing, resolves the Windows .exe explicitly, and permits an explicit test-only executable path. The fixture has two data rows and asserts the exact selected-only native copy text (including original mapped column labels), preserving unselected-row exclusion. It retains school-change/unsaved-text and Main confirmation/error checks.

## Focused verification

Cloud: selected-row/school profile + admin domain/Preload tests; TD2 Shell/Soft Rose/quick memo + SCHOOL07 client/SCHOOL05 boundary + Instructor UI/layers tests. Counts/results are reported with the final candidate. No product, storage, security, calculation, IPC or design file changes.

Windows: reuse the existing manual all-menu job on this exact candidate branch. Build Electron + locked original Excel CLI. Run the above focused suites. The changed GUI path exercises real Renderer/Preload/Main/Rust adminReview/Windows clipboard with synthetic CSV, checks cancel does not alter clipboard, copies exactly the selected row and preserves selection and unsaved address. File picker and confirmation answers are injected into QA Main only; this is NOT a real native OS file/confirmation dialog test. No external sites are opened. Home, local task save and protected memo are additionally captured at 1280x800, 900x680 and maximized. Only QA-owned profile/clipboard/processes are used.

Prior full-menu Windows evidence: run 42246076168 at base1169 (192 captures); prior shared DB/Instructor output/TD2 evidence: run42238817387 at ec181. These are historical evidence with unchanged product boundaries, not tests rerun at the candidate SHA. No full-menu recapture, Finance native rebuild or shared DB restart is necessary for test-only changes. Existing 54 SCHOOL RPC + separate two Instructor RPC contract, production CLOSED gate, TD2 geometry and private data stores stay unchanged.

## Explicit remaining checks

Hosted Auth/production PostgREST/accounts/DB, external AI/YouTube/school networks, OS DPI125/150, native dialogs/Explorer drop, actual document output/physical print/Excel application and Portable are NOT RUN in this candidate. Prior PDF/XLSX output evidence remains tied to its original SHA. Finance SQLCipher runtime is not re-executed by this candidate; base Windows Finance editor evidence is reused only as historical unchanged-source evidence. No production activation, integration/main merge, deployment or Portable replacement.
