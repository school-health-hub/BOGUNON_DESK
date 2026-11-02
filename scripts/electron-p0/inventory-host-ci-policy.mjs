import {existsSync} from 'node:fs';
export const DB_BASELINE='95e4f10415a971790d476dd58ac42a12b1ffb80c';
export const HOST_BASELINE='9915eff1ea5a016977b017ab9bedf9f1f9070e1f';
export const HOST_CI_REF='refs/heads/ci/inventory-electron-host-qa';
export function validateHostCi(env,platform,root){
 if(platform!=='linux'||env.GITHUB_ACTIONS!=='true'||env.INVENTORY_HOST_CI_ONLY!=='1'||env.GITHUB_REPOSITORY!=='school-health-hub/BOGUNON_DESK'||env.GITHUB_REF!==HOST_CI_REF||env.GITHUB_EVENT_NAME!=='push'||!env.RUNNER_TEMP||env.DOCKER_HOST||env.DOCKER_CONTEXT)throw Error('CI_CONTEXT');
 if(Object.keys(env).some(k=>/^(VITE_SUPABASE_|SUPABASE_(URL|ACCESS_TOKEN|DB_PASSWORD|SERVICE_ROLE|SECRET|PROJECT_REF))/.test(k))||['.env','.env.local','.env.production'].some(f=>existsSync(`${root}/${f}`)))throw Error('EXTERNAL_ENV');
}
export function validateLocalConfig(config){if(!/^project_id\s*=\s*"inventory_qa"/m.test(config)||!/^port\s*=\s*56321\s*$/m.test(config)||/https:\/\//.test(config))throw Error('LOCAL_CONFIG');}
export const EXPECTED_CASES=['AUTH_SCHOOL','REGISTER_READ_DETAIL','RECEIVE_USE_REPLAY','DISPOSE_ADJUST','TENANT_PERMISSION','CONTEXT_DISCARD_LOGOUT','CLIENT_AUTH_EXPIRY','REAL_GATEWAY_TIMEOUT','REAL_GATEWAY_DISCONNECT','PRODUCTION_DENIED'];
export function validateRealReport(value){if(!value||value.status!=='PASS'||value.realDatabase!==true||value.mockTransport!==false||value.actualElectronProcess!==false||JSON.stringify(value.passedCases)!==JSON.stringify(EXPECTED_CASES))throw Error('REAL_E2E_INCOMPLETE');}
