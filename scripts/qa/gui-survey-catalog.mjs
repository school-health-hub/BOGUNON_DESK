// Current Electron routes, not a claim that the Tauri feature set is complete.
export function catalog(records){
 const byId=new Map(records.map(r=>[r.id,r]));
 const rows=[
 ['home','홈·Dashboard·Dock','앱 내부 데스크톱. OS 바탕화면 WorkerW 제외. 시작·크기 변경 화면만 확인'],
 ['widgets','Widget Workspace','Windows 마우스 배치·크기 변경 및 설정 IPC 비교. 작은 카드 내부 스크롤 PARTIAL'],
 ['tasks','개인 업무','합성 업무 UI 저장 및 실제 Main JSON 재조회. 독립 Inbox 아님'],
 ['calendar','독립 일정','실제 로컬 Event IPC 연결. 이 실행은 화면 확인; CRUD·재실행은 기존 SCHOOL-08 제품 동일 트리 근거와 구분'],
 ['quick-add','빠른 추가·명령 팔레트','로컬 Task/Event 연결. 서버 일정·계정 동기화 없음'],
 ['official','공문작업실','로컬 편집·Main 파일 가져오기/ODT 저장 연결. 이번에는 화면·가로 넘침 확인. 실제 원본 서식 완전 보존 미지원'],
 ['purchase','품의 도우미','실제 Main CSV 파일 선택 시도 결과 별도 기록. OCR·AI 분석·XLSX 출력은 이 실행에서 전체 검증하지 않음'],
 ['record','생기부 도우미','Main 네이티브 추출 연결, 세션 전용. 실제 학생 자료·외부 AI 미사용'],
 ['inventory','개인 Inventory','개인 JSON IPC와 합성 Preview 구분. 공동 PostgreSQL Inventory와 별도'],
 ['finance','MY FINANCE','격리된 새 QA profile의 실제 SQLCipher/DPAPI 상태 확인. 기존 개인 자료 접근 없음'],
 ['newsletter','보건소식지 제작소','기존 제작소를 업무 도구에서 연결. PNG/PDF 실제 출력은 이 실행에서 NOT RUN'],
 ['finder','교육영상 Finder','Main YouTube 검색·Windows Key vault 연결. 키 없음, 실제 YouTube 호출 NOT RUN. V1/V2 독립 저장'],
 ['workspace','학교 공동 Workspace','운영 기본 CLOSED. 가입·멤버십·공동 업무/일정/인수인계/재고/강사 활성 화면은 Hosted 연결 대기'],
 ['settings','설정','화면·위젯·Dock·앱 정보 메뉴. 전체 디자인 체계 전환 미실행'],
 ['account','BOGUNON 계정','공개 클라이언트 설정·Main OAuth/DPAPI 경로. 실제 Google 로그인·등록 학교 조회 NOT RUN'],
 ['ai','ChatGPT/OpenAI/Gemini','설정 화면만. 실제 인증·모델 조회·유료 텍스트/이미지 호출 NOT RUN'],
 ['memo','Quick Memo','합성 UI 저장 및 실제 Main 메모 재조회. 사용자 자료 없음'],
 ['folders','업무 폴더·즐겨찾기','Main ID 기반 로컬 폴더 실행·원자 저장 연결. 실제 사용자 폴더 미선택'],
 ['school-portal','학교 업무포털·NEIS/eVPN','기존 17개 교육청 매핑/주소 설정. URL 최신성 NOT VERIFIED, 실제 학교망 로그인 NOT RUN']
 ];
 return [...rows.map(([id,feature,scope])=>({feature,status:byId.get(id)?.status??'코드 구현·GUI 미검증',scope,images:byId.get(id)?.captures??[]})),
 {feature:'독립 Inbox',status:'미구현 또는 연결 누락',scope:'Inbox 진입은 기존 로컬 업무 패널로 연결. 독립 Inbox 기능이라고 표시하지 않음'},
 {feature:'날씨·급식',status:'미구현 또는 연결 누락',scope:'위젯에 미연결 안내. 실시간 공급자 없음'},
 {feature:'온라인 보건실·BOGUNON·AED 등 일부 바로가기',status:'미구현 또는 연결 누락',scope:'기존 Tauri 메뉴 타입이 존재하나 현재 Electron navigate에서 지원 범위 제외 안내'},
 {feature:'Tauri 서버 일정·공동 계정 동기화·자동 메타 갱신',status:'기존 Tauri 전용',scope:'Electron 독립 로컬 일정과 별개. 자동 이전·동기화 미구현'},
 {feature:'OS Desktop Surface / Native WorkerW',status:'미구현 또는 연결 누락',scope:'명시적 제외. 앱 내부 Dashboard를 OS 바탕화면 통합으로 표시하지 않음'},
 {feature:'Inventory Preview',status:'GUI 구현·백엔드 부분 검증',scope:'합성 데이터 전용. Local QA와 운영 연결을 대체하지 않음'}];
}
