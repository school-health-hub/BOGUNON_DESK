# BOGUNON DESK

보건교사를 위한 Windows 데스크톱 워크스페이스입니다. BOGUNON과 같은 계정으로 업무·일정과 개인 화면 설정을 연결하고, 계정 없이도 공문·품의·계산기·빠른 메모 같은 로컬 도구를 사용할 수 있습니다. 학생 건강기록 시스템이 아니라 하루 동안 업무 흐름을 정리하는 개인화 작업 화면입니다.

## 주요 기능

- 직접 배치하고 크기를 조절하는 Widget Workspace와 편집 가능한 Dock
- BOGUNON 업무·일정, D-Day, 알림, Work Inbox 연동
- 수행일과 선택적 마감일을 구분하는 Quick Add
- session-only 빠른 메모와 이 PC 전용 업무 폴더 즐겨찾기
- XLSX/XLS/CSV/텍스트형 PDF를 로컬에서 다루는 품의 도우미
- PDF/HWPX 로컬 가져오기, 기본 핵심정리, BOGUNON 업무 handoff를 제공하는 공문 작업실
- 사용자가 선택적으로 연결하는 OpenAI/Gemini AI 기능
- Windows Tray, autostart, close-to-tray

## 0.2.1 공유 베타

0.2.1은 생기부 도우미, 품의 도우미, 공문 작업실의 검토·전송 lifecycle과 개인정보 보호 경계를 강화하고, exact-byte clean-install QA와 synthetic 0.2.0 updater compatibility QA를 통과한 production release입니다.

공유 artifact는 Windows 10/11 x64용 unsigned NSIS installer입니다. Tauri updater artifact는 별도 signing key로 서명되지만 Windows Authenticode 코드서명은 아직 적용하지 않아 게시자 확인 또는 SmartScreen 경고가 표시될 수 있습니다. 보안 기능을 끄지 말고 파일 제공자와 `SHA256SUMS.txt`의 체크섬을 확인하세요.

- 사용자 안내: [`docs/BETA-USER-GUIDE.md`](docs/BETA-USER-GUIDE.md)
- 개발자 release 안내: [`docs/RELEASE.md`](docs/RELEASE.md)
- 변경 내역: [`CHANGELOG.md`](CHANGELOG.md)

## 개인정보 원칙

- 공문·품의 원본 파일은 가져오기만으로 외부나 Supabase에 업로드되지 않습니다.
- 빠른 메모, 공문 작업 상태와 품의 작업 상태는 현재 앱 실행 동안만 유지됩니다.
- AI API Key는 메모리에만 보관하며 앱을 완전히 종료하면 사라집니다.
- 자동 개인정보 탐지는 보조 기능이며 모든 개인정보를 탐지하지 못할 수 있습니다. 사용자가 전송 내용을 최종 확인한 뒤에만 선택한 외부 AI 서비스로 전송됩니다.
- Supabase session은 Windows DPAPI 사용자 범위로 보호하며 `localStorage`에 token을 저장하지 않습니다.

## Widget Workspace와 설정 경계

메인 화면은 고정 대시보드가 아니라 사용자가 직접 배치하는 12-column Widget Workspace입니다. `화면 꾸미기`에서 위젯·프리셋·appearance·Dock을 편집합니다.

- Account settings: Workspace, appearance, Dock, BOGUNON·온라인 보건실·검진 도구 URL
- Device settings: 업무 폴더, 업무포털, onboarding 완료값, close-to-tray, autostart, Windows 알림
- Session-only: 빠른 메모, 공문/품의 입력과 결과, AI API Key와 연결 상태

기존 저장 키와 identifier는 유지합니다.

- `school-health-desk.dashboard-layout.v1`
- `school-health-desk.dock.v2`
- `school-health-desk.desktop-settings.v1`
- Tauri identifier `kr.sungandi.schoolhealthdesk`
- deep link `school-health-desk://auth/callback`

## 개발 실행

BOGUNON과 동일한 Supabase 프로젝트의 public client 설정을 `.env.local`에 둡니다. 실제 값과 secret/service-role key는 commit하지 않습니다.

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

```bash
npm install
npm run tauri dev
```

브라우저 UI만 확인할 때는 `npm run dev`, 프로덕션 frontend 검증은 `npm run build`를 사용합니다.

## Windows release build

```bash
npm run release:check
npm run release:windows
```

성공하면 `release-output/`에 installer, `SHA256SUMS.txt`, `README-FIRST.txt`가 생성됩니다. Production updater release와 실패 지점부터 재개하는 checkpoint/resume 절차는 [`docs/RELEASE.md`](docs/RELEASE.md)를 따릅니다.

## 라이선스

BOGUNON DESK 소스 코드는 [Apache License 2.0](LICENSE)으로 배포됩니다. 포함된 서드파티 소프트웨어와 폰트는 각각의 원 라이선스를 따르며 자세한 내용은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 확인하세요.

## MY FINANCE 개발 검증 단계

상단 `MY FINANCE` 메뉴에서 개인 수입 등록·수정·삭제와 연간 집계를 확인할 수 있습니다. 금융정보는 Windows 앱의 SQLCipher 로컬 DB에만 보관하며 계정 설정과 동기화하지 않습니다. 브라우저에서는 암호화 저장소를 사용할 수 없다는 안내를 표시합니다.

아직 실사용 준비 완료 단계가 아닙니다. 암호화 백업·복원 및 학교 PC ↔ 집 PC 검증이 끝나기 전에는 실제 금융정보를 입력하지 마세요. 현재 개발·검증에는 합성 데이터만 사용합니다.
# Windows 0.2.2 integration candidate

See [TD2 Dashboard + MY FINANCE 2.0 candidate guide](docs/TD2_FINANCE2_CANDIDATE.md)
for source identities, manual CI gates, data preservation and reference attribution.
This candidate is not permission to install or deploy.
