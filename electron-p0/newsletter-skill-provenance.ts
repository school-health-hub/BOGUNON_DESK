/**
 * Read-only receipts for the canonical Newsletter Skill packet.
 *
 * These values identify archive entries only. The source archive and its
 * reference assets are intentionally not copied into the product repository.
 */
export const NEWSLETTER_SKILL_PROVENANCE = Object.freeze({
  authority: 'monthly-school-health-newsletter',
  skill: Object.freeze({
    logicalPath: 'references/SKILL.md',
    size: 9_302,
    sha256: '5ec501099efc186dc48f21f8138fa1f28c905b2e3a8585c4308de7dd5e235dbb',
  }),
  entries: Object.freeze({
    styleGuide: Object.freeze({logicalPath:'references/style-guide.md',size:2_510,sha256:'73c4f3028a5be8d11b64b124984c3291232834ba1c03894ea2d1ef6446e35e8d'}),
    outputTemplates: Object.freeze({logicalPath:'references/output-templates.md',size:1_134,sha256:'b564c26d729648181fb2b046363a1aaac97163d94f3066338e7af405958d1f4c'}),
    sourceLibrary: Object.freeze({logicalPath:'references/source-library.md',size:1_133,sha256:'55447640055d968b9abf447b12bbc6025bca46fe8bc68aa7dd793e2903794687'}),
    a4StyleMaster: Object.freeze({logicalPath:'references/a4-style-master.png',size:2_211_951,sha256:'70392a60c0b2fb75e1aca3e19c4ebebb36b56ade7ca041db9c1166b47d178efb'}),
    cardCoverStyle: Object.freeze({logicalPath:'references/style-cover.jpg',size:151_521,sha256:'af9c7eca6d94fd4c2fdf71dde24bf163caae515d21dc4406e56a5a9727e655df'}),
    cardInnerStyle: Object.freeze({logicalPath:'references/style-inner.jpg',size:149_795,sha256:'ac6eb186e781ad674dc5bd6df561591add6b4f4ff721fc60b264805f7b248640'}),
  }),
  approvedStyleFamily: '2026-09-school-health-newsletter',
} as const)
