import { invoke, isTauri } from '@tauri-apps/api/core';
import { FinderInputError, safeVideoUrl, type Library, type LibraryItem } from './model';
const browserKey = 'bogunon.education-video.browser-qa.v1';
const emptyLibrary: Library = { version: 1, items: [] };
const fields = ['videoId', 'title', 'channelId', 'channelTitle', 'url', 'educationTitle', 'target', 'schedule', 'instructions', 'message', 'notes'] as const;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const parseItem = (input: unknown): LibraryItem => {
    if (!isObject(input) || fields.some(key => typeof input[key] !== 'string' || String(input[key]).length > 20000) || input.source !== 'mock' || typeof input.durationSeconds !== 'number' || !Number.isInteger(input.durationSeconds) || input.durationSeconds < 1 || input.durationSeconds > 86400)
        throw new FinderInputError('라이브러리 항목 형식이 올바르지 않습니다.');
    const stringField = (name: typeof fields[number]): string => { const value = input[name]; if (typeof value !== 'string')
        throw new FinderInputError('잘못된 문자열입니다.'); return value; };
    const url = safeVideoUrl(stringField('url'));
    if (!url || new URL(url).searchParams.get('v') !== input.videoId)
        throw new FinderInputError('라이브러리 영상 URL이 올바르지 않습니다.');
    if (Object.keys(input).some(key => ![...fields, 'source', 'durationSeconds'].some(allowed => allowed === key)))
        throw new FinderInputError('허용되지 않은 필드가 있습니다. 인증 정보는 저장할 수 없습니다.');
    return { videoId: stringField('videoId'), title: stringField('title'), channelId: stringField('channelId'), channelTitle: stringField('channelTitle'), url, durationSeconds: input.durationSeconds, source: 'mock', educationTitle: stringField('educationTitle'), target: stringField('target'), schedule: stringField('schedule'), instructions: stringField('instructions'), message: stringField('message'), notes: stringField('notes') };
};
export const parseLibrary = (json: string): Library => {
    if (new TextEncoder().encode(json).length > 2 * 1024 * 1024)
        throw new FinderInputError('가져오기 파일은 2MB 이하여야 합니다.');
    let value: unknown;
    try {
        value = JSON.parse(json);
    }
    catch (error) {
        if (error instanceof SyntaxError)
            throw new FinderInputError('손상된 JSON입니다. 기존 데이터는 유지됩니다.');
        throw error;
    }
    if (!isObject(value) || value.version !== 1 || !Array.isArray(value.items) || value.items.length > 1000 || Object.keys(value).some(key => key !== 'version' && key !== 'items'))
        throw new FinderInputError('지원하지 않는 라이브러리 형식입니다.');
    const items = value.items.map(parseItem);
    const ids = new Set<string>();
    for (const item of items) {
        if (ids.has(item.videoId)) throw new FinderInputError('같은 영상 ID가 파일 안에 중복되어 있습니다. 기존 데이터는 유지됩니다.');
        ids.add(item.videoId);
    }
    return { version: 1, items };
};
export const mergeLibrary = (current: Library, incoming: Library): Library => ({ version: 1, items: [...current.items, ...incoming.items.filter(item => !current.items.some(existing => existing.videoId === item.videoId))] });
type Loaded = {
    readonly library: Library;
    readonly recovered: boolean;
};
export const nativeLibrary = isTauri();
const readBrowser = (): Library => { const json = localStorage.getItem(browserKey); return json ? parseLibrary(json) : emptyLibrary; };
const persistBrowser = (library: Library): Loaded => { const previous = localStorage.getItem(browserKey); if (previous)
    localStorage.setItem(`${browserKey}.backup`, previous); localStorage.setItem(browserKey, JSON.stringify(library)); return { library, recovered: false }; };
export const libraryRepository = {
    load: async (): Promise<Loaded> => nativeLibrary ? invoke('education_video_library_load') : { library: readBrowser(), recovered: false },
    save: async (item: LibraryItem): Promise<Loaded> => {
        if (nativeLibrary)
            return invoke('education_video_library_save', { item });
        const current = readBrowser();
        return persistBrowser({ version: 1, items: [...current.items.filter(existing => existing.videoId !== item.videoId), item] });
    },
    import: async (json: string): Promise<Loaded> => { const incoming = parseLibrary(json); return nativeLibrary ? invoke('education_video_library_import', { json: JSON.stringify(incoming) }) : persistBrowser(mergeLibrary(readBrowser(), incoming)); },
    export: async (): Promise<string> => nativeLibrary ? invoke('education_video_library_export') : JSON.stringify(readBrowser(), null, 2),
    recover: async (): Promise<Loaded> => {
        if (nativeLibrary)
            return invoke('education_video_library_recover');
        const backup = localStorage.getItem(`${browserKey}.backup`);
        if (!backup)
            throw new FinderInputError('복구할 백업이 없습니다.');
        const library = parseLibrary(backup);
        localStorage.setItem(browserKey, JSON.stringify(library));
        return { library, recovered: true };
    },
};
