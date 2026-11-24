# INT-SWL-03 배포 전 최종 점검

- 날짜: 2026-11-24 (Asia/Seoul)
- 브랜치: `codex/int-swl-02-beta10-integration`
- 시작 HEAD: `cfa4d98590493f6c1157d2f6bf6034170b22c2ed`
- 기존 검증 제품 Source SHA: `830e5f072e7b3fbd7e2afe77b893d1e56d1ddea8`
- 판정: **PASS — 다음 제품 버전 후보 준비 가능**

## 원인

실패한 테스트는 제품의 120초 부모 프로세스 대기나 분리 실행 실패가 아니었다. Windows PowerShell 부트스트랩, 합성 EXE 버전 조회, 분리 helper 시작, 결과 파일 폴링을 모두 Vitest 기본 5초 안에 완료해야 했고, 이전 실행은 5.087초에서 테스트 자체가 종료됐다.

동일 시나리오를 한 번만 20초 예산으로 실행한 결과 helper는 `installer-exit-failed`를 3.966초에 정상 기록했다. 합성 installer인 `whoami.exe /S`도 별도 측정에서 55ms, exit code 1로 종료됐다. 따라서 장기 대기·무한 프로세스가 아니라 Windows 프로세스 기동 편차에 비해 테스트 예산이 너무 좁은 것이 원인이다.

## 최소 수정

제품 코드, helper bootstrap, updater 수명주기는 변경하지 않았다. 첫 Windows handoff 테스트에만 이미 같은 파일의 부모 종료 시나리오가 사용하는 12초 timeout을 적용했다. 결과 상태를 기다리는 내부 폴링 한도와 실제 제품의 120초 부모 대기 계약은 그대로다.

## 검증

- 수정 전: 동일 케이스 `Test timed out in 5000ms`, 관측 5.087초
- 원인 확인: 동일 케이스 20초 예산에서 3.966초 PASS, 기대 결과 `installer-exit-failed`
- 수정 후 관련 회귀: 10 test files PASS, 1 skipped; 79 PASS, 1 skipped
- 포함 범위: update installer/service/UI/isolated NSIS, Desktop Palette/preload/surface/layout, tray lifecycle, Smart Launcher store/IPC
- Electron tests TypeScript: PASS
- `git diff --check`: PASS

기존 SWL 109 PASS와 1440×900, 980×700, 900×680 GUI 증거는 재사용했다. 실제 사용자 데이터, 학교 PC 설치본, NSIS, GitHub Release, 자동 업데이트 배포는 건드리지 않았다.

## 결론

timeout 위험은 테스트 안정성 문제로 해소됐다. 제품 updater, Palette, Dock, Dashboard, 종료·flush 수명주기에 대한 새로운 회귀는 확인되지 않았다. 다음 제품 버전 후보 제작 단계로 진행할 수 있으나 main 병합과 배포는 별도 승인이 필요하다.
