# 원본 검증 증거 색인

이 파일은 경로·해시 색인이다. 원본 로그/이미지/프로필을 패키지나 Git에 복사하지 않았다. E: 링크는 이 집 PC에서만 유효하며 GitHub에서 원본을 열 수 있다는 뜻이 아니다. 각 보고서의 더 세부적인 증거는 원본 폴더/manifest에서 확인한다. 인증 프로필·실제 데이터 백업은 열거나 전송하지 않는다.

## S01

주요 로컬 기능의 이전 패키지 실제 GUI — 이전 Portable 7248D584…의 실제 packaged payload. 최종2050489…에서 전부 재실행한 결과 아님. S02의 실행 코드 동일성 검증으로 제한적으로 재사용.

- [REPORT.md](E:/BOGUNON_DEV/qa-output/beta1-integration-home-20261118-qa1/REPORT.md) — SHA-256 `63055ECB38D2BF28485334ECD6A0CD1BD25B7011933E68B3308673BC720336A8`
- [REVIEW-NOTES.md](E:/BOGUNON_DEV/qa-output/beta1-integration-home-20261118-qa1/REVIEW-NOTES.md) — SHA-256 `FADCB85D7958A04780FE758CCE65170C6D91DC85B2E954AF8EB4DC570AEFF69D`
- [results/gui-final-summary.json](E:/BOGUNON_DEV/qa-output/beta1-integration-home-20261118-qa1/results/gui-final-summary.json) — SHA-256 `78E2B12DA925E48302F0355AAA7203DD477B594C9A6509F2893CEA87B1B23238`
- [results/007-widget-toggle-contract.json](E:/BOGUNON_DEV/qa-output/beta1-integration-home-20261118-qa1/results/007-widget-toggle-contract.json) — SHA-256 `D4247E1EA7955B3F16BB8A6934D28799B67071C127352D10ECCA38807BFA9F35`
- [results/010-calendar-weekly-and-dashboard.json](E:/BOGUNON_DEV/qa-output/beta1-integration-home-20261118-qa1/results/010-calendar-weekly-and-dashboard.json) — SHA-256 `A511976C750009637941BAC84F0C2F82D0F1A1341E93B89BE2E0D1E454DF27FF`
- [results/050-dashboard-final-persistence.json](E:/BOGUNON_DEV/qa-output/beta1-integration-home-20261118-qa1/results/050-dashboard-final-persistence.json) — SHA-256 `A1F6ED05F977C069ED7618F5D3D80C3CB4FCAC3DAB493040E773219686623FDC`
- [results/051-inventory-restarted.json](E:/BOGUNON_DEV/qa-output/beta1-integration-home-20261118-qa1/results/051-inventory-restarted.json) — SHA-256 `838196A2F31AF62B353DDA3D404D929956C04725B321F979788BEB69656204DC`
- [results/052-newsletter-restarted.json](E:/BOGUNON_DEV/qa-output/beta1-integration-home-20261118-qa1/results/052-newsletter-restarted.json) — SHA-256 `68A6B906AD6246414BEFDD257D437A06C2DA31E38A80D0B10F692877378D8782`
- [results/054-finder-persistence-by-id.json](E:/BOGUNON_DEV/qa-output/beta1-integration-home-20261118-qa1/results/054-finder-persistence-by-id.json) — SHA-256 `7FAA0C4546201F8753FCF429880C2447CD7310A0559923A8CF40D4565C15E726`
- [results/055-purchase-small-access.json](E:/BOGUNON_DEV/qa-output/beta1-integration-home-20261118-qa1/results/055-purchase-small-access.json) — SHA-256 `624A2DBF7C9B0425F859149BF65FE8F9BF8FEBE007E7FE6EB53DA09AE17B5333`

## S02

로그인 공개 설정 복구 및 패키지 동일성 — 최종Portable2050489…; account-config와 boundary 보고서 열거 순서만 변경. 나머지 ASAR 파일 및 CLI5개 해시 동일. 공개 설정 값 자체 미포함.

- [REPORT.md](E:/BOGUNON_DEV/qa-output/beta1-auth-recovery-20261118/REPORT.md) — SHA-256 `0F43EF3FADF7C2F0B7DBFA6CFC5833F6C9BF0ADB1EE7D6FC037A31F60CA1414D`
- [results/package-inspection-v2.json](E:/BOGUNON_DEV/qa-output/beta1-auth-recovery-20261118/results/package-inspection-v2.json) — SHA-256 `39CBC06A9FB31CE28CFF008EB77C7136EB8570509EC31680780832C7950285A2`
- [results/boundary-audit.json](E:/BOGUNON_DEV/qa-output/beta1-auth-recovery-20261118/results/boundary-audit.json) — SHA-256 `C89EACD09E3DECCCFCD7DE62974D520D7D76DFE1F21FDDA8642F796983F52455`

