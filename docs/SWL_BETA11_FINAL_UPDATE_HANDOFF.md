# beta.11 최종 업데이트 검증 인계

판정 **CONDITIONAL / 공개 게시 보류**. 검증 제품 Source SHA는 `c56513db5046ed4ac35a88cd6b0614f1555a9d61`이다. 이번 변경은 검증 기록이다.

- 후보는 `BOGUNON-DESK-Setup-2.0.0-beta.11-x64.exe`다. SHA-256은 `DA9DD303748D19BC955DA82C3815B01C0E707E804075B25A927F4AB5656B7FC1`이며 Authenticode는 NotSigned다.
- `bogunon-update.json`의 SHA-256은 `CD6AAE67373F7C35FE75A5258070DCD63CC6E700E383A20EE553A46CE2A74BCA`다. 기존 beta 피드 검증키로 Ed25519 서명을 재확인했다. 만료는 2026-12-25 09:57:28 KST다. EXE·메타데이터·Release Notes는 기존 SHA256SUMS와 일치한다.
- 기존 오프라인 결과는 실제 후보 바이트를 사용한 발견·다운로드·Ed25519/SHA-256 검증 PASS다. 합성 프로필의 패키지 GUI 캡처와 재실행 증거도 재사용한다.
- Sandbox는 비활성이고 Hyper-V 게스트는 0대다. 사용 권한과 초기 상태가 확인된 QA 계정은 확보되지 않았다. 동일 ID 설치·교체, 위젯/Dock/계정 설정의 이전 및 재실행 후 보존, 제거와 잔여 프로세스 확인은 NOT RUN이다.
- 기존 INT-SWL-03의 변조 해시 거부, 설치 도우미 오류 처리, 부모 종료 뒤 핸드오프 증거를 재사용한다. beta.11 동일 ID 설치에서의 취소, 부모 종료 실패, 설치·재실행 실패 후 기존 파일과 설정 보존은 NOT RUN이다.
- 로컬 증거는 이전 beta.11 RC 최종 결과 폴더의 설치 EXE, 서명 메타데이터, SHA256SUMS, Release Notes, OFFLINE-UPDATE-RESULT, GUI-RESULT 및 screenshots에 있다. 설치 파일과 로컬 프로필은 Git 변경에 포함되지 않는다.
- 게시 승인 전 격리 Windows에서 공식 beta.10을 설치하고 합성 설정 기준선을 만든 뒤 현재 서명본과 후보로 동일 ID 교체를 검증한다. 설치 경로와 등록, 자동/수동 재실행, 저장 파일 및 위젯·Dock 설정, SWL 진입과 정상 제거를 기록한다. 메타데이터는 시험일에 유효해야 한다.
