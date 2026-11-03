# 통합 Windows Portable 실행본

제품 소스: `integration/electron-feature-baseline@9e22f7e5666ffa73afc48a03ff2c844ea67bc0c9`.
제품 소스·디자인·설정 계약은 변경하지 않았다. 별도 QA 브랜치의 기존 Windows workflow와 Portable 관측 도구를 재사용했다.

## 실행본

- Artifact: [Integrated-Portable-9e22f7e-41609316123](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41609316123/artifacts/13218936720)
- 파일: `BOGUNON-DESK-ELECTRON-P0-0.0.1-win-x64.exe`
- EXE SHA-256: `6ed9fc79c8d85e68bd43f1b33ba8acee73a2284e4cff05d97802670a7b7afb10`
- ASAR SHA-256: `fba3ef57c831ee28cd72bf82ace09ca8c4215421756a8694475efc2829782641`
- `dirty:false`, 코드 서명 `NotSigned`.
- 필수 ASAR 런타임 의존성 그래프 및 Purchase·공문·Finance native CLI 3개 포함 검사 PASS.
- Artifact의 `INTEGRATED-PORTABLE-MANIFEST.json`, `SHA256SUMS.txt`에서 제품/빌드 QA SHA와 해시를 확인한다.
- 압축을 풀어 EXE를 별도 QA 폴더에서 실행한다. Portable은 설치 프로그램이 아니다. 기존 Tauri 앱/데이터 자동 이전은 수행하지 않는다.

Windows에서 확인:

```powershell
(Get-FileHash .\BOGUNON-DESK-ELECTRON-P0-0.0.1-win-x64.exe -Algorithm SHA256).Hash
```

Artifact 보존 기간은 업로드 시점부터 14일이다. QA용 결과이며 운영 배포가 아니다.

## 빌드 조건과 남은 제품 결함

초기 run `41606939989`에서 기본 패키징이 Finance CLI의 `CreateJobObjectW` 심벌 컴파일 오류로 중단됐다. 제품 Cargo.toml의 windows-sys feature에 `Win32_Security`가 빠져 있었다.
제품 수정 없이 QA 빌드 명령에만 `--features windows-sys/Win32_Security`를 명시하여 run `41609316123`에서 동일 제품 소스의 Portable을 생성했다. Cargo.toml/Cargo.lock/암호화/DPAPI/JobObject 제품 코드는 변경하지 않았다. 이 빌드 옵션은 manifest에 기록되어 있다. 따라서 제품 기본 패키징 명령 자체의 재현성 수정은 후속 작업이다.

이후 GUI 검증은 위 EXE를 해시로 고정해 재사용했다. 재빌드·다른 실행본 대체·전체 단위 테스트 반복은 하지 않았다. 잘못 입력된 QA SHA를 guard가 차단한 run `41609254827`은 job 미실행(SKIPPED)이며 검증 근거로 사용하지 않았다.


## 실제 Windows 결과 — CONDITIONAL

실제 EXE를 일반 Windows 프로그램으로 시작한 후, 검증한 자식 PID/HWND·실행 경로·ASAR 해시와 loopback CDP를 확인했다. NSIS 런처를 Playwright electron.launch로 실행하거나 unpacked 앱으로 대체하지 않았다. 실제 Portable GUI와 브라우저/renderer 단독 E2E를 혼동하지 않는다.

아래 결과는 동일한 제품 SHA와 EXE 해시를 사용한 실행별 근거를 합쳐 기록한다. 각 run의 실패·미실행 기록은 원본 JSON에 그대로 남아 있으며, 과거 PASS를 마지막 run의 PASS로 표시하지 않는다.

