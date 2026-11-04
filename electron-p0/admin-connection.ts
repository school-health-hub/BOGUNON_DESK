export type AdminConnectionState='canceled'|'reachable'|'authentication-required'|'access-denied'|'not-found'|'unavailable'|'timeout'|'network-error'|'redirect-blocked'|'redirect-review'|'redirect-limit'|'method-unsupported';
export type AdminConnectionCheck=Readonly<{state:AdminConnectionState;httpStatus?:number;redirects:number;redirectOrigin?:string;message:string}>;
export const ADMIN_CONNECTION_MESSAGES:Readonly<Record<AdminConnectionState,string>>={
 canceled:'주소 확인을 취소했습니다. 외부 요청하지 않았습니다.',
 reachable:'HTTPS 응답을 확인했습니다. 실제 학교망 접근·인증·로그인 성공을 의미하지 않습니다. 브라우저에서 확인하세요.',
 'authentication-required':'인증 요구 응답 또는 인증 페이지 이동 안내가 확인됐습니다. 공식 인증서 로그인은 기본 브라우저에서 직접 진행하세요.',
 'access-denied':'서버가 접근을 거부했습니다(403). 학교망/eVPN·기관 정책·브라우저 인증 상태를 확인하세요. 원인은 자동 판정하지 않습니다.',
 'not-found':'등록한 경로를 찾지 못했습니다(404). 기관 안내의 최신 주소와 대조하세요.',
 unavailable:'서버가 정상 응답하지 않거나 요청을 제한했습니다. 기관 안내를 확인하고 나중에 직접 다시 시도하세요.',
 timeout:'주소 확인 시간이 초과됐습니다. 학교망/eVPN 연결과 기관 안내를 확인하세요. 자동 재시도하지 않습니다.',
 'network-error':'연결 응답을 확인하지 못했습니다. 학교망/eVPN·인터넷·DNS·기관 보안 정책을 확인하세요. 접속 불가로 단정하지 않습니다.',
 'redirect-blocked':'허용하지 않는 프로토콜·주소·인증정보 포함 리디렉션을 차단했습니다. 주소 설정과 기관 안내를 확인하세요.',
 'redirect-review':'다른 출처 또는 매개변수가 있는 주소로 이동을 요청했습니다. Main은 따라가지 않았습니다. 기관 근거를 확인한 뒤 브라우저 이동 여부를 직접 결정하세요.',
 'redirect-limit':'리디렉션이 반복되거나 한도를 초과했습니다. 자동으로 계속 연결하지 않습니다. 기관 안내를 확인하세요.',
 'method-unsupported':'이 서버는 비로그인 HEAD 확인을 지원하지 않습니다. 연결 실패로 판단하지 말고 기본 브라우저에서 직접 확인하세요.',
};
export function adminNetworkGuide(environment:'school'|'evpn'){
 return environment==='school'?'학교 내부 교육망용 주소입니다. 외부 인터넷에서는 열리지 않을 수 있습니다. 교외에서는 eVPN에 먼저 직접 연결한 뒤 기관이 안내한 주소를 사용하세요.':'학교 밖에서는 기관 eVPN 클라이언트 설치·승인·공식 인증서 로그인을 먼저 완료하세요. 이 앱의 환경 전환은 VPN을 연결하거나 로그인 세션을 공유하지 않습니다.';
}
