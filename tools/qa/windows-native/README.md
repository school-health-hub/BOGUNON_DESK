# Windows Native QA 도구

제품 코드와 분리한 일반 사용자용 QA 도구다. Native 대화상자는 Windows PowerShell 5.1/.NET UIAutomation, 제품 DOM은 기존 Playwright로 제어한다. 비공식 내부 GUI 자산이나 관리자 권한은 사용하지 않는다.

## 실행 전제
- Windows 대화형 데스크톱, 일반 사용자 권한.
- Node 22.23.3, 기존 제품 lockfile의 Playwright 1.64.1 및 xlsx 0.20.3.
- 제품 Source SHA d03a58fa7f73411aa2cdb9ebd31c0d8527e21947의 이미 준비된 build 및 의존성.
- 로그인 복구 Portable SHA-256 2050489BC1E1B5E980B9AA1C0846B2771612ECA7000EF99EC773FC9BF4C19B90.
- 동일 패키지의 official-document-cli.exe. 인증 프로필·기존 사용자 자료는 필요 없다.
- E: 여유 공간 및 시작 가용 RAM 1.5GiB 이상, 실행 중 C: 여유 1GiB 초과.

이 도구는 의존성 설치나 제품 빌드를 하지 않는다. source/CLI/EXE 경로는 실행 인자로 받는다. Portable의 공급·무결성은 승인된 별도 경로에서 확인한다. 인증 자료를 복사해 의존성을 충족하지 않는다.

## 최소 실제 Native 검사
일반 PowerShell에서 아래 경로 변수를 해당 PC의 검증 파일로 설정한다. 실사용 자료나 운영 프로필을 지정하지 않는다.

```powershell
$nodePath = '<Node 22.23.3 node.exe>'
$sourcePath = '<기존 검증된 source 폴더>'
$portablePath = '<위 SHA의 Portable EXE>'
$officialCliPath = '<동일 패키지 official-document-cli.exe>'
$tool = '<이 tools/qa/windows-native 폴더>'
& "$tool\run-native.ps1" -NodePath $nodePath -SourcePath $sourcePath -PortablePath $portablePath -OfficialCliPath $officialCliPath -FixturePath "$tool\fixtures" -QaParent 'E:\BOGUNON_DEV\qa-output' -Port 15451 -SmokeOnly
```

전체 13개 시나리오는 같은 명령에서 -SmokeOnly를 제외한다. 최소 검사와 전체 검사는 직렬 실행한다. 실패하면 자동 재시도하지 않는다. 새 실행은 별도의 beta1-native-uia-run-고유값 폴더를 만들며 기존 증거를 덮어쓰지 않는다.

## 보호 및 결과
고정 EXE 해시, launcher/main PID, 실행 경로, CDP localhost 소유자, HWND/owner/root owner/유형/제목을 검증한다. 고유하게 식별되지 않으면 중단한다. 저장은 실제 Native 파일창을 통과하며 앱 저장 API로 우회하지 않는다. 기존 출력은 사전 SHA가 일치할 때만 덮어쓰기 거부 검사에 사용한다.
결과는 results/summary.json, Native JSON, screenshots 및 생성 출력에 저장된다. 캡처에는 Windows 경로/탐색 항목이 포함될 수 있으므로 결과 폴더를 Git에 넣지 않는다. 새 temp 프로필도 공유하지 않는다. 전체 프로필/로그/캡처는 이 저장소 보존 대상이 아니다.

fixtures의 ODT/PDF/CSV/XLSX는 합성 문장과 품목만 포함한다. fixtures-sha256.json으로 원본 복사본을 대조할 수 있다. fixture를 실제 문서로 교체하지 않는다.

## 검증 범위
VALIDATION.md에 실제 실행 범위를 기록했다. 기존 전체 13/13 결과는 원본 도구의 근거이고, 이번 경로 매개변수화 도구는 구문 검사와 최소 Native 실제 취소 검사를 통과했다. 매개변수화된 전체 13개를 새로 통과했다고 주장하지 않는다.
제품 기능 수정, 인증 시작/연결 해제, 모델/AI 호출, NSIS 설치는 이 도구의 동작에 포함하지 않는다. 설치 후속 조건은 INSTALL-QA.md를 참고한다.
