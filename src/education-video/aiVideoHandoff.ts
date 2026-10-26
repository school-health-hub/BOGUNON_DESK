import { buildVideoSearchPrompt, canonicalVideoUrl, type SearchConditions } from './aiVideo';

export type TeacherVideoUrlError = {
  readonly line: number;
  readonly reason: string;
};

export type ParsedTeacherVideoUrls = {
  readonly videos: readonly { readonly videoId: string; readonly url: string }[];
  readonly errors: readonly TeacherVideoUrlError[];
};

export function parseTeacherVideoUrls(value: string, existingVideoIds: readonly string[]): ParsedTeacherVideoUrls {
  const existing = new Set(existingVideoIds);
  const accepted = new Set<string>();
  const videos: { videoId: string; url: string }[] = [];
  const errors: TeacherVideoUrlError[] = [];
  value.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === '') return;
    const video = canonicalVideoUrl(trimmed);
    if (video === null) {
      errors.push({ line: index + 1, reason: '지원되는 HTTPS YouTube 개별 영상 URL이 아닙니다.' });
      return;
    }
    if (accepted.has(video.videoId)) {
      errors.push({ line: index + 1, reason: '같은 영상이 입력에 중복되어 있습니다.' });
      return;
    }
    if (existing.has(video.videoId)) {
      errors.push({ line: index + 1, reason: '이미 후보 목록에 있는 영상입니다.' });
      return;
    }
    accepted.add(video.videoId);
    videos.push(video);
  });
  return { videos, errors };
}

export function buildYouTubeSearchHandoff(conditions: SearchConditions): { readonly query: string; readonly url: string } {
  buildVideoSearchPrompt(conditions);
  const topic = conditions.topic.trim();
  const terms = [topic, conditions.target, '교육 영상'];
  if (conditions.minutes !== null) terms.push(`${conditions.minutes}분`);
  if (conditions.publicFirst) terms.push('공공기관 교육기관');
  const query = terms.join(' ');
  const url = new URL('https://www.youtube.com/results');
  url.searchParams.set('search_query', query);
  return { query, url: url.toString() };
}