## S03

Supabase 실제 로그인·취소·세션·로그아웃 — 사용자 본인 직접 인증. 상태/식별정보 존재 여부 증거. 장시간 만료/강제 실패/학교 데이터 적용 미검증.

- [REPORT.md](E:/BOGUNON_DEV/qa-output/beta1-live-auth-20261118/REPORT.md) — SHA-256 `2E3480EC8378EC11F4D21424D792D0B088440320DF0B74CB36C9BEC79F735B50`
- [results/002-cancel-observation.json](E:/BOGUNON_DEV/qa-output/beta1-live-auth-20261118/results/002-cancel-observation.json) — SHA-256 `1A2708D9B20EAB90AF66EA781164C0703CFE6D991338CA62FA154AF7283DAC73`
- [results/003-login-result-observation.json](E:/BOGUNON_DEV/qa-output/beta1-live-auth-20261118/results/003-login-result-observation.json) — SHA-256 `1B163B86E95E862B3694AC50D842881CB8550EA8737C266C4F04A50D62B00D3D`
- [results/004-session-maintain-restart-A.json](E:/BOGUNON_DEV/qa-output/beta1-live-auth-20261118/results/004-session-maintain-restart-A.json) — SHA-256 `A8D570D3C3EC9C9780570540F06D4EE76316005DFA90A8694A95A1177B8A3791`
- [results/005-profile-isolation-and-return.json](E:/BOGUNON_DEV/qa-output/beta1-live-auth-20261118/results/005-profile-isolation-and-return.json) — SHA-256 `605C3526AD97F92D92A6E7905DBF6025DE866515E6CD4972DD50FD0820FA92C2`
- [results/006-logout-observation.json](E:/BOGUNON_DEV/qa-output/beta1-live-auth-20261118/results/006-logout-observation.json) — SHA-256 `CC5B8D960C44ECE6459F3E8DCE6C0C2EAE081C1270309E52BB949E9E75C3B4FB`
- [results/009-logout-scoped-verification.json](E:/BOGUNON_DEV/qa-output/beta1-live-auth-20261118/results/009-logout-scoped-verification.json) — SHA-256 `FDB347156DBA85DF040C531ABD4D901B82AD8D3BB1991052AD7BC69C313C168C`
- [results/010-final-close.json](E:/BOGUNON_DEV/qa-output/beta1-live-auth-20261118/results/010-final-close.json) — SHA-256 `03B7838D77C20621311D310AFC13023EAE1DA86A7F124318599D880563A9DD59`

## S04

ChatGPT 실제 인증·복귀 — 사용자 직접 인증, 앱 ready. AI 생성/모델 조회 성공과 별개. 인증 controller exit1 판정 오류는 별도 파일로 보존.

- [REPORT.md](E:/BOGUNON_DEV/qa-output/beta1-nsis-chatgpt-20261119/REPORT.md) — SHA-256 `7D111E22B39DD15250C6563A8C48E314A2B06B746EB72DB17967FD212092AF5F`
- [results/actual-auth.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-chatgpt-20261119/results/actual-auth.json) — SHA-256 `9E867F8FCA2DFBCC412C3F5CF8593EFDD68855A39267BC100773E3178640CF5A`
- [results/auth-controller.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-chatgpt-20261119/results/auth-controller.json) — SHA-256 `DD00C6AB249E6E9365B9AC80EB01D3CB33DB7EDC515C1FA3E43F6F032CE1796B`
- [results/controller-exit.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-chatgpt-20261119/results/controller-exit.json) — SHA-256 `6A663322496D572311F23872529D65F5A9D072C404CF98FD589E2B7C67F2EF53`
- [results/focused-summary.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-chatgpt-20261119/results/focused-summary.json) — SHA-256 `719ABB250825D61B873B731C2F0FBD8557A861341DCE1333E9EE07CD2DD6538E`

## S05

기존 ChatGPT 세션·실제 모델10개 조회 — 모델 조회와 선택값만 PASS. 실제 생성0건, 비용/한도 미확정으로 NOT RUN. 개인정보/인증 브라우저 캡처 없음.

