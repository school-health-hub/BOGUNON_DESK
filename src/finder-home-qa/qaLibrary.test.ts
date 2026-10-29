// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { saveAiCandidate } from '../education-video/aiLibrary';
import { qaLibraryRepository } from './qaLibrary';
import { syntheticCandidate, syntheticConditions } from './syntheticFixture';
import { FinderQaBlockedError } from './inertConnections';

beforeEach(() => localStorage.clear());
const saveSynthetic = () => saveAiCandidate(qaLibraryRepository, syntheticCandidate,
  { educationTitle: syntheticConditions.topic, target: syntheticConditions.target, schedule: '', instructions: '' });

describe('QA repository using the existing local browser adapter', () => {
  it('recovers a preserved backup and memo after corrupt primary JSON', async () => {
    // Given two saved versions with a memo and a valid backup.
    const first = await saveSynthetic();
    const entry = first.library.entries[0];
    if (entry === undefined) throw new Error('Synthetic setup failed');
    await qaLibraryRepository.save({ ...entry, teacher: { ...entry.teacher, notes: '합성 보존 메모' } });
    await saveSynthetic();
    // When only the primary JSON becomes corrupt.
    localStorage.setItem('bogunon.education-video.browser-qa.v2', '{broken');
    await expect(qaLibraryRepository.load()).rejects.toThrow();
    const recovered = await qaLibraryRepository.recover();
    // Then the valid prior version and teacher memo are restored.
    expect(recovered.recovered).toBe(true);
    expect(recovered.library.entries).toHaveLength(1);
    expect(recovered.library.entries[0]?.teacher.notes).toBe('합성 보존 메모');
    expect((await qaLibraryRepository.load()).library.entries[0]?.teacher.notes).toBe('합성 보존 메모');
  });

  it('rejects non-QA IDs and live provenance without changing stored bytes', async () => {
    // Given a valid synthetic library.
    const loaded = await saveSynthetic();
    const entry = loaded.library.entries[0];
    if (entry === undefined) throw new Error('Synthetic setup failed');
    const before = await qaLibraryRepository.export();
    // When valid-format data claims a real ID or live search provenance.
    await expect(qaLibraryRepository.save({ ...entry, videoId: 'abcdefghijk' })).rejects.toBeInstanceOf(FinderQaBlockedError);
    await expect(saveAiCandidate(qaLibraryRepository, { ...syntheticCandidate, provenance: 'web-search-verified' })).rejects.toBeInstanceOf(FinderQaBlockedError);
    const otherId = { version: 2, entries: [{ ...entry, videoId: 'abcdefghijk', ai: undefined, candidateRecord: undefined }] };
    await expect(qaLibraryRepository.import(JSON.stringify(otherId))).rejects.toBeInstanceOf(FinderQaBlockedError);
    if (entry.candidateRecord === undefined) throw new Error('Synthetic setup failed');
    const claimedVerification = { ...entry, ai: undefined, candidateRecord: { ...entry.candidateRecord, provenance: 'teacher-confirmed' as const } };
    await expect(qaLibraryRepository.import(JSON.stringify({ version: 2, entries: [claimedVerification] }))).rejects.toBeInstanceOf(FinderQaBlockedError);
    // Then the existing QA library remains byte equivalent.
    expect(await qaLibraryRepository.export()).toBe(before);
  });
});
