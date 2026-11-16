import { z } from 'zod';
const line = z.string().trim().max(1000).refine(value => !/[\r\n]/u.test(value), '한 줄 문구를 입력해 주세요.');
export const monthlySourceSchema = z.object({
    kind: z.enum(['local-fixture', 'local-archive', 'approved-bank', 'manual']),
    label: z.string().trim().min(1).max(200), reference: z.string().trim().min(1).max(1000),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
}).strict().readonly();
export const monthlyTopicSchema = z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/u), title: line.min(1).max(120),
    year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12),
    schoolType: z.enum(['girls-high', 'boys-high', 'coed-high', 'all']),
    source: monthlySourceSchema, reviewStatus: z.enum(['pending', 'reviewed', 'rejected']),
    lead: line.default(''), actions: z.array(line).max(4).default([]), closing: line.default(''),
    tags: z.array(line.max(60)).max(20).default([]),
}).strict().readonly();
export const topicSelectionSchema = z.object({
    selectedMonth: z.string().regex(/^20\d{2}-(?:0[1-9]|1[0-2])$/u),
    source: monthlySourceSchema, sourceYear: z.number().int().min(2000).max(2100), sourceMonth: z.number().int().min(1).max(12),
    closing: line, reviewStatus: z.enum(['pending', 'reviewed']),
}).readonly();
export type MonthlyTopic = z.infer<typeof monthlyTopicSchema>;
export function topicKey(title: string): string {
    const value = title.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '').replace(/올바른|건강한|함께하는|실천하기|실천법/gu, '');
    for (const [key, pattern] of [['handwashing', /손씻|손위생/u], ['sleep', /수면|잠자기/u], ['infection', /감염병|감염예방/u], ['friendship', /친구관계|교우관계/u]] as const)
        if (pattern.test(value))
            return key;
    return value;
}
export function parseMonthlyBank(text: string): readonly MonthlyTopic[] {
    if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
        throw Error('주제 은행은 2MiB 이하 JSON만 가져올 수 있습니다.');
    const input: unknown = JSON.parse(text);
    const topics = Array.isArray(input) ? z.array(monthlyTopicSchema).max(1000).parse(input) : z.object({ version: z.literal(1), topics: z.array(monthlyTopicSchema).max(1000) }).strict().parse(input).topics;
    if (new Set(topics.map(value => value.id)).size !== topics.length)
        throw Error('주제 ID를 고유하게 지정해 주세요.');
    return topics;
}
export function recommendMonthlyTopics(bank: readonly MonthlyTopic[], month: string, schoolType: string): readonly {
    topic: MonthlyTopic;
    reason: string;
}[] {
    if (!/^20\d{2}-(?:0[1-9]|1[0-2])$/u.test(month))
        return [];
    const year = Number(month.slice(0, 4)), selected = Number(month.slice(5));
    const candidates = bank.flatMap(topic => {
        if (topic.reviewStatus === 'rejected' || topic.source.kind === 'manual' || (topic.schoolType !== 'all' && topic.schoolType !== schoolType))
            return [];
        if (topic.year * 12 + topic.month >= year * 12 + selected)
            return [];
        const distance = Math.min(Math.abs(selected - topic.month), 12 - Math.abs(selected - topic.month));
        const tier = distance === 0 ? 0 : distance === 1 ? 1 : topic.source.kind === 'approved-bank' && topic.reviewStatus === 'reviewed' ? 2 : 3;
        if (tier === 3)
            return [];
        const label = topic.source.kind === 'local-fixture' ? '합성 예시 · 실제 발행 이력 아님' : topic.source.kind === 'local-archive' ? '가져온 출처 기록 · 발행 사실 별도 확인' : topic.reviewStatus === 'reviewed' ? '검토 표시된 주제 은행' : '주제 은행 · 검토 필요';
        return [{ topic, reason: `${tier === 0 ? '같은 월' : tier === 1 ? '인접 월' : '승인 주제 은행'} 우선 · ${topic.year}년 ${topic.month}월 · ${label}`, tier }];
    }).sort((a, b) => a.tier - b.tier || b.topic.year - a.topic.year || a.topic.id.localeCompare(b.topic.id));
    const seen = new Set<string>();
    return candidates.filter(value => { const key = topicKey(value.topic.title); if (seen.has(key))
        return false; seen.add(key); return true; }).map(({ topic, reason }) => ({ topic, reason }));
}
// Explicitly requested demonstration data. Never installed as publication history.
export function syntheticMonthlyBank(month: string): readonly MonthlyTopic[] {
    const year = Math.max(2000, Number(month.slice(0, 4)) - 1), selected = Number(month.slice(5));
    return ['손 씻기', '수면 리듬', '친구 관계', '건강 상담', '식생활 점검', '계절 건강', '학교생활 적응', '안전한 활동'].map((title, index) => monthlyTopicSchema.parse({
        id: `synthetic-${index + 1}`, title, year, month: index < 6 ? selected : (selected === 1 ? 12 : selected - 1), schoolType: 'all',
        source: { kind: 'local-fixture', label: 'NS-01 합성 검수 예시', reference: `fixture:ns01-${index + 1}` }, reviewStatus: 'pending',
        lead: '합성 검수용 한 줄 소개', actions: ['검수용 항목 하나', '검수용 항목 둘', '검수용 항목 셋', '검수용 항목 넷'], closing: '게시 전 실제 원고와 출처를 확인하세요.', tags: [title],
    }));
}
