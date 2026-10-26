# ChatGPT 계정 기반 교육영상 검색

## 경로와 지원 조건

Finder → 공통 ChatGptConnectionContext.searchWeb → chatgpt_search_web → 기존 OAuth/토큰 갱신/플랜 권한 검사 → 고정 https://api.openai.com/v1/responses.
별도 Finder 키, Supabase 프로젝트, YouTube Data API를 사용하지 않는다. 기존 Proxy/RPC 코드는 보존하며 기존 외부 dispatch 플래그는 false로 유지한다.

Sign in with ChatGPT 공개 Responses 인터페이스의 store:false, stream:true, input 배열, web_search 도구, tool_choice:required, include:web_search_call.action.sources를 사용한다. 모델 및 계정/워크스페이스 정책이 검색을 허용해야 한다. 현재 보수적인 지원 목록은 gpt-5.6-luna, gpt-6-sol, gpt-6.1-sol, gpt-6-astra이며 실제 계정의 모델 목록에 존재해야 선택할 수 있다. 지원 목록은 계정 권한을 보장하지 않는다. 확인되지 않은 모델은 URL 직접 입력 대안을 안내한다.

공식 근거(2026-10-22 확인):
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations
- https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference
- https://developers.openai.com/api/docs/guides/tools-web-search
- https://developers.openai.com/api/docs/models/gpt-5.6-luna
- https://developers.openai.com/api/docs/models/gpt-6-sol
- https://developers.openai.com/api/docs/models/gpt-6.1-sol

## 출처와 한계

완료된 웹 검색 호출과 구조화된 출처가 있는 완료 응답만 수용한다. 모델 본문에 적힌 URL 자체는 검색 증거가 아니다. 후보의 개별 YouTube URL이 제공자 출처와 일치해야 하며 카드 제목은 그 출처의 제목을 사용한다. 중복은 제거하고 최대 5개만 표시하며 결과가 적어도 만들어 채우지 않는다.

제작기관, 영상 길이, 공식 기관 여부를 이름이나 모델 설명으로 추정하지 않는다. 독립적으로 확인되지 않은 메타데이터는 미확인으로 표시한다. 소개정보는 AI가 공개 출처에서 정리한 요약이며 원문 확인이 필요하다. 상세 검토도 공개 소개정보만 분석하며 실제 영상 시청/전체 자막 분석이 아니다. 교사가 원본과 교육 적합성을 확인해야 한다.

검색과 상세 검토는 기존 공문서 개인정보 검사와 편집 가능한 전송 확인을 거친다. 실제 비용·플랜 사용량은 계정/모델/정책에 따라 달라지며 무료라고 표시하지 않는다. OAuth 토큰이나 키를 라이브러리에 저장하지 않는다.

## 합성 검증과 실제 검증의 경계

합성 transport/고정 데이터로 계약·UI·오류·빈 목록·출처 부족·기존 라이브러리 호환성을 검증한다. 실제 외부 AI 요청은 이번 단계에서 실행하지 않는다. 경량 Rust harness의 파서/요청 본문 검증은 전체 Tauri 네이티브 빌드나 실제 OAuth HTTP 검증을 대신하지 않는다.

실제 검색 검증에는 별도 승인, 연결된 ChatGPT 플랜 권한, 해당 계정에서 사용 가능한 지원 모델, 네이티브 앱 실행이 필요하다. 승인 후 공개 교육 주제 1건으로 전송 내용을 확인하여 검색하고, 사용량/오류와 원본 출처·제목·소개정보를 직접 대조한다. 영상 보기·보관함·기안 전달을 확인하되 토큰이나 개인 데이터를 기록하지 않는다. 비용 또는 한도가 확인되지 않으면 그 불확실성을 유지한다. 기존 YouTube/Supabase dispatch 플래그를 켤 필요는 없다.

검색 버튼 확인 1회는 Responses 요청 1회를 시작한다. 그 요청 안의 웹 검색 도구 실행 횟수와 추론 사용량은 제공자 동작에 따라 달라지므로 고정 무료 횟수나 비용을 보장하지 않는다. 상세 검토 확인은 별도 텍스트 생성 요청 1회다. 재검색도 추가 요청이다. 실제 검색 검증은 공개 주제 1건부터 시작하고 계정 사용량 화면/오류를 함께 확인한다.

현재 영상 링크 수용 범위는 기존 라이브러리와 호환되는 개별 YouTube 영상이다. 다른 영상 플랫폼의 식별자·저장 형식은 이번에 확장하지 않았다. 기존 v1/v2 파일을 현재 앱에서 읽는 호환성은 검증했지만 새 `ai` 필드를 모르는 구버전 앱으로의 역방향 호환은 보장하지 않는다.
