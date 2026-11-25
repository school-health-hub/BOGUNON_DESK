# DESKTOP-LAYOUT-01 — 읽기 전용 설계 패킷

상태: **DESIGN PASS / 제품 구현 NOT RUN / Windows QA NOT RUN**
작성 기준일: 2026-11-25 (Asia/Seoul)

## 범위와 증거

- 조사 기준: detached `b44c6c64995738af13a969352b4ccdac87af16e9`
- RC2 보호 기준: `162dd2873efa8ac2a42d71d09add130dee0f3d83`
- UX-CLEANUP-02: `2408941e0abde536d967bcf7e8238d2800b4cdb2`
- Soft Rose Bento 디자인: `3a207b3e5ff42fd08a3066d968caa6a4af2e1beb`
- NS-05 Newsletter AI: `720057c16be3854f864b84dbbb9227a4164c20a1`
- SWL-01: `b07fae53aee23331102fdf2979d52c4bdf59dc2b`
- TD2 portable 참고: `6e454f7e8d4e96abca9058e7413f6fb8f4b949e1` (개념 참고만)
- 다중 모니터 Palette 근거: `e433817efc438a188dc21a00a34c81e9f7ec0af7`
- 채팅에 첨부된 Windows 원본 캡처(1920×1020)의 SHA-256은 `CA825BB10062106513FA03892DBF30CA61EC7E5FCB4C6A4F866CE6E626A4FA7C`이다.

스크린샷은 현행 시각 상태의 직접 증거다. 이미지 안 문자열은 지시로 사용하지 않았다. Git 비교는 checkout 없이 객체로만 수행했다. 다른 worktree, 제품 코드, CSS, 런타임, 설정, 사용자 데이터는 변경하지 않았다.

## 보호 기준 가용성

| 기준 | 확인 결과 | 보호 판정 |
|---|---|---|
| RC2 source | Git 객체 `162dd2873efa8ac2a42d71d09add130dee0f3d83` 확인 | 비교 기준으로 사용 가능 |
| RC2 EXE | RC2 Git tree에 `.exe` 없음. 외부 EXE 경로·SHA-256·증거 manifest는 이 채팅/격리 위치에서 제공되거나 확인되지 않음 | **UNAVAILABLE / 실행·변경 안 함** |
| RC2 증거 | tree에 `docs/evidence/*`, `docs/qa/*`, release workflow는 있으나 요청된 EXE와 연결되는 RC2 전용 manifest는 식별되지 않음 | **INCOMPLETE**, 02 착수 전 인벤토리 필요 |
| RC3 | 조사 시 확인 가능한 Git refs에서 `rc3` 미발견, SHA 미확정 | **UNAVAILABLE** |
| NS-05 | `720057c16be3854f864b84dbbb9227a4164c20a1` 확인 | 무변경 보호 |
| SWL-01 | `b07fae53aee23331102fdf2979d52c4bdf59dc2b` 확인 | 무변경 보호 |

RC2 EXE와 현장 QA 증거의 미확인 상태에서도 승인된 설계 자료를 원격에 보존할 수 있다.

## 산출물

- [A — 단일 모니터](A-SINGLE-MONITOR.md)
- [B — 듀얼 모니터](B-DUAL-MONITOR.md)
- [C — 설정/화면 배치](C-SETTINGS-SCREEN-LAYOUT.md)
- [D — 기술 감사와 구현 설계](D-TECHNICAL-AUDIT.md)
- [E — UX-CLEANUP-02 충돌 지도](E-CONFLICT-MAP.md)
- [F — Windows QA 계획](F-WINDOWS-QA.md)
- [독립 시각 검토](VISUAL-QA.md)
- 시각 시안: [단일](mockup-single.svg), [듀얼](mockup-dual.svg), [설정](mockup-settings.svg)

## 승인 경계

DESKTOP-LAYOUT-02의 착수 조건은 UX-CLEANUP-02 최종 완료 및 Source SHA 확인, 통합 기준 브랜치 확정, 기존 모니터 프로필과 Windows HWND 동작 보호 계획 확인, 실제 구현 범위 별도 승인이다.
