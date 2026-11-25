# UX-DIALOG-01 — 확인창 감사 및 beta.13 소스 후보

기준: `fb22ef9b4319b035c1019a6570639b1dc6948e41`. beta.12 `18c0c2c938cd524bb1e904a5f704a617cfd13b25` → UX-CLEANUP-01 `eb977eed14c16b0daee34124c909ef4e8ea2e7a6` → UX-CLEANUP-02 `79201a609c9660ef3b0f6fce101310245ab294cc` → UX-CLEANUP-03 `fb22ef9b4319b035c1019a6570639b1dc6948e41`은 순차 계보이다. 02→03의 추가 파일은 QA 문서와 Electron E2E 두 개뿐이다. main과의 merge-base는 `5cec64358436c148710499b5aa9d2e78c34e0136`이다. 중복 병합은 하지 않았다.

| 화면·흐름 | 유형 | 기존 노출 / 위험 | 이번 처리 | 남은 범위 |
| --- | --- | --- | --- | --- |
| 보건소식지 출력 승인 | B: Main 승인 | Windows 기본창에 합성 자산 ID·원고/디자인 번호·SHA 출력 | Main 소유의 Soft Rose 확인창으로 변경. 검증 요약을 창에 전달하지 않음. 원래 출력 요청에 대한 1회성 승인과 취소·창 종료 시 거절 유지 | 실제 사용자 설치본 확인은 별도 단계 |
| 즐겨찾기 등록 해제 | A: 일반 업무 | Windows 기본 확인창 | 같은 Main 소유 확인창 재사용. 사용자 입력 이름은 HTML 이스케이프 | 기존 폴더·파일은 삭제하지 않음 |
| 보건소식지 원고 JSON/출력 덮어쓰기·프로젝트 복원 | B: 데이터 변경 | JSON, revision, 내부 프로젝트 ID 일부 노출 | 복원 확인의 내부 ID·revision 문구를 제거. 기존 Main 확인·파일 변경 재검사 유지 | JSON/덮어쓰기 문구 정리는 Main 경계별 별도 검증 필요 |
| 공문·구매 출력/덮어쓰기 | B: 파일 저장 | 검토 요약·원고 내용 등 승인 근거 표시 | Main 승인과 OS 저장창 유지 | 상세 정보 최소화는 별도 검증 필요 |
| AI 연결·이미지·원고 외부 전송, Finder API 검색 | B: 외부 전송·비용 | API/Key/SHA 등 기술어와 전송 내용 표시 | 전송 범위·비용·개인정보 고지 및 Main 승인 유지 | 별도 보안 검토 없이 앱 Dialog로 이전하지 않음 |
| 앱 업데이트 설치·인증/복구 | B: 앱 종료·인증 변경 | 보안 또는 미저장 작업 확인 | Main 승인 유지 | 변경 없음 |
| Workspace/Palette, 일정·업무·학교 프로필, Inventory, Finder, Purchase의 `window.confirm` | A 또는 B: 일반 편집·삭제/초기화 혼재 | 브라우저 기본 확인창, 화면별 표현 차이 | 호출 위치와 의미 감사 완료. 동기 확인을 전역 대체하지 않음 | 개별 작업의 취소·저장 경계를 분리한 뒤 공통 `SurfaceDialog` 적용 필요 |
| 첫 실행·계정 연결·공문 AI 검토·빠른 메모·파일 드롭 | A: Renderer 안내 | 이미 `SurfaceDialog` 사용 | 기존 로즈 카드·포커스 트랩·복귀 재사용 | 변경 없음 |
| 파일 열기/저장, UAC·SmartScreen, Windows 보안 알림 | C: OS 제공 | 시스템 권한·파일 선택 | 네이티브 유지 | 변경 없음 |
| Toast·Banner·상태 메시지 | A: 결과 안내 | 각 화면의 상태 텍스트 | UX-CLEANUP-01·02 수정 보존 | 이번 승인 경계와 무관한 일괄 치환 없음 |

`createNewsletterExportHandler`는 IPC 송신자·입력·자산·생성 파일을 Main에서 검사하고 한 번에 하나의 출력만 처리한다. 수정된 확인창은 Main이 직접 생성하고, preload/Node/일반 IPC를 제공하지 않는다. 취소·ESC·닫기·부모 창 종료는 거절이며, 승인 뒤에만 OS 저장창과 저장 로직으로 넘어간다. 파일 덮어쓰기 확인은 기존 Main 경계를 유지한다. 기존 사용자 데이터, 저장 스키마, 업데이트·인증 코드는 변경하지 않았다.

검증 기록은 별도 `F:\BOGUNON_DEV\ux-dialog-01-20261125\evidence`에 둔다. 격리 합성 프로필의 실제 Windows Electron E2E 1건 PASS: 900×680 부모 창에서 확인창 표시, Tab·Shift+Tab 순환, ESC·닫기 취소 시 파일 미생성, 부모 포커스 복귀, Enter 승인 후 A4 PNG/PDF 실제 생성 및 파일 형식·크기 확인. 일반 팝업에는 합성 자산 ID·SHA·revision·scene이 보이지 않았다. `newsletter-export`와 `newsletter-projects` 집중 테스트 12/12 PASS. Electron 빌드와 TypeScript 검사 PASS. 이전 UX-CLEANUP-03의 학교 프로필 7/7 PASS는 재사용했다.

변경 전 확인창 문구는 `검증된 문서로 이번 출력을 저장할까요?`와 내부 요약이었고, 변경 후 `보건소식지 저장` / `현재 편집한 내용으로 파일을 저장할까요?` / `취소`·`저장하기`이다. 변경 후 GUI: `F:\BOGUNON_DEV\ux-dialog-01-20261125\evidence\newsletter-confirmation-before-save.png`. 변경 전 네이티브 팝업 PNG는 이 작업에서 확보하지 못했으며 UX-CLEANUP-03 기록과 기존 코드로 전후를 대조했다. 즐겨찾기 해제 창의 실제 클릭 GUI는 NOT RUN이다. 다중 모니터 및 실제 사용자 설치본은 NOT RUN이다.

beta.13 **소스 계보 통합은 준비됨**. 전체 확인창의 앱 디자인 전환은 **CONDITIONAL**: 데이터 삭제·덮어쓰기·외부 전송 등 Main/Renderer의 나머지 경로는 보안 경계별 별도 검증이 필요하다. beta.13 설치본 제작·배포·실사용 데이터 검증은 이번 범위 밖이다.
