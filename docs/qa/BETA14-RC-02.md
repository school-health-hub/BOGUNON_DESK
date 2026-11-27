# BETA14-RC-02 — beta.14 배포 준비

**CONDITIONAL.** 로컬 배포 자산 및 기존 업데이터 계약 검증은 PASS다. 실제 설치·재실행 및 Windows 설치 정책 확인은 NOT RUN이다. 게시 여부는 별도 결정 사항이다.

- 제품 Source SHA `242b03e3aa14f1c496dad9ea30b46e77d0a28608`. 기존 패키징 수정으로 `desktop-surface-protocol.js`를 포함한다. NSIS에서 추출한 ASAR의 Source SHA를 재검증했다.
- NSIS `BOGUNON-DESK-Setup-2.0.0-beta.14-x64.exe`, 215,202,558 bytes, SHA-256 `3a75ff727e2bf4edfcfdf93a0299bbfd68aadcb66c048bd8f0603b3b6de1754d`. 기존 후보를 그대로 사용했다. Authenticode는 `NotSigned`다.
- `release-electron-p0/`에 NSIS, `bogunon-update.json`, `SHA256SUMS.txt`, `RELEASE-NOTES.txt`를 준비했다. 릴리스 노트는 Dock, 시계, 신규 shared 25%와 패키징 수정을 명시한다.
- 갱신한 schema 2 beta 매니페스트는 기존 Windows 보호 저장소의 Ed25519 키로 서명했다. 설치 후보의 실제 바이트, 크기, SHA-256, URL, 서명 및 변조 거부를 beta.13 업데이트 모듈과 기존 공개키로 재확인했다. 매니페스트 SHA-256 `e6290a8c5e15528831e50ed771b5693c236e9ecc7b60ff2031a780da73f48596`. 만료 `2026-12-27T05:55:02.735Z`. 만료 뒤에는 같은 신뢰 체인으로 재서명한다.
- 피드는 `https://api.github.com/repos/school-health-hub/BOGUNON_DESK/releases`를 조회한다. 예정 자산 URL은 `https://github.com/school-health-hub/BOGUNON_DESK/releases/download/v2.0.0-beta.14/` 아래의 EXE와 `bogunon-update.json`이다. beta.14 공개 태그 조회는 404이며 beta.13은 불변 prerelease로 자산 4개와 기존 EXE digest를 확인했다.
- [RC-01 검증 결과](BETA14-RC-01.md)를 보존했다. 64개 집중 테스트, 패키징 검사 3개 및 Windows 패키지 실행 결과를 재사용했다. 격리 설치 환경이 없어 실제 beta.13 → beta.14 설치, 재실행, 데이터 복원, SmartScreen·학교 설치 정책 검증은 NOT RUN이다.
- 이 단계에서 GitHub Release나 업데이트 피드를 변경하지 않았다. 게시 승인 후 제품 SHA를 가리키는 `v2.0.0-beta.14` 불변 prerelease와 정확한 네 자산을 대조한다.
