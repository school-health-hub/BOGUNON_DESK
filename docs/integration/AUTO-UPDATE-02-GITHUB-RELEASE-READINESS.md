# AUTO-UPDATE-02 — GitHub 우선 배포 및 설치 검증 준비

검토일: 2026-11-23

기준: `codex/auto-update-01` / `361af61f7301e09a9aa4bef6dd11e13b0ae45737`

상태: **배포 방식 결정 PASS / 자동 설치 구현·실제 업그레이드 NOT RUN**

## 결정

공개 배포용 Windows NSIS 업데이트의 1순위는 **공개 GitHub Releases**다. 별도 유료 파일 서버를 만들지 않는다. 2 GiB 미만의 Release asset에는 GitHub가 총 저장 크기와 다운로드 대역폭 제한을 두지 않는다고 명시한다. 이 제품의 약 200 MiB NSIS는 파일당 한도 안에 있다. GitHub Actions를 사용할 경우 공개 저장소의 표준 호스팅 러너는 무료이고, 비공개 저장소의 빌드는 계정별 무료 할당량을 넘으면 과금될 수 있다. 배포 저장소·Release 생성은 승인 전 수행하지 않는다.

**비공개 1인 파일럿**은 기존 소유자 관리 비공개 Google Drive의 수동 NSIS 전달을 유지한다. 비공개 GitHub Release를 앱이 직접 자동 확인하려면 사용자 PC의 GitHub 인증이 필요하다. 개발자 `GH_TOKEN`이나 발급용 비밀을 앱에 내장하지 않는다. 향후 별도 사용자 인증 중계가 승인되지 않는 한, 비공개 파일럿에 무인 자동 업데이트를 약속하지 않는다.

과거 Tauri updater는 GitHub Release feed가 아니라 `desktop-releases` Supabase Storage의 공개 `latest.json`을 사용했다(`src-tauri/tauri.conf.json`, `scripts/updater-release-publisher-contract.mjs`). 유료 서버를 새로 도입하지 않아도 운영했던 점은 확인되지만, 기존 feed를 Electron의 메타데이터로 그대로 사용할 수는 없다.

## 현재 제품과 호환성

| 항목 | 확인 결과 |
| --- | --- |
| 현재 학교 PC 설치본 | `2.0.0-beta.5`, 내장 Source `bbd77d634dea87ed43bea98b5df84c92d9bfae0a`; 앱 EXE Authenticode `NotSigned` |
| 소스 의존성 | Electron `45.2.1`, electron-builder `26.18.0`; `electron-updater`는 lockfile에 없음 |
| NSIS 계약 | 사용자별 설치(`perMachine:false`, `allowElevation:false`), 제거 시 AppData 유지; appId `kr.sungandi.schoolhealthdesk.electronp0`, 프로필 `BOGUNON-DESK-ELECTRON-P0` |
| AUTO-UPDATE-01 | Ed25519로 별도 JSON `latest.json` 서명, 버전·크기·SHA-256 확인, 명시적 다운로드 동의. 운영 config 비활성화. 설치 API 없음 |
| electron-updater v26 | NSIS + GitHub provider 지원, Builder의 `latest.yml`(SHA-512·파일 목록)과 `app-update.yml` 사용. 베타 채널·prerelease는 명시 구성 필요 |

**두 메타데이터는 호환되지 않는다.** 기존 JSON은 `[schema,channel,version,notes,url,size,sha256]`의 Ed25519 서명이며 `latest.yml`의 포맷·SHA-512 계약과 다르다. 기존 JSON을 `electron-updater`에 넘기거나 `latest.yml`로 이름만 바꿔서는 안 된다. 현재 `verifyUpdateManifest()`는 manifest와 EXE의 동일 origin을 요구하고 `UpdateService`는 redirect를 거부한다. GitHub Release 자산의 GitHub/CDN 리디렉션을 현재 코드가 처리할 수 없으므로 **현재 구현을 GitHub에 바로 연결할 수 없다**. 이 제약을 보안 검증 비활성화로 우회하지 않는다.

