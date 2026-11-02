import {createNewsletterProject} from '../../src/newsletter/project';
import {createNewsletterDesignState} from '../../src/newsletter/rendering/designSchema';
import {upgradeNewsletterDesignStateV2} from '../../src/newsletter/rendering/designState';
export const compatibilityNow='2026-11-02T00:00:00.000Z';
export async function compatibilityFixture(v2=true){
 const project=await createNewsletterProject({projectId:'synthetic-compatibility',title:'합성 정상 원고',now:compatibilityNow});
 const v1=createNewsletterDesignState({projectId:project.projectId,canonicalProjectRevision:1,now:compatibilityNow});
 return {project,design:v2?upgradeNewsletterDesignStateV2(v1,compatibilityNow):v1};
}
export function rawClone<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
