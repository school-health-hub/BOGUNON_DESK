import type {NewsletterAiConnectionKind,NewsletterAiImageRequest,NewsletterAiStatus,NewsletterAiTextRequest} from '../newsletter-ai-bridge.js'
import type {NewsletterAiStoredCandidate} from './newsletter-ai-candidate-store.js'
import type {NewsletterAiIpcService} from './newsletter-ai-ipc.js'

type Selectable='chatgpt'|'openai-api-key'|'gemini-api-key'

export class NewsletterAiConnectionRouter implements NewsletterAiIpcService{
  private selected:Selectable='openai-api-key'
  constructor(private readonly apiKey:NewsletterAiIpcService,private readonly chatgpt:NewsletterAiIpcService){}
  private active():NewsletterAiIpcService{return this.selected==='chatgpt'?this.chatgpt:this.apiKey}
  async status():Promise<NewsletterAiStatus>{
    const [api,chatgpt]=await Promise.all([this.apiKey.status(),this.chatgpt.status()])
    const apiProvider=api.provider==='gemini'?'gemini-api-key':'openai-api-key'
    const chatgptOption=chatgpt.connections?.find(connection=>connection.kind==='chatgpt')??{kind:'chatgpt' as const,label:'ChatGPT 계정',configured:chatgpt.connected,textAvailable:chatgpt.textAvailable,imageAvailable:false,actualTextCallVerified:false,actualImageCallVerified:false,costStatus:'unknown' as const,detail:chatgpt.textUnavailableReason??'ChatGPT 계정 상태를 확인했습니다.'}
    const options=[
      chatgptOption,
      {kind:'openai-api-key' as const,label:'OpenAI API Key',configured:api.provider==='openai'&&api.connected,textAvailable:api.provider==='openai'&&api.textAvailable,imageAvailable:api.provider==='openai'&&api.imageAvailable,actualTextCallVerified:false,actualImageCallVerified:false,costStatus:'unknown' as const,detail:api.provider==='openai'?'API Key 연결 상태를 사용합니다.':'OpenAI API Key가 현재 선택되지 않았습니다.'},
      {kind:'gemini-api-key' as const,label:'Gemini API Key',configured:api.provider==='gemini'&&api.connected,textAvailable:api.provider==='gemini'&&api.textAvailable,imageAvailable:api.provider==='gemini'&&api.imageAvailable,actualTextCallVerified:false,actualImageCallVerified:false,costStatus:'unknown' as const,detail:api.provider==='gemini'?'API Key 연결 상태를 사용합니다.':'Gemini API Key가 현재 선택되지 않았습니다.'},
    ]
    const unavailable:NewsletterAiStatus={connected:false,provider:this.selected==='openai-api-key'?'openai':'gemini',textModel:null,imageModel:null,textAvailable:false,imageAvailable:false,textUnavailableReason:'설정에서 선택한 API Key 공급자에 연결해 주세요.',imageUnavailableReason:'설정에서 선택한 API Key 공급자에 연결해 주세요.'}
    const selectedStatus:NewsletterAiStatus=this.selected==='chatgpt'?chatgpt:apiProvider===this.selected?api:unavailable
    return {...selectedStatus,selectedConnection:this.selected,connections:options}
  }
  async selectConnection(connection:NewsletterAiConnectionKind):Promise<NewsletterAiStatus>{
    if(connection==='mock')throw new Error('Mock 연결은 격리 QA 프로필에서만 선택할 수 있습니다.')
    this.selected=connection
    return this.status()
  }
  proposeText(request:NewsletterAiTextRequest):Promise<unknown>{return this.active().proposeText(request)}
  generateImageCandidate(request:NewsletterAiImageRequest,references:readonly NewsletterAiStoredCandidate[]){
    if(this.selected==='chatgpt')return this.chatgpt.generateImageCandidate(request,references)
    const expected=this.selected==='openai-api-key'?'openai':'gemini'
    if(request.provider!==expected)throw new Error('선택한 API Key 공급자와 이미지 요청이 일치하지 않습니다.')
    return this.apiKey.generateImageCandidate(request,references)
  }
  cancel(request:Readonly<{requestId:string}>):Promise<void>{return this.active().cancel(request)}
}
