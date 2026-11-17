# BRAND-01 BOGUNON DESK 공식 로고 인계

## 판정

- 브랜드 자산·제품 연결: **PASS**
- Electron Windows GUI: **PASS WITH CONDITIONS**
- Windows 설치 파일/Portable 패키징: **NOT RUN**
- Tauri native 실행·패키징: **NOT RUN**
- 운영 배포·main 병합: **NOT RUN**

공식 로고는 Workspace, Dock 홈, Settings 앱 정보, 시작 안내, 공문작업실, Electron BrowserWindow/Tray, Tauri/Windows 패키징 리소스와 favicon에 연결했다. 업무 로직, 사용자 데이터, Dock 동작, Palette 위치, 멀티모니터 프로필은 변경하지 않았다.

## 1. 공식 원본과 무결성

- 사용자 첨부 원본: `codex-clipboard-00c4c0fd-5d1c-4c0d-bcba-6a0ede155c20.png`
- 보존본: `src/branding/assets/bogunon-desk-logo-original.png`
- 크기/형식: 2172×724, RGB PNG
- SHA-256: `73f26c85b6a5b463828a28afe668c7e5e4ecf493a2da8b6cd2912edc70720537`
- 투명도: 원본에는 alpha 채널이 없다. 연한 민트·화이트 배경을 임의 제거하거나 투명하다고 표시하지 않았다.

`scripts/brand01-assets.py`는 위 SHA, 크기, RGB 형식이 일치할 때만 실행되며 고정 crop과 LANCZOS 리샘플링으로 자산을 재현한다. 세부 SHA-256 목록은 `src/branding/assets/brand01-manifest.json`에 있다.

## 2. 파생 자산

- 전체 원본: `bogunon-desk-logo-original.png`
- 가로 워드마크: `bogunon-desk-wordmark.png` (2030×440)
- 심볼 master: `bogunon-desk-symbol.png` (360×360)
- 심볼 PNG: 16, 24, 32, 48, 64, 128, 256px
- Windows ICO: 16, 24, 32, 48, 64, 128, 256px 7개 frame
- Tauri/Windows Store icon family: `src-tauri/icons/*`
- ICNS: 1024px 기반으로 재생성

심볼과 워드마크는 원본의 여백만 잘랐으며 형태, 색, 글자 배열, 비율을 바꾸지 않았다.

## 3. 제품 적용 위치

- Electron `BrowserWindow.icon`: `build/electron-p0-app/app-icon.png`
- Electron tray: `build/electron-p0-app/tray.png`
- Electron builder Windows icon: `src-tauri/icons/icon.ico`
- Tauri icon/Windows 리소스: `src-tauri/icons/*`
- Workspace 공통 헤더: 가로 로고, 1000px 이하 심볼
- Dock 홈: 공식 B 심볼. BOGUNON 외부 기능과 모듈별 Lucide 아이콘은 유지
- Electron Settings 앱 정보, 공통 Settings 헤더/앱 정보
- 시작 안내(Onboarding)
- 공문작업실 제품 표시
- Tauri/Vite와 Electron renderer favicon

공통 `BrandLogo`/`BrandSymbolIcon`을 사용하므로 화면마다 로고를 별도로 재구성하지 않는다.

## 4. 실제 Windows 화면 검증

격리 Electron QA 프로필만 사용했다. 운영 프로필과 기존 실행 앱은 변경하거나 종료하지 않았다.