| 기능/경계 | 실제 확인 | 미완료/판정 |
| --- | --- | --- |
| Portable 실행·무결성 | 실제 자식 창, 한글, Dock, sourceSha·ASAR·EXE 해시 확인 | PASS |
| Soft Rose Surface | run 41609316123에서 외곽 980×700(renderer 964×635), 1440×900(renderer 1424×835), 가로 overflow·작은 창 Dock 비겹침·내부 최하단 도달 assertion 통과 | PASS; 실제 DPI/다중 모니터는 NOT RUN |
| Quick Memo | run 41609316123 실제 입력·메모 저장 상태 확인 | PASS; 재실행 복원은 이번 배치 NOT RUN |
| 공문작업실 | 화면 진입·합성 신규 원고 편집 확인 | 파일 가져오기/ODT 실제 저장·취소 검증 NOT RUN. 네이티브 파일 대화상자 자동화 차단 및 취소 검사 선택자 오류. 제품 저장 결함으로 확정하지 않음 |
| Purchase | 화면 진입 확인 | CSV/XLSX 생성·취소 NOT RUN. 최초 QA 버튼 선택자 중복, 보완 실행은 앞선 네이티브 대화상자에 막힘 |
| Newsletter | 새 작성에서 월·학교 유형 선택 후 생성 완료 문구, 별도 승인 합성 fixture의 미리보기 경로 확인 | PNG/PDF 실제 디스크 저장 NOT RUN. 새 작성의 미리보기 assertion 미완료. pending 출력 차단의 새 GUI PASS를 주장하지 않음 |
| Finder | 합성 영상 선택·안내문 입력·라이브러리 저장 확인 | JSON 파일 생성·재가져오기 NOT RUN. 네이티브 파일명 자동화 실패. 성공 안내/디스크 저장 일치 여부 미확정 |
| 일정·업무 | run 41612483002 실제 저장·전체 Portable 재시작 후 tasks.load 및 실제 편집 버튼으로 복원 확인 | PASS |
| Inventory | 물품 등록·선택·입고 폼 진입 확인 | 입고·Purchase 전달·복원 NOT RUN. QA가 필수 유효기간을 누락해 브라우저 검증에 차단됨. 제품 재고 손실로 해석하지 않음 |
| AI | 설정 화면, API 미연결 상태 표시 확인 | 연결 해제 버튼 호출 결과 NOT RUN(선택자 오류 뒤 보완 배치는 선행 대화상자에 막힘). 유료 호출·Key/계정 사용 안 함 |
| MY FINANCE | run 41612483002 합성 수입 등록·재시작 후 복원, DB 파일이 평문 SQLite 헤더가 아님, key.dpapi 존재 확인 | 암호화 저장/재실행 PASS. 암호화 백업·별도 빈 프로필 복원 NOT RUN(파일 대화상자 차단). DPAPI 암호학 전체에 대한 독립 감사를 의미하지 않음 |
| 학교 행정·프로필 | 실제 화면, eVPN 수동 전환 시 작성 중 복무 본문 동일함 확인 | NEIS는 연결 실패 안내 표시. 실응답·학교 선택/프로필 저장·재실행 복원 미완료. 인증/학교 시스템 로그인 안 함 |
| 정상 종료 | 세 GUI run 각각 초기/재시작/Finance 별도 프로필 3단계 모두 정상 창 닫기, 자식/런처 종료·임시 추출 폴더 정리 | PASS, 단계별 잔여 0개·강제 정리 false |

전체 단위 테스트·전체 P0 suite·기존 Windows 독립 QA를 다시 실행하지 않았다. 제품의 Electron TypeScript 및 production build는 실제 Windows Portable 생성 단계에서 실행·통과했다. 루트 타입 오류 재검사는 이번 범위에 포함하지 않았다.

## 실행·증거 목록

