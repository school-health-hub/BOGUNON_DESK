import {describe,expect,it} from 'vitest'
import {
  NEWSLETTER_AI_OUTPUT_CONTRACT,
  parseNewsletterAiConsentManifest,
  parseNewsletterAiImageCandidate,
  parseNewsletterAiPatch,
  parseNewsletterAiProposal,
  parseNewsletterAiProviderCapability,
} from '../newsletter-ai-protocol'
import {NEWSLETTER_SKILL_PROVENANCE} from '../newsletter-skill-provenance'

const hash=(character:string)=>character.repeat(64)
const baseline=()=>({
  projectId:'newsletter-project',
  projectRevision:7,
  projectHash:hash('a'),
  designRevision:3,
  designHash:hash('b'),
})
const topic=(index:number)=>({
  id:`topic-${index}`,
  title:`주제 ${index}`,
  lead:`안내 ${index}`,
  actions:[1,2,3,4].map(action=>`${index}-${action} 실천 수칙`),
  closing:`마무리 ${index}`,
  sources:[{title:`검증 자료 ${index}`,publisher:'공식 기관',url:'https://example.invalid/health'}],
  currentFactReview:'verification-required' as const,
  visualConcept:{summary:`학생 건강 행동 ${index}`,containsEditableKoreanText:false},
})
const proposal=()=>({
  schemaVersion:1,
  proposalId:'proposal-1',
  provider:'mock',
  model:'offline-v1',
  mock:true,
  month:9,
  schoolType:'coeducational',
  baseline:baseline(),
  topics:[1,2,3,4,5,6].map(topic),
  requestId:'request-1',
  promptHash:hash('c'),
  usage:{costStatus:'unknown'},
})

describe('Newsletter AI canonical contracts',()=>{
  it('locks the approved composition and canonical Skill receipts',()=>{
    expect(NEWSLETTER_AI_OUTPUT_CONTRACT).toEqual({topicCount:6,actionsPerTopic:4,a4PageCount:1,cardCount:7})
    expect(NEWSLETTER_SKILL_PROVENANCE.skill).toMatchObject({size:9302,sha256:'5ec501099efc186dc48f21f8138fa1f28c905b2e3a8585c4308de7dd5e235dbb'})
    expect(Object.values(NEWSLETTER_SKILL_PROVENANCE.entries)).toHaveLength(6)
  })

  it('round-trips a six-topic/four-action proposal without mutating input',()=>{
    const input=proposal(),before=structuredClone(input)
    expect(parseNewsletterAiProposal(input)).toEqual(before)
    expect(input).toEqual(before)
  })

  it.each([5,7])('rejects %i topics',count=>{
    const input=proposal(); input.topics=input.topics.slice(0,count)
    if(count===7) input.topics.push(topic(7))
    expect(()=>parseNewsletterAiProposal(input)).toThrow('AI 생성 결과가 보건소식지 계약과 일치하지 않습니다.')
  })

  it.each([3,5])('rejects %i actions per topic',count=>{
    const input=proposal(); input.topics[0]!.actions=input.topics[0]!.actions.slice(0,count)
    if(count===5) input.topics[0]!.actions.push('추가 수칙')
    expect(()=>parseNewsletterAiProposal(input)).toThrow()
  })

  it('rejects duplicate topic IDs, unknown fields, missing baselines, and credential fields without echoing them',()=>{
    const cases:unknown[]=[]
    const duplicate=proposal(); duplicate.topics[1]!.id=duplicate.topics[0]!.id; cases.push(duplicate)
    cases.push({...proposal(),unexpected:'nope'})
    const {baseline:_baseline,...missingBaseline}=proposal(); cases.push(missingBaseline)
    cases.push({...proposal(),apiKey:'sk-fixture-do-not-echo'})
    for(const input of cases){
      try{parseNewsletterAiProposal(input);throw new Error('expected rejection')}
      catch(error){
        expect(String(error)).toContain('AI 생성 결과가 보건소식지 계약과 일치하지 않습니다.')
        expect(String(error)).not.toContain('sk-fixture-do-not-echo')
        expect(String(error)).not.toContain('검증 자료')
      }
    }
  })

  it('round-trips an exact-file consent manifest with honest unknown cost',()=>{
    const input={
      schemaVersion:1,requestId:'request-1',operation:'generate-image',provider:'openai',model:'image-model',mock:false,
      files:[{name:'reference.png',sha256:hash('d'),byteSize:1234,purpose:'주제 삽화 참고'}],
      cost:{status:'unknown'},noRecallAfterTransmission:true,consentedAt:'2026-11-13T01:02:03.000Z',
    }
    const before=structuredClone(input)
    expect(parseNewsletterAiConsentManifest(input)).toEqual(before)
    expect(input).toEqual(before)
    expect(()=>parseNewsletterAiConsentManifest({...input,files:[{...input.files[0],sha256:'bad'}]})).toThrow()
  })

  it('accepts only bounded approval-pending generated-image metadata',()=>{
    const input={
      schemaVersion:1,candidateId:'candidate-1',assetType:'AI_GENERATED',exportApproval:'pending',provider:'gemini',model:'image-model',mock:false,
      requestId:'request-1',createdAt:'2026-11-13T01:02:03.000Z',promptHash:hash('e'),inputHashes:[hash('f')],outputHash:hash('0'),
      mediaType:'image/png',byteSize:2048,width:1800,height:1800,baseline:baseline(),usage:{costStatus:'unknown'},
    }
    expect(parseNewsletterAiImageCandidate(input)).toEqual(input)
    expect(()=>parseNewsletterAiImageCandidate({...input,exportApproval:'approved'})).toThrow()
    expect(()=>parseNewsletterAiImageCandidate({...input,mediaType:'text/html'})).toThrow()
    expect(()=>parseNewsletterAiImageCandidate({...input,outputHash:'bad'})).toThrow()
    expect(()=>parseNewsletterAiImageCandidate({...input,byteSize:100_000_001})).toThrow()
    expect(()=>parseNewsletterAiImageCandidate({...input,apiKey:'secret'})).toThrow()
  })

  it('separates structured text and image capabilities without inferring support',()=>{
    const capability={
      provider:'openai',model:'known-model',
      text:{generate:true,structuredOutput:true,maxInputBytes:100_000},
      image:{generate:false,edit:false,referenceInput:false,maxInputBytes:0,maxOutputBytes:0,maxDimension:0},
    }
    expect(parseNewsletterAiProviderCapability(capability)).toEqual(capability)
    expect(()=>parseNewsletterAiProviderCapability({...capability,image:{...capability.image,generate:true,maxOutputBytes:0}})).toThrow()
    expect(()=>parseNewsletterAiProviderCapability({...capability,apiKey:'secret'})).toThrow()
  })

  it('requires a baseline-bound, unique field-level patch selection',()=>{
    const patch={
      schemaVersion:1,proposalId:'proposal-1',baseline:baseline(),
      selections:[
        {topicId:'topic-1',fields:['title','lead','actions']},
        {topicId:'topic-2',fields:['visualConcept']},
      ],
    }
    expect(parseNewsletterAiPatch(patch)).toEqual(patch)
    expect(()=>parseNewsletterAiPatch({...patch,baseline:undefined})).toThrow()
    expect(()=>parseNewsletterAiPatch({...patch,selections:[patch.selections[0],patch.selections[0]]})).toThrow()
    expect(()=>parseNewsletterAiPatch({...patch,selections:[{topicId:'topic-1',fields:[]}]})).toThrow()
  })
})
