export type Conditions = {
    readonly topic: string;
    readonly target: string;
    readonly minutes: number;
};
export type Video = {
    readonly videoId: string;
    readonly title: string;
    readonly channelId: string;
    readonly channelTitle: string;
    readonly durationSeconds: number | null;
    readonly url: string;
    readonly source: 'mock' | 'live' | 'synthetic-mock';
    readonly official?: boolean;
    readonly officialEvidence?: string | null;
    readonly synthetic?: boolean;
    readonly fetchedAt?: string;
    readonly expiresAt?: string;
};
export type Education = {
    readonly educationTitle: string;
    readonly target: string;
    readonly schedule: string;
    readonly instructions: string;
};
export type LibraryItem = Video & Education & {
    readonly message: string;
    readonly notes: string;
};
export type Library = {
    readonly version: 1;
    readonly items: readonly LibraryItem[];
};
export class FinderInputError extends Error {
    readonly name = 'FinderInputError';
}
export const validateConditions = (input: Conditions): string | null => {
    if (!input.topic.trim() || input.topic.length > 100)
        return '교육 주제를 1~100자로 입력해 주세요.';
    if (!input.target.trim() || input.target.length > 100)
        return '교육 대상을 1~100자로 입력해 주세요.';
    if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > 180)
        return '희망 길이는 1~180분으로 입력해 주세요.';
    return null;
};
export const durationSeconds = (value: string): number | null => {
    const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
    if (!match || !match.slice(1).some(Boolean))
        return null;
    const seconds = Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
    return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
};
export const safeVideoUrl = (value: string): string | null => {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.hostname !== 'www.youtube.com' || url.port || url.username || url.password || url.pathname !== '/watch' || url.hash)
            return null;
        const id = url.searchParams.get('v');
        if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id) || url.searchParams.toString() !== `v=${id}`)
            return null;
        return `https://www.youtube.com/watch?v=${id}`;
    }
    catch (error) {
        if (error instanceof TypeError)
            return null;
        throw error;
    }
};
const registry = new Map([['mock-verified-health', '합성 레지스트리 테스트 근거 · 실제 기관 또는 공식 채널 검증 아님']]);
export const officialEvidence = (channelId: string): string | null => registry.get(channelId) ?? null;
const offsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 8] as const;
export const searchMockVideos = (input: Conditions): readonly (Video & { readonly durationSeconds: number; readonly source: 'mock' })[] => {
    const error = validateConditions(input);
    if (error)
        throw new FinderInputError(error);
    let fingerprint = 2166136261;
    for (const character of JSON.stringify(input))
        fingerprint = Math.imul(fingerprint ^ character.charCodeAt(0), 16777619) >>> 0;
    return offsets.map((offset, index) => {
        const videoId = `EV${fingerprint.toString(36).padStart(7, '0')}${String(index + 1).padStart(2, '0')}`;
        return { videoId, title: `[합성 Mock ${index + 1}] ${input.topic.trim()} · ${input.target.trim()} 교육 예시`, channelId: index % 3 === 0 ? 'mock-verified-health' : `mock-channel-${index}`, channelTitle: index % 3 === 0 ? '합성 검증 채널 예시' : `합성 교육 채널 ${index + 1}`, durationSeconds: Math.max(30, (input.minutes + offset) * 60), url: `https://www.youtube.com/watch?v=${videoId}`, source: 'mock' };
    });
};
export const filterVideos = <T extends Video>(videos: readonly T[], minutes: number, windowMinutes: number | null): readonly T[] => videos.filter(v => windowMinutes === null || (v.durationSeconds !== null && Math.abs(v.durationSeconds - minutes * 60) <= windowMinutes * 60)).sort((a, b) => (a.durationSeconds === null ? Infinity : Math.abs(a.durationSeconds - minutes * 60)) - (b.durationSeconds === null ? Infinity : Math.abs(b.durationSeconds - minutes * 60)) || a.videoId.localeCompare(b.videoId));
export const formatDuration = (seconds: number | null): string => seconds === null ? '길이 미확인' : `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
export const createMessage = (education: Education, video: Video | null): {
    readonly text: string;
    readonly missing: readonly string[];
} => {
    const missing = [!education.educationTitle.trim() && '교육명', !education.target.trim() && '대상', !education.schedule.trim() && '교육 일시 또는 시청 기간', !video && '영상 선택', !education.instructions.trim() && '안내사항'].filter((value): value is string => typeof value === 'string');
    if (video && safeVideoUrl(video.url) === null)
        missing.push('올바른 영상 URL');
    if (missing.length || !video)
        return { text: '', missing };
    return { text: [...(video.source === 'live' ? [] : ['[합성 Mock QA · 실제 영상 링크가 아닙니다]', '']), '[' + education.educationTitle.trim() + ' 안내]', '', '대상: ' + education.target.trim(), '교육 일시 또는 시청 기간: ' + education.schedule.trim(), '', '시청 영상: ' + video.title, '영상 URL: ' + video.url, '', '안내사항', education.instructions.trim()].join(String.fromCharCode(10)), missing: [] };
};
export const copyMessage = async (text: string, confirmed: boolean, write: (value: string) => Promise<void>): Promise<string> => {
    if (!confirmed || !text.trim())
        return '안내문을 확인한 뒤 확인란을 선택해 주세요.';
    try {
        await write(text);
        return '안내문을 복사했습니다.';
    }
    catch {
        return '복사하지 못했습니다. 안내문을 직접 선택해 복사해 주세요.';
    }
};
