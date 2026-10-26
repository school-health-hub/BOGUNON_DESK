import type {AiVideoCandidate} from './aiVideo';
import type {Education} from './model';
import type {LoadedLibrary} from './library';
import type {LibraryEntry} from './libraryV2';
import {parseRecommendationReason,type RecommendationReason} from './recommendationReason';
import {applyCandidateRecord,candidateRecord,mergeCandidateRecords} from './candidateRecord';
type Repository={readonly load:()=>Promise<LoadedLibrary>;readonly save:(entry:LibraryEntry)=>Promise<LoadedLibrary>};
export async function saveAiCandidate(repository:Repository,candidate:AiVideoCandidate,education?:Education,recommendationReason?:RecommendationReason):Promise<LoadedLibrary>{
 const {library}=await repository.load();
 const previous=library.entries.find(entry=>entry.videoId===candidate.videoId);
 const teacher=previous?.teacher??{educationTitle:education?.educationTitle??candidate.title,target:education?.target??'',schedule:education?.schedule??'',instructions:education?.instructions??'',message:'',notes:''};
 const priorRecord=previous?.candidateRecord??(previous?.ai?candidateRecord(previous.ai,previous.ai.checkedAt):undefined);
 const record=mergeCandidateRecords(priorRecord,candidateRecord(candidate));
 const reason=recommendationReason===undefined?previous?.recommendationReason:recommendationReason.status==='deleted'?recommendationReason:parseRecommendationReason({...recommendationReason,text:recommendationReason.text.trim()});
 return repository.save({videoId:candidate.videoId,teacher,provider:previous?.provider??null,ai:applyCandidateRecord(candidate,record),candidateRecord:record,...(reason?{recommendationReason:reason}:{})});
}
