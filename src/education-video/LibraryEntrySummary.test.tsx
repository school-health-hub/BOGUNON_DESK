// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { LibraryEntrySummary } from './LibraryEntrySummary';
import { saveAiCandidate } from './aiLibrary';
import { libraryRepository } from './library';
import { syntheticCandidate } from '../finder-home-qa/syntheticFixture';

afterEach(cleanup);
it('shows a readable title and inert canonical URL without opening external pages', async () => {
  // Given a synthetic library entry with a teacher memo.
  localStorage.clear();
  const saved = await saveAiCandidate(libraryRepository, syntheticCandidate,
    { educationTitle: '합성 교육', target: '고등학생', schedule: '', instructions: '' });
  const entry = saved.library.entries[0];
  if (!entry) throw new Error('Missing synthetic test entry');
  // When either library renders the shared summary.
  render(<LibraryEntrySummary entry={entry} />);
  // Then a title and wrapping-ready URL are present, without an external link action.
  expect(screen.getByText(syntheticCandidate.title)).toBeTruthy();
  expect(screen.getByText(syntheticCandidate.url).className).toBe('ev-entry-url');
  expect(screen.queryByRole('link')).toBeNull();
});