- [REPORT.md](E:/BOGUNON_DEV/qa-output/beta1-functional-qa-20261119/REPORT.md) — SHA-256 `6907166BC6DE0611328A03AE61F00129708563AAFF158892A40EB29366BE8648`
- [results/models.json](E:/BOGUNON_DEV/qa-output/beta1-functional-qa-20261119/results/models.json) — SHA-256 `7969E70B7E9A25560018378A3585E9EDF6F416BCEAE0F7DA5CD865725906DB59`

## S06

실제 Windows Native GUI13건 — 원본 자동화보고서. 실제 실행 S06R에서13 PASS/FAIL0/NOT RUN0. 합성 자료/원본 도구 기준.

- [REPORT.md](E:/BOGUNON_DEV/qa-output/beta1-native-uia-r2-20261119/REPORT.md) — SHA-256 `B0CD05A357D1D08D5A86AC22D1432293F0B9BC4DECF0A74DB675B8F46B5F8E17`
- [README.md](E:/BOGUNON_DEV/qa-output/beta1-native-uia-r2-20261119/README.md) — SHA-256 `F05FA6B477A52FAAF7AACA708EC910677FB375B2691FE32868CC456B45B84F3F`

## S06R

Native13건 독립 실행 증거 — 실제 Native 창/DOM/출력 검사. 결과 manifest가 참조하는 스크립트·스크린샷·출력도 원본 폴더에 로컬 보존; temp 프로필 제외.

- [results/summary.json](E:/BOGUNON_DEV/qa-output/beta1-native-uia-run-ad425ba5/results/summary.json) — SHA-256 `B202CA99F8D65439C59EBE087E86E965D9921E3E235CFC35B58289BE4E7A5ACF`
- [results/output-verified.json](E:/BOGUNON_DEV/qa-output/beta1-native-uia-run-ad425ba5/results/output-verified.json) — SHA-256 `2AFD8AD54FB58FC53313EA7BC14253202A2D70AE88713473BDF7378860F28DFA`
- [SHA256-MANIFEST.json](E:/BOGUNON_DEV/qa-output/beta1-native-uia-run-ad425ba5/SHA256-MANIFEST.json) — SHA-256 `FBBCA5E48A43737C4A0EB46C9484B2F6B10EFE5FC54DA556182307AFB667639A`
- [screenshots/stage-01.png](E:/BOGUNON_DEV/qa-output/beta1-native-uia-run-ad425ba5/screenshots/stage-01.png) — SHA-256 `788E0D1177B76E1D228A980D5D981CDF967156458485BAA88C27C03D16C12CEA`
- [screenshots/stage-13.png](E:/BOGUNON_DEV/qa-output/beta1-native-uia-run-ad425ba5/screenshots/stage-13.png) — SHA-256 `F18146FE50F02D10E221BE06D08058666970A1EB503663AD026E0A39EDB37C15`

## S07

NSIS 생성·정적 검사 — 표준 NSIS x64, unsigned/asInvoker, 실제 EXE 정적 추출281개와 staging 해시 일치. 기본 데이터 보존 설정.

- [REPORT.md](E:/BOGUNON_DEV/qa-output/beta1-nsis-qa-20261119/REPORT.md) — SHA-256 `7DBA0DAC96F193D0B2B7A9793E9B635E410062413924E529C966E018491AAFC7`
- [results/installer-identity.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-qa-20261119/results/installer-identity.json) — SHA-256 `1678BBEEE28F5A2650F248BF49803D012F3031398C3E4CD39CBE930FCE67417C`
- [results/payload-inspection.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-qa-20261119/results/payload-inspection.json) — SHA-256 `58DD2361CE99EEC83C267B9FC3BF9B85E157D5F7753262B09B6F423977F5F6AF`
- [results/pe-resources.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-qa-20261119/results/pe-resources.json) — SHA-256 `0FFB8F497153CDB6014FD12398EB12EE647F1A6F0BDE7AF86D01AC47BA3A93DA`
- [results/final-protection.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-qa-20261119/results/final-protection.json) — SHA-256 `478277C08D3700BD93F40AAC230F854BD13F5304B0825DFF31C4820B7659A30F`

## S08

현재 집 PC 실제 설치·제거·재설치 — 현재 사용자 단위/비상승, 전용 합성 QA 프로필. 기본 운영 프로필 업무 실행·다른 버전 업그레이드·학교 PC 정책 미검증. 실제 데이터 백업/프로필은 제외.

