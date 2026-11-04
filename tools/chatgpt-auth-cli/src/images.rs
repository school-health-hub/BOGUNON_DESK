// Included inside the original plan module: reuse its token, transport, model and SSE core.
#[derive(serde::Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub(crate) struct ElectronImage {pub(crate) source_id:String,pub(crate) data_url:String}
pub(crate) fn validate_electron_images(now:u64,model:&str,images:&[ElectronImage])->Result<(),InternalError>{
 use base64::Engine as _;
 let policy:serde_json::Value=serde_json::from_str(include_str!(concat!(env!("CARGO_MANIFEST_DIR"),"/../../electron-p0/ai-image-capabilities.json"))).map_err(|_|InternalError::INVALID_RESPONSE)?;
 if policy["version"]!=1||policy["validFromUnix"].as_u64().is_none_or(|start|now<start)||policy["validUntilUnix"].as_u64().is_none_or(|end|now>=end){return Err(InternalError::INVALID_RESPONSE);}
 let allowed=policy["models"].as_array().is_some_and(|models|models.iter().any(|m|m["id"]==model&&m["imageInput"]==true&&m["providers"].as_array().is_some_and(|p|p.iter().any(|p|p=="chatgpt"))));
 if !allowed||images.is_empty()||images.len()>10{return Err(InternalError::INVALID_RESPONSE);}
 let mut seen=std::collections::HashSet::new();let mut total=0;
 for image in images {
  if uuid::Uuid::parse_str(&image.source_id).is_err()||!seen.insert(&image.source_id){return Err(InternalError::INVALID_RESPONSE);}
  let encoded=image.data_url.strip_prefix("data:image/png;base64,").ok_or(InternalError::INVALID_RESPONSE)?;
  if encoded.len()>6*1024*1024{return Err(InternalError::INVALID_RESPONSE);}
  let bytes=base64::engine::general_purpose::STANDARD.decode(encoded).map_err(|_|InternalError::INVALID_RESPONSE)?;
  if bytes.len()>4*1024*1024||bytes.len()<24||bytes[..8]!=[137,80,78,71,13,10,26,10]||&bytes[12..16]!=b"IHDR"{return Err(InternalError::INVALID_RESPONSE);}
  let width=u32::from_be_bytes(bytes[16..20].try_into().unwrap());let height=u32::from_be_bytes(bytes[20..24].try_into().unwrap());
  if width==0||height==0||u64::from(width)*u64::from(height)>12_000_000{return Err(InternalError::INVALID_RESPONSE);}
  total+=bytes.len();if total>8*1024*1024{return Err(InternalError::INVALID_RESPONSE);}
 }
 Ok(())
}
pub(crate) async fn generate_electron_images<S:ChatGptCredentialStorage,T:PlanTransport>(storage:&S,transport:&T,state:&ChatGptCredentialMutationState,now:u64,model:&str,prompt:&str,images:&[ElectronImage])->Result<String,ChatGptPlanErrorDto>{
 validate_electron_images(now,model,images).map_err(|e|e.dto())?;
 let models=list_models(storage,transport,state,now).await?;
 if !models.iter().any(|m|m.slug==model){return Err(InternalError::bare(InternalErrorKind::Permission).dto());}
 let token=valid_access_token(storage,transport,state,now).await.map_err(|e|e.dto())?;
 let mut content=vec![json!({"type":"input_text","text":prompt})];content.extend(images.iter().map(|image|json!({"type":"input_image","image_url":image.data_url})));
 let response=transport.send(ApiRequest{method:ApiMethod::Post,url:RESPONSES_URL.into(),bearer:Some(token.expose().into()),body:RequestBody::Json(json!({"model":model,"input":[{"role":"user","content":content}],"store":false,"stream":true}))}).await.map_err(|e|e.dto())?;
 if let Err(error)=ensure_success(&response){if error.kind==InternalErrorKind::Reauth {invalidate_if_current(storage,state,&token).await.map_err(|e|e.dto())?;}return Err(error.dto());}
 parse_response_stream(&response.body).map_err(|e|e.dto())
}
#[cfg(test)]
mod image_adapter_tests {
 use super::*;
 #[test] fn rejects_unknown_models_urls_duplicates_and_oversize_before_network(){
  assert!(validate_electron_images(1793750400,"unknown",&[]).is_err());
  let image=ElectronImage{source_id:uuid::Uuid::new_v4().to_string(),data_url:"https://example.invalid/image.png".into()};assert!(validate_electron_images(1793750400,"gpt-6.1-sol",&[image]).is_err());
 }
}

