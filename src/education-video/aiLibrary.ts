import type {AiVideoCandidate} from './aiVideo';
import type {Education} from './model';
import type {LoadedLibrary} from './library';
import type {LibraryEntry} from './libraryV2';
type Repository={readonly load:()=>Promise<LoadedLibrary>;readonly save:(entry:LibraryEntry)=>Promise<LoadedLibrary>};
export async function saveAiCandidate(repository:Repository,candidate:AiVideoCandidate,education?:Education):Promise<LoadedLibrary>{
 const {library}=await repository.load();
 const previous=library.entries.find(entry=>entry.videoId===candidate.videoId);
 const teacher=previous?.teacher??{educationTitle:education?.educationTitle??candidate.title,target:education?.target??'',schedule:education?.schedule??'',instructions:education?.instructions??'',message:'',notes:''};
 return repository.save({videoId:candidate.videoId,teacher,provider:previous?.provider??null,ai:candidate});
}