권장 구현 경로는 한 검증 체계로 수렴하는 것이다. 서명 주체와 Windows 설치 검증 정책을 정한 뒤, Builder 26과 호환되는 `electron-updater` 버전을 lockfile에 고정한다. GitHub provider의 `app-update.yml`, 버전별 NSIS와 `latest.yml`을 **같은 빌드**에서 생성하고, `beta` 채널을 명시한다. 기존 앱 UI의 확인·다운로드·설치 동의 상태를 updater 이벤트에 연결한다. AUTO-UPDATE-01의 JSON 검증 엔진은 전환 기간 수동 다운로드용으로만 유지하거나 제거하며, 운영 설치 승인에 두 메타데이터를 섞지 않는다. `allowPrerelease` 사용 시 다운그레이드 허용 동작까지 버전 경계 테스트로 별도 확인한다. `publish:null`, `--publish never`와 현재 운영 config는 승인 전 유지한다.

## Windows 서명과 비용

업데이트 **메타데이터 서명**은 피드 내용의 출처를 증명하고, **Authenticode**는 Windows NSIS/EXE의 게시자와 바이트를 증명한다. 하나로 다른 하나를 대체할 수 없다. 현재 AUTO-UPDATE-01의 Ed25519 개인키는 운영에 발급·설정되지 않았고, 현재 설치 EXE는 미서명이다. 서명 검증을 끄고 자동 설치를 PASS 처리하지 않는다.

Microsoft의 현재 안내상 Azure Artifact Signing은 약 **US$9.99/월**이지만 개인 신청은 미국·캐나다로 제한된다. 한국 개인 개발자에게 바로 사용 가능하다고 가정하지 않는다. 전통적 OV 인증서는 대략 **US$150–300/년**이며 발급 자격, HSM/토큰 또는 클라우드 HSM, CI 연결 조건을 CA에서 확인해야 한다. 오픈소스 자격이 맞으면 SignPath Foundation의 무료 서명도 검토할 수 있다. 서명을 도입해도 초기 SmartScreen 경고와 학교별 정책 제한은 남을 수 있다. 인증서 구매·계정 생성은 아직 하지 않는다.

## 배포 흐름 및 채널

1. 릴리스 버전, Source SHA, 공개/베타 채널을 결정하고 이전 버전보다 높은지 확인한다.
2. 기존 appId·productName·프로필·사용자별 NSIS 계약을 유지하여 x64 NSIS를 빌드한다. Portable은 별도 다운로드이며 자동 NSIS 설치 대상이 아니다.
3. NSIS와 EXE에 Authenticode를 적용하고 게시자 이름을 고정한다. 빌드가 만든 `latest.yml`/`app-update.yml`, 파일 SHA-512·SHA-256·크기·버전을 검사한다.
4. **격리 Windows QA**에서 로컬/테스트 HTTPS feed로 발견 → 동의 → 다운로드 → 무결성·서명 확인 → 저장 작업 보호 → 설치 동의 → 재시작 → 버전·사용자 데이터 보존을 시험한다. 설치 취소, 손상, 중단, 재시도도 포함한다. 실제 학교 beta.5와 프로필은 사용하지 않는다.
5. 승인된 공개 GitHub Release에 versioned NSIS·메타데이터를 함께 게시한다. 게시 전에 동일 산출물의 SHA를 다시 확인한다. GitHub 업로드 권한은 릴리스 작업 환경에만 둔다.
6. 현재 beta.5는 updater가 없으므로, **최초 한 번** 업데이트 가능 NSIS로 수동 전환 설치한다. 기존 설치본과 프로필을 백업·검증하고 사용자 승인을 받은 뒤 진행한다. 이후 앱 안에서 업데이트 확인과 설치 동의를 제공한다.

