import { describe, it, expect } from 'vitest';
import { parseMonthlyBank, recommendMonthlyTopics, syntheticMonthlyBank } from './monthlyTopicBank';
import { applyTopicPlan } from './applyTopicPlan';
import { assetExportPending } from './rendering/assetResolution';
import { applyStudentArt } from './rendering/studentArt';
import { studentArtCatalog } from './rendering/studentArtCatalog';
import { parseStudioDocument, serializeStudioDocument } from './studioDocument';
import { createBlankNewsletter } from './newDocument';
import { compileRenderDocument } from './rendering/renderDocument';
const now = '2026-11-13T00:00:00.000Z';
describe('monthly source bank', () => {
    it('is empty without sources and rejects malformed or oversized imports', () => {
        expect(recommendMonthlyTopics([], '2026-11', 'coed-high')).toHaveLength(0);
        for (const text of ['{}', 'not json', JSON.stringify({ version: 1, topics: [{ title: 'unknown' }] }), ' '.repeat(2097153)])
            expect(() => parseMonthlyBank(text)).toThrow();
    });
    it('ranks past same month before adjacent, keeps provenance and removes similar themes', () => {
        const bank = syntheticMonthlyBank('2026-11');
        const ranked = recommendMonthlyTopics(bank, '2026-11', 'coed-high');
        expect(ranked.length).toBeGreaterThanOrEqual(6);
        expect(ranked[0]?.reason).toContain('같은 월');
        expect(ranked.some(value => value.reason.includes('인접 월'))).toBe(true);
        expect(ranked[0]?.topic.source.kind).toBe('local-fixture');
        const first = bank[0];
        if (!first)
            throw Error('fixture');
        expect(recommendMonthlyTopics([...bank, { ...first, id: 'duplicate', title: '올바른 손 씻기' }], '2026-11', 'coed-high').filter(value => value.topic.title.includes('손'))).toHaveLength(1);
    });
    it('supports the old array shape without claiming synthetic fixtures are published history', () => {
        const bank = parseMonthlyBank(JSON.stringify([{ id: 'old', title: '손 씻기', year: 2025, month: 11, schoolType: 'coed-high', source: { kind: 'local-fixture', label: '합성', reference: 'fixture:old' }, reviewStatus: 'pending' }]));
        expect(bank[0]?.actions).toEqual([]);
        expect(recommendMonthlyTopics(bank, '2026-11', 'coed-high')[0]?.reason).toContain('합성');
    });
    it('excludes future, rejected and other school-only candidates, wrapping adjacent months', () => {
        const first = syntheticMonthlyBank('2026-01')[0];
        if (!first)
            throw Error('fixture');
        expect(recommendMonthlyTopics([{ ...first, year: 2027 }, { ...first, id: 'reject', reviewStatus: 'rejected' }, { ...first, id: 'other', schoolType: 'girls-high' }], '2026-01', 'coed-high')).toEqual([]);
        expect(recommendMonthlyTopics([{ ...first, year: 2025, month: 12 }], '2026-01', 'coed-high')[0]?.reason).toContain('인접 月'.replace('月', '월'));
    });
});
describe('explicit topic plan application', () => {
    it('appends exactly one copy/design revision, preserves old bytes and all image slots, and connects 6+7+4', async () => {
        const original = await createBlankNewsletter({ month: '2026-11', schoolType: 'coed-high', projectId: 'ns01-test', now });
        const bytes = JSON.stringify(original);
        const selected = recommendMonthlyTopics(syntheticMonthlyBank('2026-11'), '2026-11', 'coed-high').slice(0, 6).map(value => value.topic);
        const next = applyTopicPlan(original, selected, '2026-11', now);
        expect(JSON.stringify(original)).toBe(bytes);
        expect(next.project.revisionHistory.slice(0, -1)).toEqual(original.project.revisionHistory);
        expect(next.design.revisionHistory.slice(0, -1)).toEqual(original.design.revisionHistory);
        expect(next.project.projectRevision).toBe(original.project.projectRevision + 1);
        expect(next.design.designRevision).toBe(original.design.designRevision + 1);
        expect(parseStudioDocument(JSON.parse(serializeStudioDocument(next)))).toEqual(next);
        expect(next.design.assetManifest).toEqual(original.design.assetManifest);
        expect(next.design.cardLayouts.map(value => value.image)).toEqual(original.design.cardLayouts.map(value => value.image));
        const render = compileRenderDocument({ project: next.project, projectRevision: next.project.projectRevision, design: next.design, designRevision: next.design.designRevision });
        expect(render.a4.modules.map(value => value.title.text)).toEqual(selected.map(value => value.title));
        expect(render.cards).toHaveLength(7);
        expect(render.cards[0]?.topicOverview).toHaveLength(4);
        expect(next.project.canonicalCopy.sections.every(value => value.topicSelection?.source.kind === 'local-fixture')).toBe(true);
        const old = compileRenderDocument({ project: next.project, projectRevision: original.project.projectRevision, design: next.design, designRevision: original.design.designRevision });
        expect(old.a4.modules.map(value => value.title.text)).toEqual(original.project.topics.map(value => value.title));
    });
    it('retains pending student images and all unchanged slots when selecting new themes', async () => {
        const original = await createBlankNewsletter({ month: '2026-11', schoolType: 'coed-high', projectId: 'ns01-art', now });
        const art = studentArtCatalog[0];
        if (!art || original.design.designSchemaVersion !== 2)
            throw Error('fixture');
        const withArt = { ...original, design: applyStudentArt(original.design, { kind: 'a4', index: 2 }, art.id, now) };
        const next = applyTopicPlan(withArt, syntheticMonthlyBank('2026-11').slice(0, 6), '2026-11', now);
        expect(next.design.a4Layout.modules.map(value => value.image)).toEqual(withArt.design.a4Layout.modules.map(value => value.image));
        expect(next.design.assetManifest).toEqual(withArt.design.assetManifest);
        const entry = next.design.assetManifest.find(value => value.id === art.id);
        if (!entry)
            throw Error('missing art');
        expect(assetExportPending(entry)).toBe(true);
    });
    it('keeps provenance, missing-copy status and title snapshots across a second plan', async () => {
        const original = await createBlankNewsletter({ month: '2026-11', schoolType: 'coed-high', projectId: 'ns01-second', now });
        const topics = syntheticMonthlyBank('2026-11').slice(0, 6), first = applyTopicPlan(original, topics, '2026-11', now);
        const next = applyTopicPlan(first, [...topics].reverse(), '2026-11', now);
        const old = compileRenderDocument({ project: next.project, projectRevision: 2, design: next.design, designRevision: first.design.designRevision });
        expect(old.a4.modules.map(value => value.title.text)).toEqual(topics.map(value => value.title));
        expect(next.project.revisionHistory.slice(0, -1)).toEqual(first.project.revisionHistory);
    });
    it('does not invent missing copy, rejects invalid counts and duplicates', async () => {
        const original = await createBlankNewsletter({ month: '2026-11', schoolType: 'coed-high', projectId: 'ns01-missing', now });
        const chosen = syntheticMonthlyBank('2026-11').slice(0, 6);
        expect(() => applyTopicPlan(original, chosen.slice(0, 5), '2026-11', now)).toThrow();
        expect(() => applyTopicPlan(original, [...chosen.slice(0, 5), chosen[0]], '2026-11', now)).toThrow();
        const blank = chosen.map(value => ({ ...value, lead: '', actions: [], closing: '' }));
        const next = applyTopicPlan(original, blank, '2026-11', now);
        expect(next.project.canonicalCopy.sections.every(value => value.userEdit?.text === '')).toBe(true);
        expect(compileRenderDocument({ project: next.project, projectRevision: 2, design: next.design, designRevision: next.design.designRevision }).issues.length).toBeGreaterThan(0);
    });
});
it('keeps supplied archive provenance and never promotes a pending bank review', () => { const first = syntheticMonthlyBank('2026-11')[0]; if (!first)
    throw Error('fixture'); const source = { kind: 'local-archive', label: '합성 과거자료 출처 테스트', reference: 'fixture:archive', sha256: 'a'.repeat(64) }; const imported = parseMonthlyBank(JSON.stringify({ version: 1, topics: [{ ...first, source }] })); expect(imported[0]?.source).toEqual(source); const pending = recommendMonthlyTopics([{ ...first, source: { kind: 'approved-bank', label: 'imported claim', reference: 'fixture:pending' } }], '2026-11', 'coed-high'); expect(pending[0]?.reason).toContain('검토 필요'); });

it('the earliest accepted month does not throw in explicit synthetic example generation',()=>{expect(()=>syntheticMonthlyBank('2000-01')).not.toThrow();expect(recommendMonthlyTopics(syntheticMonthlyBank('2000-01'),'2000-01','coed-high')).toEqual([])})
