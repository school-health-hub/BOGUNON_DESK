# BETA13-INSTALL-QA-01

## 결론

읽기 전용 조사와 리허설 계획은 완료했다. 실제 설치 QA 착수는 보류한다. 승인된 격리 환경, 검증된 beta.12 기준 설치 파일, 올바른 beta.13 버전을 가진 승인된 후보가 필요하다. 설치·업데이트·삭제·롤백은 모두 NOT RUN이다.

제품 Source SHA는 `98f39f1467bf20a22e1ba182391fbd1c7e05155f`, 재사용한 RC 보고서 HEAD는 `0fcb0212255379aca7285ed9ea0d423374ffe159`이다. QA 문서 브랜치는 `codex/beta13-install-qa-01`이다.

## 설치와 충돌 경계

| 항목 | 읽기 전용 확인 |
| --- | --- |
| 설치된 beta.12 | HKCU 제거 등록에 `2.0.0-beta.12`가 있으며, DisplayIcon이 가리키는 `%LOCALAPPDATA%\Programs\BOGUNON DESK\BOGUNON DESK.exe`가 존재한다. 제거 등록은 현재 사용자 범위다. |
| 앱 식별자 | `kr.sungandi.schoolhealthdesk.electronp0`, 제품명과 바로가기 이름 `BOGUNON DESK`. 같은 사용자에서 같은 패키징 설정으로 설치하면 설치 경로·제거 등록·바로가기 충돌 위험이 있다. |
| 패키징 | `electron-p0/builder.json`은 Windows x64 NSIS와 Portable을 정의한다. NSIS는 사용자별, 설치 위치 변경 및 권한 상승 비허용, 설치 완료 후 자동 실행 없음, 제거 시 앱 데이터 삭제 설정 꺼짐이다. 이 설정의 실제 설치·제거 결과는 미검증이다. |
| beta.12와 후보 차이 | `18c0c2c`와 제품 후보 간 Electron package manifest, builder 설정, production update feed와 installer handoff 코드에 차이가 없었다. 후보 manifest도 `2.0.0-beta.12`다. 버전이 부여된 별도 beta.13 후보의 빌드 메타데이터와 설치 파일 버전 일치를 사전에 검증해야 한다. |
| 업데이트 | 패키징된 Windows 비Portable 앱에서 beta feed 사용. 저장 확인 뒤 updater는 정상 종료를 요청하고, helper는 부모 PID 종료 대기, 파일 길이·SHA-256 재검증, NSIS `/S` 실행, 종료 코드·설치 파일 버전 검사를 수행한다. 상태 기록은 프로필 내 `update-downloads/last-install-result.txt`다. RC의 격리 updater 테스트를 재사용했다. 실제 설치는 미검증이다. |
| 앱 프로필 | `%APPDATA%\BOGUNON-DESK-ELECTRON-P0` 존재를 확인했다. 소스상 `poc-settings`, `work-data`, `chromium`, `update-downloads`를 포함한다. 운영 파일 내용은 읽지 않았다. Portable도 기본 프로필을 공유할 수 있다. |

## 격리 준비

- Hyper-V 관리 서비스가 실행 중이고 `Get-VM`에서 열거 가능한 VM은 0대였다. 이름이 QA/test 계열인 활성 로컬 계정 후보 두 개를 확인했으나 접근 권한과 전용 여부는 확인하지 않았다. 현재 환경에 승인된 테스트 세션은 확보되지 않았다.
- 설치·롤백은 체크포인트가 있는 전용 Windows VM을 우선 사용한다. 대체 계정은 승인된 전용 로컬 계정으로 제한하고, 로그인 전에 해당 사용자 SID와 설치 대상 경로 및 HKCU 등록 범위가 운영 계정과 다른지 확인한다. 공유 운영 폴더와 계정 자격증명은 시험 환경에 전달하지 않는다.
- 소스 앱 E2E의 `ELECTRON_P0_QA_PROFILE=1`은 UUID별 appData/userData/sessionData 분리에 사용할 수 있다. 전용 루트는 승인된 임시 폴더 아래에 두고 운영 프로필과 겹치거나 재분석 경로를 가리키지 않게 한다. 이 환경 변수는 NSIS 설치 경로·제거 등록 자체의 분리를 보장하지 않는다.

## 승인 후 리허설 순서

1. 테스트 환경과 체크포인트를 지정한다. 별도 승인으로 beta.12 설치 파일과 beta.13 후보의 출처, Source SHA, 파일 버전, SHA-256 및 업데이트 매니페스트를 검증한다. 운영 beta feed 대신 승인된 격리 fixture를 사용한다.
2. 테스트 beta.12를 설치한다. Newsletter JSON과 로컬 프로젝트, 일정, 메모, Dock, 모니터별 위젯 위치·크기·표시 상태를 합성 데이터로 만든다. 정상 종료 및 PID 종료 뒤 전체 프로필을 보호된 테스트 저장소에 백업한다. 원본 파일 경로·크기·SHA-256 목록과 설치 버전을 기록하고 별도 복원본의 해시를 비교한다.
3. 동일 테스트 사용자에서 정상 업데이트를 실행한다. 저장 확인, 종료·flush, helper 상태, 설치 버전, 재실행·원고 및 위젯 복원을 확인한다. 합성 계정만 사용한다. 실제 계정의 머신·사용자 종속 암호화 자료를 복사하지 않는다.
4. 별도 체크포인트에서 설치 취소, 해시 불일치, 설치 실패를 각각 재현한다. 설치 전후 버전과 백업 해시를 대조한다. 복구 때에는 실패 상태 증거를 보존하고 테스트 앱을 종료한 뒤 이전 버전과 그 버전에 대응하는 프로필 백업을 복원한다. 원고 열기·저장, Dock 실행 및 재실행을 다시 확인한다.
5. 설치와 별개로 전용 테스트 바탕화면에서 단일·듀얼·혼합 DPI, 분리·재연결, 20–25% 아이콘 구역, Explorer 클릭 통과, Dock/작업 표시줄을 캡처와 창 경계로 검증한다. VM에서 물리 토폴로지를 재현할 수 없는 경우 별도 하드웨어가 필요하다. 운영 디스플레이와 아이콘은 그대로 둔다.

이번 결과는 문서만 원격 보존한다. 제품 기준 SHA와 QA 문서 커밋을 구분하고, push 후 원격 HEAD와 divergence 및 working tree를 확인한다.
