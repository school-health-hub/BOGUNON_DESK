import {createClient} from '@supabase/supabase-js';
import {SCHOOL_COLUMNS,type AccountConfig} from './account-network.js';
export type AccountStorage={getItem(key:string):Promise<string|null>;setItem(key:string,value:string):Promise<void>;removeItem(key:string):Promise<void>};
export function createAccountClient(config:AccountConfig,storage:AccountStorage,fetcher:typeof fetch){
 // Reuse the same official SDK/Google provider/PKCE flow-ID mode as Tauri.
 const boundedFetch:typeof fetch=async(input,init)=>{try{return await fetcher(input,init);}catch{return Response.json({message:'Account request unavailable',code:'account_transport_unavailable'},{status:499});}};
 const client=createClient(config.origin,config.publishableKey,{auth:{autoRefreshToken:false,persistSession:true,detectSessionInUrl:false,flowType:'pkce',experimental:{appendPkceFlowIdToRedirects:true},storage,debug:false},global:{fetch:boundedFetch}});
 return {session:()=>client.auth.getSession(),user:()=>client.auth.getUser(),start:(redirectTo:string)=>client.auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}}),exchange:(code:string,flowId:string)=>client.auth.exchangeCodeForSession(code,{flowId}),refresh:()=>client.auth.refreshSession(),logout:()=>client.auth.signOut({scope:'local'}),school:(id:string)=>client.from('user_settings').select(SCHOOL_COLUMNS).eq('user_id',id).maybeSingle(),stop:()=>client.auth.dispose()};
}
export type AccountClient=ReturnType<typeof createAccountClient>;
