# RELEASE NOTES — 2.0.0-beta.1 내부 RC

대상: Windows x64. 새 제품 코드 변경 없음. 검증된 d03a58fa7f73411aa2cdb9ebd31c0d8527e21947 소스의 로그인 공개 설정 복구 Portable 및 같은 payload NSIS를 RC 폴더로 복사했다.

## 포함한 검증 결과
- Dashboard/Dock, 위젯 설정·메모·주간 일정 및 주요 로컬 업무 모듈의 합성 GUI 근거 정리. 이전 패키지에서 수행한 넓은 GUI 범위와 최종 패키지 직접 검증을 구분했다.
- 최종 Portable에서 실제 Supabase 로그인·취소·세션 복원·로그아웃 및 격리 프로필 분리.
- 실제 ChatGPT 인증 후 앱 ready 복귀, 재인증 없는 세션 재사용, 모델10개 조회 및 선택 일치.
- 실제 Windows Native 파일창13건: 공문/Record/Purchase 선택·취소·저장·덮어쓰기 거부와 출력 검사.
- NSIS 정적 검사 및 집 PC 실제 사용자 단위 설치·실행·제거·재설치. 합성 메모/위젯 설정 복원, 기존 사용자 파일1796개 해시 불변.
- QA 도구는 별도 브랜치 codex/beta1-native-qa-tools@50d2b0d8c374c18e011bd4f3f9967fbfbb567b80에 보존.

## 검증하지 않은 범위
실제 AI 생성/응답, 실제 학교 업무 데이터 적용, 장기간 인증 만료/서버 장애, 다른 버전 업그레이드, 다른 PC/학교 보안 정책 및 전체 모듈의 모든 업무 경로는 이번 RC 정리로 PASS가 되지 않는다. 전체 QA·빌드·실제 로그인·설치를 반복하지 않았다.

## 패키지 성격
미서명 Windows 내부 테스트 후보다. 공식/공개 배포나 운영 자료 사용을 승인하지 않는다. 세부 게이트는 RELEASE-GATE.md, 원본 증거는 EVIDENCE-INDEX.md를 따른다.