- [REPORT.md](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/REPORT.md) — SHA-256 `E25E2FF57EAD75EE4AC278A913932B517770F8A79782E3C3E590686D68CC3FE3`
- [results/preflight.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/preflight.json) — SHA-256 `5697128EC419D8C4E0AF3500C0D1C4271CDF55E1FA2A19B878AE539BEF433149`
- [results/installed-payload.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/installed-payload.json) — SHA-256 `D071C207BD5210CD0CEB8C28D58CB98BA7A0EE088D7B57DB5A914AC2CC34DD61`
- [results/app-seed-cdp.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/app-seed-cdp.json) — SHA-256 `A16CFF8E273E380DC9EBC9B46394DBF14D18DC00CC2AAD0ABC2DC49F5D3766D9`
- [results/app-verify-cdp.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/app-verify-cdp.json) — SHA-256 `54EDF02928268D0DFE0835DAD1CA04E133E29F9DABEE4722D69A066F72C3475D`
- [results/app-official-cdp.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/app-official-cdp.json) — SHA-256 `D81EA680AB09E40EBEEB8E5E083F50D6AC979E6E3E003965EB2F4B7D9A070C96`
- [results/app-record-cdp.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/app-record-cdp.json) — SHA-256 `8113E16CE31C112A8519CCC5000FC7382E52DF71782733BC1B4D4F591073A475`
- [results/app-purchase-cdp.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/app-purchase-cdp.json) — SHA-256 `1A8FB7B9816ED9CC4FBDA083393B14A9D97C09977DBB73AAE9FA7680106DB464`
- [results/uninstall-verification.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/uninstall-verification.json) — SHA-256 `DAC67B75963E2695349C9FA23E947BAF19C19EBCDAD4EA4B8A5344CB59FA7884`
- [results/standard-uninstall-verification.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/standard-uninstall-verification.json) — SHA-256 `792450782C610BA90C8A53F44AE0FB33BDA5235DF7EB09DD091BE1517235B69C`
- [results/business-data-after-standard-uninstall.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/business-data-after-standard-uninstall.json) — SHA-256 `5EFF810B5036FBAAC0E756AD1B1C5049AF4B9AA82998933216F7C3B80C26F16E`
- [results/app-final-finalproof.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/app-final-finalproof.json) — SHA-256 `4F653C1D1F4D28690B53EBEE6955D8736E472467DE3AE8D94D8B3F57BC38B154`
- [results/final-install-state.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/final-install-state.json) — SHA-256 `4640084F70205EA93893FEDD2B5DD1BEB4776092B673AD50A6E1C6D6ECCD5ABD`
- [results/final-protection.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/final-protection.json) — SHA-256 `EEBA0E4FB7C60B9E7D3582A51F45279EFCBE3D2BC5C83672B6BD7CC2136E1ACD`
- [results/summary.json](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/results/summary.json) — SHA-256 `80D78F0009FB24DE7D4AA0452C2657650E97F5217A60B51EF4362D54598AAC8C`
- [screenshots/installed-final-finalproof.png](E:/BOGUNON_DEV/qa-output/beta1-nsis-live-20261119/screenshots/installed-final-finalproof.png) — SHA-256 `582300C53E60C6119C64920A2B335FF9F24C945C63789C546DDEF71734E80D40`

## S09

QA 도구 GitHub 보존·복원 — codex/beta1-native-qa-tools@50d2b0d8c374c18e011bd4f3f9967fbfbb567b80.17개 원격 복원파일/fixture5개 해시 일치, 최소 Native1건 PASS. 새 매개변수화 전체13개 미반복.

- [results/remote-preservation.json](E:/BOGUNON_DEV/qa-output/beta1-functional-qa-20261119/results/remote-preservation.json) — SHA-256 `868970680F8925D4A811F219EAF09BC6661381B1BD92F88339BFFEF255AFC729`
- [results/native-smoke-summary.json](E:/BOGUNON_DEV/qa-output/beta1-functional-qa-20261119/results/native-smoke-summary.json) — SHA-256 `24B28EE7E02D3CD829EBDBFB521D67F7904530253FCB23C6FEEAEAAF7E5B4E97`
- [results/publish-security.json](E:/BOGUNON_DEV/qa-output/beta1-functional-qa-20261119/results/publish-security.json) — SHA-256 `3D656D609882F942DF4A243C7D64691E6419990085876781AB8D2DFCF47FD897`
