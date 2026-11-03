import {createNewsletterProject} from './project'
import {createNewsletterDesignState} from './rendering/designSchema'
import {upgradeNewsletterDesignStateV2} from './rendering/designState'
import {attachApprovedMascot} from './rendering/bundledMascot'
import {parseStudioDocument,type StudioDocument} from './studioDocument'

export const newsletterSchoolTypes={'girls-high':'여학교','boys-high':'남학교','coed-high':'남녀공학'} as const
export type NewsletterSchoolType=keyof typeof newsletterSchoolTypes
export async function createBlankNewsletter(input:{month:string;schoolType:NewsletterSchoolType;projectId:string;now:string}):Promise<StudioDocument>{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)||Number(input.month.slice(0,4))<1||!Object.prototype.hasOwnProperty.call(newsletterSchoolTypes,input.schoolType))throw Error('작성 월과 학교 유형을 확인해 주세요.')
 const [year,month]=input.month.split('-'),issueLabel=`${year}년 ${Number(month)}월 · ${newsletterSchoolTypes[input.schoolType]}`
 const project=await createNewsletterProject({projectId:input.projectId,title:`${issueLabel} 보건소식지`,now:input.now,topics:Array.from({length:6},(_,index)=>({id:`topic-${index+1}`,title:`주제 ${index+1}`,text:''}))})
 const design=attachApprovedMascot(upgradeNewsletterDesignStateV2(createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now:input.now,issueLabel}),input.now),input.now)
 return parseStudioDocument({project,design})
}
