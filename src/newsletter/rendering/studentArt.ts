import { studentArtCatalog, type StudentArt } from './studentArtCatalog';
import { parseNewsletterDesignStateV2, type NewsletterDesignStateV2 } from './designSchema';
export type ArtTarget = {
    readonly kind: 'card' | 'a4';
    readonly index: number;
} | {
    readonly kind: 'official';
    readonly index: number;
    readonly elementId: string;
} | {
    readonly kind: 'module';
    readonly index: number;
    readonly moduleIndex: number;
};
export type ArtSlot = {
    readonly key: string;
    readonly label: string;
    readonly target: ArtTarget;
    readonly assetId?: string;
};
export class StudentArtError extends Error {
    readonly name = 'StudentArtError';
}
export function filterStudentArt(type: 'female' | 'male' | 'mixed' | 'all'): readonly StudentArt[] { return studentArtCatalog.filter(a => type === 'all' || a.studentType === type); }
const rules: Readonly<Record<StudentArt['scene'], RegExp>> = { handwashing: /손\s*씻|감염|위생|장염|비누/u, winter: /겨울|추위|통학|목도리|생활 습관/u, consultation: /상담|도움|약|보건실/u, drinking: /음료|물|카페인/u, refusal: /흡연|담배|거절/u, warmth: /핫팩|보온|겨울/u, cooking: /식생활|음식|조리|식사/u, boiling: /끓|음료|물/u, friends: /친구|관계|학교생활|함께/u };
export function recommendStudentArt(text: string): readonly StudentArt[] { return studentArtCatalog.filter(a => rules[a.scene].test(text)); }
export function artSlots(d: NewsletterDesignStateV2, mode: 'a4' | 'cards', index: number): readonly ArtSlot[] {
    if (mode === 'a4') {
        const m = d.a4Layout.modules[index];
        return m ? [{ key: 'a4-' + index, label: 'A4 주제 ' + (index + 1) + ' 삽화', target: { kind: 'a4', index }, assetId: m.image.assetId }] : [];
    }
    const c = d.cardLayouts[index];
    if (!c)
        return [];
    if (c.officialTemplate)
        return c.officialTemplate.elements.flatMap(e => e.kind === 'image' && e.binding !== 'mascot' && e.binding !== 'decoration' ? [{ key: e.id, label: e.label, target: { kind: 'official' as const, index, elementId: e.id }, assetId: e.assetId ?? (e.binding === 'main' ? c.image.assetId : undefined) }] : []);
    return [{ key: 'main', label: index === 0 ? '표지 대표 장면' : '주제 메인 삽화', target: { kind: 'card', index }, assetId: c.image.assetId }, ...(c.editorial?.moduleImages?.map((im, i) => ({ key: 'module-' + i, label: '실천 항목 ' + (i + 1) + ' 삽화', target: { kind: 'module' as const, index, moduleIndex: i }, assetId: im.assetId })) ?? [])];
}
export function applyStudentArt(d: NewsletterDesignStateV2, target: ArtTarget, id: string | null, now: string): NewsletterDesignStateV2 {
    const art = id === null ? undefined : studentArtCatalog.find(a => a.id === id);
    if (id !== null && !art)
        throw new StudentArtError('라이브러리에 없는 그림입니다.');
    if (art && d.assetManifest.some(a => a.id === art.id && a.sha256 !== art.sha256))
        throw new StudentArtError('같은 자산 ID에 다른 파일이 등록돼 있습니다.');
    const existing = art ? d.assetManifest.find(a => a.sha256 === art.sha256) : undefined;
    const binding = existing?.id ?? art?.id;
    const patch = art ? { assetId: binding, visible: true, fit: 'contain' as const, edgePolicy: 'none' as const } : { visible: false };
    const manifest = art && !existing ? [...d.assetManifest, { id: art.id, sha256: art.sha256, mediaType: 'image/png' as const, approvalStatus: 'approved' as const, exportApproval: 'pending' as const, originalName: art.fileName, localReference: 'asset:' + art.sha256, registry: { classification: 'AI_GENERATED' as const, purpose: 'illustration' as const, usageScope: 'newsletter-output' as const } }] : d.assetManifest;
    let found = false;
    const cards = d.cardLayouts.map((c, i) => {
        if (i !== target.index || target.kind === 'a4')
            return c;
        switch (target.kind) {
            case 'card':
                found = true;
                return { ...c, image: { ...c.image, ...patch }, ...(c.editorial ? { editorial: { ...c.editorial, foregroundMask: undefined } } : {}) };
            case 'module': {
                const editorial = c.editorial;
                const modules = editorial?.moduleImages;
                if (!editorial || !modules || !modules[target.moduleIndex])
                    return c;
                found = true;
                return { ...c, editorial: { ...editorial, moduleImages: modules.map((im, j) => j === target.moduleIndex ? { ...im, ...patch } : im) } };
            }
            case 'official': return { ...c, officialTemplate: c.officialTemplate ? { ...c.officialTemplate, elements: c.officialTemplate.elements.map(e => { if (e.id !== target.elementId || e.kind !== 'image' || e.binding === 'mascot' || e.binding === 'decoration')
                        return e; found = true; return { ...e, ...patch, mask: undefined, maskedOnly: undefined, maskEnabled: undefined }; }) } : undefined };
        }
    });
    const a4 = target.kind === 'a4' ? { ...d.a4Layout, modules: d.a4Layout.modules.map((m, i) => { if (i !== target.index)
            return m; found = true; return { ...m, image: { ...m.image, ...patch } }; }) } : d.a4Layout;
    if (!found)
        throw new StudentArtError('적용 대상 슬롯을 다시 확인해 주세요.');
    const snapshot = { designSchemaVersion: 2 as const, canonicalProjectRevision: d.canonicalProjectRevision, templateId: d.templateId, templateVersion: d.templateVersion, publicationMeta: d.publicationMeta, assetManifest: manifest, a4Layout: a4, cardLayouts: cards };
    const revision = d.designRevision + 1;
    return parseNewsletterDesignStateV2({ ...d, ...snapshot, designRevision: revision, revisionHistory: [...d.revisionHistory, { revision, createdAt: now, changedPageIds: [target.kind === 'a4' ? 'a4-page' : d.cardLayouts[target.index]?.pageId ?? ''], snapshotVersion: 2, snapshot }] });
}