- 제목 표시줄: 공식 B 심볼 표시 확인
- Workspace: 1440×900 가로 로고 확인
- 980×700: 심볼 전환, 헤더 충돌 없음
- Dock: 홈 아이콘의 공식 심볼과 작은 크기 식별성 확인
- Settings 앱 정보: 가로 로고, 비율·CJK 텍스트 배치 확인
- 공문작업실: Main 앱 내부 공식 심볼과 기존 업무 UI 확인
- 밝은 배경: PASS
- 어두운 제품 테마: 현재 지원 상태가 없어 **NOT APPLICABLE / NOT RUN**. Windows의 어두운 native title bar에서는 심볼이 식별됐지만 이를 별도 dark theme QA로 간주하지 않는다.
- Windows 작업 표시줄/Alt+Tab: 런타임 `BrowserWindow`가 비어 있지 않은 256×256 공식 icon을 로드하고 제목 표시줄에서 확인했다. OS 전환 UI의 독립 증거 캡처는 **REVIEW**다.
- 기존 Alt+Tab 유령 항목: 이번 변경의 신규 결함으로 판정하지 않았다.

### 비식별 화면 증거

- `docs/evidence/brand01/workspace-1440x900.png`
- `docs/evidence/brand01/workspace-980x700.png`
- `docs/evidence/brand01/settings-about-1440x900.png`
- `docs/evidence/brand01/official-document-980x700.png`

Settings 화면의 로컬 QA 경로는 캡처 단계에서 `[격리 QA 경로 비식별 처리]`로 바꾼 증거 사본이다. 제품 소스나 저장 데이터는 바꾸지 않았다.

## 5. 구형 로고 잔존 조사

- 실제 참조되는 Tauri/Electron Windows icon family는 모두 공식 심볼로 교체했다.
- `public/vite.svg`, `src/assets/react.svg`는 코드에서 참조되지 않는 기본 템플릿 파일이며 BOGUNON의 구형 제품 로고가 아니다. 브랜드 자산으로 사용하지 않았고 불필요한 파일 삭제도 하지 않았다.
- 모듈별 기능 아이콘은 제품 브랜드와 구분해 유지했다.

## 6. 빌드·테스트

- `python scripts/brand01-assets.py <approved-source>`: PASS
- ICO frame 검증: 7 sizes PASS
- `vitest` BRAND/Dock/Onboarding 집중 검사: 3 files, 15 PASS
- TypeScript root: PASS
- TypeScript Electron renderer/main: PASS
- `npm run build`: PASS
- `npm run electron:p0:build`: PASS
- `playwright ... brand01.e2e.ts`: PASS
- `git diff --check`: PASS
- Electron QA 정상 종료: 주 검증 실행과 Playwright 실행은 정상 종료. 최초 QA root 누락으로 실패한 창 없는 전용 Electron 보조 프로세스 4개는 BRAND-01 경로/PID를 재확인한 뒤 종료했으며 운영 앱은 유지
- Electron Portable/NSIS 패키징: NOT RUN (C: 여유 공간이 약 2.2GB로 낮아 대형 패키징 산출물을 생성하지 않음)
- Cargo/Tauri native build: NOT RUN

## 7. Git·보호 상태

- 기준 제품 Source SHA: `19daed8689e6e06000d6d7367525b89d6abeca53`
- 작업 브랜치: `codex/brand-01-official-logo`
- 최종 Git HEAD: 이 문서를 포함하는 체크포인트 commit은 자기 자신의 SHA를 문서 안에 고정할 수 없으므로 최종 실행 보고의 remote HEAD를 기준으로 한다.
- UX-08, NS-05, Newsletter, 기존 main과 다른 worktree는 수정하지 않았다.
- 운영 앱·사용자 데이터·멀티모니터 프로필 영향: 없음
- push/remote divergence: 체크포인트 push 후 최종 실행 보고에 기록한다.

## 8. 잔여 검증

1. 실제 Portable/NSIS를 생성한 뒤 설치/Portable EXE, 작업 표시줄, Alt+Tab, 바로가기, 제거 프로그램 icon을 독립 확인한다.
2. Tauri 배포 경로가 계속 유지된다면 native 실행과 Windows title/taskbar/tray를 별도 확인한다.
3. Windows icon cache에 구형 표시가 남으면 새 리소스 미반영과 cache 잔존을 구분한다. cache 삭제를 BRAND-01 작업이 임의 수행하지 않는다.
