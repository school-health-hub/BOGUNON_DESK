# BOGUNON DESK 2.0.0-beta.1 내부 Release Candidate

Windows x64 · 내부 테스트/릴리스 검토용 · 2026-11-19
제품 코드를 새로 개발하거나 재빌드하지 않고 검증된 파일을 복사한 RC 검토 묶음이다. 제품 버전은 2.0.0-beta.1 그대로이며 별도의 rc 버전이나 서명본을 생성하지 않았다.

## 시작 순서
1. SHA256SUMS.txt 또는 RC-METADATA.json으로 EXE 두 개를 검증한다.
2. RELEASE-GATE.md와 KNOWN-ISSUES.md를 읽고 허용 테스트 범위를 확인한다.
3. INSTALL-GUIDE.md에 따라 설치하거나 Portable을 사용한다. 현재 집 PC에는 이미 검증된 사용자 단위 설치가 있으므로 같은 QA를 반복할 필요가 없다.
4. QA-SUMMARY.md의 각 PASS는 EVIDENCE-INDEX.md에서 원본 보고서/실행 기록으로 연결된다.

## 파일
- Portable: BOGUNON-DESK-2.0.0-beta.1-auth-config-win-x64.exe
- NSIS: BOGUNON-DESK-Setup-2.0.0-beta.1-x64.exe
- 제품 Source SHA: d03a58fa7f73411aa2cdb9ebd31c0d8527e21947
- Portable SHA-256: 2050489BC1E1B5E980B9AA1C0846B2771612ECA7000EF99EC773FC9BF4C19B90
- NSIS SHA-256: 760FE269C6DD6FF516200F621568B02FC5259B2E88CDDA6DF6F794932EB25E51

설치본은 미서명이다. 현재 집 PC에서 일반 사용자 권한으로 설치·제거·재설치와 데이터 보존을 확인했지만 다른 PC/학교 보안 정책의 허용을 보증하지 않는다. 보안 경고나 조직 정책을 임의 우회하지 않는다.
기본 제거는 사용자 데이터를 보존한다. 실제 데이터는 별도 백업한 뒤 사용하며, 삭제 옵션/강제 정리 명령을 사용하지 않는다. 기존 사용자 데이터를 자동 이관하거나 인증 프로필을 다른 PC로 복사하지 않는다.
Supabase 로그인 및 ChatGPT 인증/모델 조회에는 인터넷과 해당 계정 권한이 필요하다. 두 연결은 별도이다. 실제 AI 생성은 비용·잔여 사용량·허용 범위가 미확정이어서 NOT RUN이며 ready/모델 조회를 생성 성공으로 해석하지 않는다.

내부 RC 검토는 가능하나 공식 배포 승인은 아니다. GitHub에는 이 검증 문서만 보존하며 EXE·인증 프로필·원본 로그/캡처·실제 사용자 백업을 게시하지 않는다. EXE와 원본 증거는 현재 E: 로컬에 있으며 원격 문서만으로 완전한 다른 PC 인계가 완료된 것은 아니다.
