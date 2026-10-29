import type { LibraryEntry } from './libraryV2';
import './libraryEntrySummary.css';

/** Shared by the production library and the isolated QA management panel. No URL opener. */
export function LibraryEntrySummary({ entry }: { readonly entry: LibraryEntry }) {
  const title = entry.candidateRecord?.title ?? entry.provider?.title ?? entry.ai?.title ?? entry.teacher.educationTitle;
  const url = `https://www.youtube.com/watch?v=${entry.videoId}`;
  return <div className="ev-entry-summary">
    <strong>{title || '저장된 교사 자료'}</strong>
    <span className="ev-entry-url">{url}</span>
    <small>{entry.teacher.target} · {entry.videoId}</small>
  </div>;
}
