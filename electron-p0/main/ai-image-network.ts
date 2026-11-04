import {aiJson,AI_ERROR,AiError,type AiFetch,extractAiText} from './ai-network.js';
import {supportsImage,IMAGE_AI_LIMITS,type OutboundImage} from './ai-image-contract.js';
import type {AiProvider} from '../protocol.js';
export async function generateApiImages(fetcher:AiFetch,provider:AiProvider,key:string,model:string,prompt:string,images:readonly OutboundImage[],signal:AbortSignal):Promise<string>{
 if(!supportsImage(provider,model)||!images.length||images.length>10||images.some(i=>!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(i.dataUrl)))throw new AiError('이미지 지원이 확인된 모델과 전송본이 필요합니다.');
 const body=provider==='openai'?{model,store:false,input:[{role:'user',content:[{type:'input_text',text:prompt},...images.map(i=>({type:'input_image',image_url:i.dataUrl}))]}]}:{contents:[{role:'user',parts:[{text:prompt},...images.map(i=>({inlineData:{mimeType:'image/png',data:i.dataUrl.slice('data:image/png;base64,'.length)}}))]}]};
 if(Buffer.byteLength(JSON.stringify(body))>IMAGE_AI_LIMITS.requestBytes)throw new AiError('이미지 요청 크기 제한을 초과했습니다.');
 const result=await aiJson(fetcher,provider==='openai'?'https://api.openai.com/v1/responses':`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,provider,key,signal,body);
 const text=extractAiText(provider,result);if(text.includes(key))throw new AiError(AI_ERROR.invalid);return text;
}