| Run | QA SHA | 결과 |
| --- | --- | --- |
| [41606939989](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41606939989) | ad778e9b4772634a7f9d53671788eba0032a084f | 기본 패키징 Finance Windows feature 누락으로 FAIL, EXE 미생성 |
| [41609254827](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41609254827) | f45f8c00057b7770ec4de9a95aaff51e4f37760a | 예상 QA SHA 입력 오류를 guard가 차단, SKIPPED, 실제 job 미실행 |
| [41609316123](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41609316123) | f45f8c00057b7770ec4de9a95aaff51e4f37760a | Portable 생성 PASS, Surface·메모 PASS; 파일 대화상자 자동화 차단으로 job 전체 FAILURE |
| [41612483002](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41612483002) | 36f59088823baa49a952766009a696c49c87997e | 동일 EXE 재사용. 일정/Finance 저장·복원 PASS; 나머지 자동화/외부 API 차단, job FAILURE |
| [41614067772](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41614067772) | 22abd27e0640bd8733a90ee7f99426721eaac03f | 동일 EXE 재사용. 보완한 QA 도구도 공문 파일 대화상자를 조작하지 못함. 이후 동일 프로필 검사는 선행 모달에 차단, NOT RUN. 정상 실행/종료·정리 PASS, job FAILURE |

세 GUI 실행 모두 예외 뒤 다른 검사를 계속 시도하고 결과를 독립 기록했다. 선행 네이티브 모달 때문에 실행되지 않은 후속 검사는 성공/제품 결함으로 추정하지 않는다. 자동화를 추가 반복하거나 제품을 수정하지 않고 종료한다.

- [최초 GUI 증거](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41609316123/artifacts/13218947367): `ui-results.json`, `diagnostic.json`, 실제 Surface 캡처 포함. 개별 파일 해시 44개 일치.
- [일정·Finance 실제 저장/복원 증거](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41612483002/artifacts/13219124083): 개별 파일 해시 42개 일치.
- [최종 GUI 차단/정상 종료 증거](https://github.com/school-health-hub/BOGUNON_DESK/actions/runs/41614067772/artifacts/13220941117): 개별 파일 해시 38개 일치.
- 각 Artifact의 `SHA256SUMS-evidence.txt`, `ui-*-results.json`, `diagnostic.json`에 이미지·창 외곽/renderer 크기·PID/경로·정상 종료 결과를 기록했다.
- `invalid-*.png`는 PrintWindow 품질 검사에서 무효 판정된 캡처로 디자인 근거에서 제외한다. CDP로 촬영한 실제 Portable renderer PNG와 구분한다.

| Artifact ID | GitHub ZIP digest |
| --- | --- |
| 13218936720 (실행본) | eca9fe8965beef92fdee1cf73377f5712e2634c5e64c5eb2f685dfa5cbdebf07 |
| 13218947367 | eee9df81593f4a6f016c37a1cc21a2971d71a68da150dc7d1d54593ac42fb181 |
| 13219124083 | 7be117e622face12a333b8bd0767e4bd7715b02662399741f0d3feec3ae32523 |
| 13220941117 | 73c1b6c9fbff3e6ae5db664e51444aaea57a768f5dd6472bcdc7029fcab83453 |

## 보호 범위와 후속 항목

- 제품/기능/Cloud B 브랜치·기존 worktree·Tauri·Finance 데이터·운영 DB는 변경하지 않았다. main workflow 등록/변경도 하지 않고 이미 등록된 workflow의 QA 브랜치 버전을 사용했다.
- 격리 GUID 프로필·합성 입력만 사용했다. 실제 학교 계정·금융정보·학생정보·외부 AI Key/유료 호출은 사용하지 않았다. BOGUNON 계정 및 ChatGPT 계정 연결 미지원 상태는 유지했다.
- QA workflow는 contents:read/actions:read만 사용하며 배포·릴리스 publish·자동 병합이 없다.
- 아직 실제 파일 저장/취소·Finance 백업/복원·Inventory Purchase 전달이 검증되지 않아 전체 기능 PASS는 아니다. 남은 파일 흐름은 이 **동일 EXE**로 수동 Windows 집중 확인할 수 있다. 별도의 제품 수정은 재현 근거를 확보한 항목에 한정해야 한다.
- 실제 사용자 PC DPI·다중 모니터·설치/제거는 NOT RUN. Portable 결과를 설치 QA PASS로 표기하지 않는다.
- 사용 가능한 Portable 전달은 완료했으나 전체 사용자 흐름 검증은 부분 완료이므로 최종 판정은 **CONDITIONAL**이다.
