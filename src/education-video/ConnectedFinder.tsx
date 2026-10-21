import {useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {authService} from '../auth/authService';
import {getSupabaseClient} from '../auth/supabaseClient';
import {EducationVideoFinder} from './EducationVideoFinder';
import type {FinderAuthStatus} from './searchService';
export function ConnectedFinder({onClose}:{readonly onClose:()=>void}){
 const [auth,setAuth]=useState(authService.getState);
 const [sessionStatus,setSessionStatus]=useState<FinderAuthStatus>('loading');
 useEffect(()=>authService.subscribe(setAuth),[]);
 useEffect(()=>{
  if(auth.status!=='signedIn'){setSessionStatus(auth.status==='loading'?'loading':'signedOut');return;}
  let active=true;let timer:ReturnType<typeof setTimeout>|null=null;
  const update=(session:Session|null):void=>{
   if(!active)return;if(timer!==null)clearTimeout(timer);
   const remaining=(session?.expires_at??0)*1000-Date.now();
   if(!session||session.user.id!==auth.user?.id||remaining<=0){setSessionStatus('signedOut');return;}
   setSessionStatus('signedIn');timer=setTimeout(()=>setSessionStatus('signedOut'),Math.min(remaining,2147483647));
  };
  try{
   const client=getSupabaseClient();const {data}=client.auth.onAuthStateChange((_event,session)=>update(session));
   void client.auth.getSession().then(({data,error})=>update(error?null:data.session)).catch(()=>{if(active)setSessionStatus('signedOut');});
   return()=>{active=false;if(timer!==null)clearTimeout(timer);data.subscription.unsubscribe();};
  }catch{setSessionStatus('signedOut');return()=>{active=false;if(timer!==null)clearTimeout(timer);};}
 },[auth.status,auth.user?.id]);
 return <EducationVideoFinder onClose={onClose} authStatus={sessionStatus} authIdentity={auth.user?.id??''}/>;
}
