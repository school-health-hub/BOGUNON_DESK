import type { AiVideoCandidate, SearchConditions } from '../education-video/aiVideo';

export const syntheticConditions: SearchConditions = { topic: '합성 마약류 예방교육', target: '고등학생', minutes: 20, publicFirst: true };
export const syntheticCandidate: AiVideoCandidate = {
  videoId: 'QAoffline01', url: 'https://www.youtube.com/watch?v=QAoffline01',
  title: '[합성] Finder 저장·기안 연습용', publisher: '[합성] 가상 교육기관', durationSeconds: 1200,
  description: '오프라인 QA를 위한 합성 소개정보입니다. 실제 영상 조회·시청·검색 결과가 아닙니다.',
  relevance: '교육 주제 전달을 확인하기 위한 합성 자료', reason: '추천 결과가 아닌 QA 데이터입니다.',
  sources: [{ url: 'https://www.youtube.com/watch?v=QAoffline01', title: '[합성] 실제 출처 아님' }],
  checkedAt: new Date().toISOString(), needsReview: true, provenance: 'unverified',
  metadataVerification: { title: 'unverified', publisher: 'unverified', durationSeconds: 'unverified' },
};