공개 GitHub Release는 누구나 접근할 수 있다. 기존 1인 파일럿 자산은 비공개 상태로 유지한다. 공개 채널용 자산을 비공개 저장소 Release에 올린 뒤 클라이언트에 개발자 토큰을 배포하는 방식은 금지한다. 후보 승격 시 새 버전을 쓰며, 과거 자산과 메타데이터를 뒤섞거나 같은 버전 자산을 덮어쓰지 않는다. 학교 PC에서 GitHub 접속이 차단되면 자동 업데이트는 이용할 수 없고 승인된 수동 설치 안내가 필요하다.

## 선택지와 비용 판단

| 방식 | 200 MiB 이상 NSIS | 제한 파일럿 | 예상 호스팅 비용·판정 |
| --- | --- | --- | --- |
| 공개 GitHub Releases | 파일당 2 GiB 미만이면 가능 | 비공개 접근 제어에는 부적합 | Release 저장·다운로드 **US$0** 기준. 공개 배포 1순위 |
| 비공개 GitHub Releases | 가능 | 저장소 권한 있는 사용자에 한함 | 비용보다 **클라이언트 인증**이 문제. 개발자 토큰 내장 금지 |
| Vercel + 외부 저장소 | Vercel Hobby의 단일 정적 파일 제한 때문에 외부 저장소 필요 | 별도 인증 설계 필요 | 구성요소가 늘어 현재 불필요 |
| Cloudflare R2 | 가능 | 별도 접근 제어 필요 | 무료 사용량이 있으나 초과·운영 계정 관리 발생. GitHub가 부적합할 때만 검토 |
| S3 호환 저장소 | 가능 | 별도 접근 제어 필요 | 저장·요청·전송량 비용 및 계정 관리. 현재 불필요 |

예시로 220 MiB 설치본을 1명이 1회 받으면 약 0.22 GiB, 100명이 두 버전을 각 1회 받으면 약 43 GiB다. GitHub Release asset의 현재 게시된 대역폭 정책에서는 이 예시에 별도 전송 과금이 없다. Windows 인증서·CI 빌드·지원 인력 비용은 이 계산에 포함하지 않는다.

## 이번 격리 확인과 미완료 항목

- 기존 `electron-p0/tests/update-service.test.ts`: **10/10 PASS**. 합성 manifest의 변조·다운그레이드 거부, 동의 후 다운로드, 해시 손상, 취소·재시도, 비활성 feed 확인. 실제 업데이트 설치 증거는 아니다.
- 정적 계약 대조: GitHub provider/`latest.yml`과 현재 JSON이 서로 다른 형식임을 확인. 현재 동일 origin·redirect 거부 때문에 GitHub Release 직결은 **NOT RUN / 미구현**.
- 실제 NSIS 다운로드·설치·재시작, beta.5 → updater 포함 버전 전환, 사용자 데이터 비교, 학교 일반 사용자 권한 설치: **NOT RUN**. 설치 가능한 격리 환경과 서명 신뢰 경로가 마련되기 전 PASS 처리하지 않는다.
- 설치된 beta.5, 실사용 프로필, 외부 파일럿 Drive, Git의 다른 worktree는 변경하지 않았다.

## 다음 승인·진입 조건

1. 공개 GitHub Release를 허용할 시점과 공개 배포 저장소를 결정한다. 비공개 1인 파일럿은 계속 수동 설치한다.
2. Windows 서명 자격·비용을 선택하고, 서명 개인키 보관/CI 접근 통제를 승인한다. 대체 무료 경로가 실제 자격을 충족하면 우선 검토한다.
3. Builder 26용 updater 버전·베타 채널·publisher pin·설치 동의·미저장 작업 보호를 개발해 격리 NSIS 업데이트 E2E를 통과한다. 구버전과 신버전의 프로필 SHA/의미 값 비교가 필수다.
4. 설치된 beta.5의 수동 전환은 별도 백업과 사용자 설치 승인 후 수행한다.

근거: [electron-builder v26 Auto Update](https://www.electron.build/v26/docs/features/auto-update/), [v26 Publish](https://www.electron.build/v26/docs/publish/), [v26 Channels](https://www.electron.build/v26/docs/tutorials/release-using-channels/), [GitHub Releases limits](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [Microsoft Windows code-signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options).