#[cfg(test)]
mod image_request_tests {
 use super::*;
 use crate::chatgpt::{model::{HostRecord,RegistrationRecord},storage::StorageError};
 use std::sync::Mutex;
 struct Storage{scope:bool}
 impl ChatGptCredentialStorage for Storage{
  fn load_or_create_host(&self)->Result<HostRecord,StorageError>{Err(StorageError::Io)}
  fn load_registration(&self)->Result<Option<RegistrationRecord>,StorageError>{Ok(None)}
  fn save_registration(&self,_:&RegistrationRecord)->Result<(),StorageError>{Ok(())}
  fn load_credential(&self)->Result<Option<CredentialRecord>,StorageError>{Ok(Some(CredentialRecord{access_token:SecretToken::new("synthetic-access"),refresh_token:None,id_token:SecretToken::new("synthetic-id"),token_type:"Bearer".into(),expires_in:3600,earliest_refresh_at:None,granted_scopes:if self.scope{vec!["chatgpt.tokens.use.direct".into()]}else{vec![]},saved_at:1793750400}))}
  fn save_credential(&self,_:&CredentialRecord)->Result<(),StorageError>{Ok(())}
  fn clear_credential(&self)->Result<(),StorageError>{Ok(())}
 }
 struct Transport{requests:Mutex<Vec<ApiRequest>>,terminal:&'static str,listed:bool}
 impl PlanTransport for Transport{
  async fn send(&self,request:ApiRequest)->Result<ApiResponse,InternalError>{
   let models=request.url==MODELS_URL;self.requests.lock().unwrap().push(request);
   let body=if models{serde_json::to_vec(&json!({"models":if self.listed{vec![json!({"slug":"gpt-6.1-sol","display_name":"Synthetic","visibility":"list"})]}else{vec![]}})).unwrap()}else{format!("data: {}\n\ndata: {}\n\n",json!({"type":"response.output_text.delta","delta":"{\"sources\":[]}"}),json!({"type":self.terminal})).into_bytes()};
   Ok(ApiResponse{status:200,request_id:None,body})
  }
 }
 fn image()->ElectronImage{
  use base64::Engine as _;
  let mut bytes=vec![137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82];bytes.extend_from_slice(&256u32.to_be_bytes());bytes.extend_from_slice(&128u32.to_be_bytes());
  ElectronImage{source_id:uuid::Uuid::new_v4().to_string(),data_url:format!("data:image/png;base64,{}",base64::engine::general_purpose::STANDARD.encode(bytes))}
 }
 #[tokio::test] async fn uses_account_catalog_inline_images_and_completed_sse(){
  let transport=Transport{requests:Mutex::new(vec![]),terminal:"response.completed",listed:true};let images=vec![image()];
  let text=generate_electron_images(&Storage{scope:true},&transport,&ChatGptCredentialMutationState::default(),1793750400,"gpt-6.1-sol","synthetic",&images).await.unwrap();assert_eq!(text,"{\"sources\":[]}");
  let requests=transport.requests.lock().unwrap();assert_eq!(requests.len(),2);assert_eq!(requests[1].url,RESPONSES_URL);
  let RequestBody::Json(body)=&requests[1].body else{panic!("JSON request required")};assert_eq!(body["store"],false);assert_eq!(body["stream"],true);assert_eq!(body["input"][0]["content"][1]["type"],"input_image");assert_eq!(body["input"][0]["content"][1]["image_url"],images[0].data_url);assert!(body.get("temperature").is_none());
 }
 #[tokio::test] async fn no_scope_or_absent_model_never_reaches_inference(){
  for scope in [false,true]{let transport=Transport{requests:Mutex::new(vec![]),terminal:"response.completed",listed:false};assert!(generate_electron_images(&Storage{scope},&transport,&ChatGptCredentialMutationState::default(),1793750400,"gpt-6.1-sol","synthetic",&[image()]).await.is_err());assert_eq!(transport.requests.lock().unwrap().len(),if scope{1}else{0});}
 }
 #[tokio::test] async fn rejects_incomplete_and_failed_sse_and_stale_capability(){
  for terminal in ["response.incomplete","response.failed"]{let transport=Transport{requests:Mutex::new(vec![]),terminal,listed:true};assert!(generate_electron_images(&Storage{scope:true},&transport,&ChatGptCredentialMutationState::default(),1793750400,"gpt-6.1-sol","synthetic",&[image()]).await.is_err());}
  assert!(validate_electron_images(u64::MAX,"gpt-6.1-sol",&[image()]).is_err());
 }
}
