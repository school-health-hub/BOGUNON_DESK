import { libraryRepository, type LoadedLibrary } from '../education-video/library';
import { parseLibraryV2, type LibraryEntry } from '../education-video/libraryV2';
import { FinderQaBlockedError } from './inertConnections';
import { syntheticCandidate } from './syntheticFixture';

const validateEntries = (entries: readonly LibraryEntry[]): void => {
  if (entries.some(entry => entry.videoId !== syntheticCandidate.videoId
    || (entry.provider !== null && (!entry.provider.synthetic || entry.provider.source !== 'synthetic-mock'
      || entry.provider.official || entry.provider.officialEvidence !== null || entry.provider.url !== syntheticCandidate.url))
    || (entry.ai !== undefined && (entry.ai.videoId !== syntheticCandidate.videoId || entry.ai.url !== syntheticCandidate.url
      || !['unverified', 'teacher-supplied'].includes(entry.ai.provenance)
      || entry.ai.sources.some(source => source.url !== syntheticCandidate.url)))
    || (entry.candidateRecord !== undefined && !['unverified', 'teacher-supplied'].includes(entry.candidateRecord.provenance)))) throw new FinderQaBlockedError();
};
const checked = (loaded: LoadedLibrary): LoadedLibrary => { validateEntries(loaded.library.entries); return loaded; };
export const qaLibraryRepository = {
  load: async (): Promise<LoadedLibrary> => checked(await libraryRepository.load()),
  save: async (entry: LibraryEntry): Promise<LoadedLibrary> => {
    validateEntries([entry]); return checked(await libraryRepository.save(entry));
  },
  import: async (json: string): Promise<LoadedLibrary> => {
    validateEntries(parseLibraryV2(json).entries); return checked(await libraryRepository.import(json));
  },
  export: async (): Promise<string> => {
    const json = await libraryRepository.export(); validateEntries(parseLibraryV2(json).entries); return json;
  },
  recover: async (): Promise<LoadedLibrary> => checked(await libraryRepository.recover()),
};
