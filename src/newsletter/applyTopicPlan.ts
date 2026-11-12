import { semanticHashSync } from './hash';
import { parseNewsletterProject } from './schema';
import { monthlyTopicSchema, topicKey, type MonthlyTopic } from './monthlyTopicBank';
import { parseNewsletterDesignStateV2 } from './rendering/designSchema';
import type { StudioDocument } from './studioDocument';
/** Pure draft transformation: callers must obtain explicit confirmation and commit once. */
export function applyTopicPlan(document: StudioDocument, input: readonly unknown[], month: string, now: string): StudioDocument {
    if (document.design.designSchemaVersion !== 2)
        throw Error('먼저 기존 V2 디자인 전환을 확인해 주세요.');
    if (input.length !== 6)
        throw Error('서로 다른 주제 6개를 확정해 주세요.');
    const topics: readonly MonthlyTopic[] = input.map(value => monthlyTopicSchema.parse(value));
    if (new Set(topics.map(value => topicKey(value.title))).size !== 6)
        throw Error('같거나 유사한 주제가 중복되었습니다.');
    const project = document.project, design = document.design;
    const sections = project.canonicalCopy.sections.map((section, index) => {
        const topic = topics[index];
        if (topic === undefined)
            throw Error('주제가 누락되었습니다.');
        const text = [topic.lead, ...topic.actions.filter(Boolean).map((value, action) => `${action + 1}. ${value}`)].filter(Boolean).join('\n');
        const userEdit = { text, editedAt: now };
        return { ...section, userEdit, revision: section.revision + 1, semanticHash: semanticHashSync({ aiGenerated: section.aiGenerated, userEdit }), topicSelection: { selectedMonth: month, source: topic.source, sourceYear: topic.year, sourceMonth: topic.month, closing: topic.closing, reviewStatus: 'pending' } };
    });
    const canonicalCopy = { sections }, revision = project.projectRevision + 1;
    const nextProject = parseNewsletterProject({ ...project,
        topicTitleHistory: [...(project.topicTitleHistory ?? []), { throughRevision: project.projectRevision, titles: project.topics.map(value => value.title) }],
        topics: project.topics.map((topic, index) => ({ ...topic, title: topics[index]?.title ?? topic.title })), canonicalCopy, projectRevision: revision,
        revisionHistory: [...project.revisionHistory, { revision, createdAt: now, changedSectionIds: sections.map(value => value.id), snapshot: canonicalCopy }],
    });
    const cardLayouts = design.cardLayouts.map((card, index) => {
        if (index === 0)
            return { ...card, ...(card.brand ? { brand: { ...card.brand, previewTopicCount: 4 } } : {}) };
        const topic = topics[index - 1];
        if (topic === undefined)
            return card;
        return { ...card, ...(card.editorial ? { editorial: { ...card.editorial, slogan: topic.lead, closing: topic.closing } } : {}), ...(card.officialTemplate ? { officialTemplate: { ...card.officialTemplate, closingText: topic.closing } } : {}) };
    });
    const snapshot = { ...design, canonicalProjectRevision: revision, cardLayouts };
    const nextDesign = parseNewsletterDesignStateV2({ ...snapshot, designRevision: design.designRevision + 1, revisionHistory: [...design.revisionHistory, { revision: design.designRevision + 1, createdAt: now, changedPageIds: ['a4-page', ...cardLayouts.map(value => value.pageId)], snapshotVersion: 2, snapshot }] });
    return { project: nextProject, design: nextDesign };
}
