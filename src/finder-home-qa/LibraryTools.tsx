import { useState } from 'react';
import type { LoadedLibrary } from '../education-video/library';
import type { LibraryV2 } from '../education-video/libraryV2';
import { qaLibraryRepository as libraryRepository } from './qaLibrary';

export function LibraryTools({ library, onLoaded, onNotice }: {
  readonly library: LibraryV2; readonly onLoaded: (loaded: LoadedLibrary) => void; readonly onNotice: (notice: string) => void;
}) {
  const [json, setJson] = useState('');
  const run = async (operation: () => Promise<LoadedLibrary>): Promise<void> => {
    try { onLoaded(await operation()); onNotice('QA 라이브러리 작업을 완료했습니다.'); }
    catch (error) { if (!(error instanceof Error) && typeof error !== 'string') throw error; onNotice('작업하지 못했습니다. 기존 QA 자료는 유지됩니다. 복구 가능한 백업을 확인하세요.'); }
  };
  return <section className="aiv-settings" aria-label="QA 로컬 라이브러리 관리">
    <h2>QA 로컬 라이브러리 · {library.entries.length}개</h2>
    <p>합성 데이터만 사용하세요. 운영 라이브러리·인증정보와 분리됩니다.</p>
    <button type="button" onClick={() => { void run(libraryRepository.load); }}>QA 라이브러리 다시 읽기</button>
    <button type="button" onClick={() => { void run(libraryRepository.recover); }}>QA 백업 복구</button>
    {library.entries.map(entry => <form key={`${entry.videoId}:${entry.teacher.notes}`} onSubmit={event => {
      event.preventDefault(); const value = new FormData(event.currentTarget).get('notes');
      if (typeof value === 'string') void run(() => libraryRepository.save({ ...entry, teacher: { ...entry.teacher, notes: value } }));
    }}><label>{entry.videoId} QA 메모<textarea name="notes" defaultValue={entry.teacher.notes} maxLength={20000} /></label><button type="submit">QA 메모 저장</button></form>)}
    <label>QA 라이브러리 JSON<textarea rows={6} value={json} onChange={event => setJson(event.currentTarget.value)} /></label>
    <button type="button" onClick={() => { void libraryRepository.export().then(setJson).catch((error: unknown) => {
      if (!(error instanceof Error) && typeof error !== 'string') throw error; onNotice('내보내지 못했습니다. 기존 QA 자료는 유지됩니다.');
    }); }}>QA JSON 내보내기</button>
    <button type="button" disabled={!json.trim()} onClick={() => { void run(() => libraryRepository.import(json)); }}>QA JSON 가져오기</button>
  </section>;
}
