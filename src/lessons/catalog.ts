import { advancedDefinitions, foundationDefinitions } from './definitions/navigation.js';

export const difficulties = ['easy', 'normal', 'hard'] as const;
export type { Difficulty } from './types.js';

export const badges = ['w', 'b', 'e', '0', '$', '^', 'gg', 'G', 'Counts', 'f', 'F', 't', 'T', ';', ',', '/', '?', 'n', 'N', '%', 'Navigator'] as const;
export const legacyIds = ['directions', 'w', 'b', 'e', '0', 'dollar', 'caret', 'gg', 'G', 'counts', 'f', 'F', 't', 'T', 'semicolon', 'comma', 'search-forward', 'search-backward', 'n', 'N', 'percent'] as const;
export const stageIds = [
  ...legacyIds.slice(0, 4), 'review-words', ...legacyIds.slice(4, 10), 'review-lines',
  ...legacyIds.slice(10, 16), 'review-finds', ...legacyIds.slice(16, 20), 'review-search',
  legacyIds[20], 'navigator', 'edit-insert', 'edit-lines', 'edit-repair', 'edit-undo', 'edit-challenge',
] as const;
export const LESSON_COUNT = stageIds.length;
export const NAVIGATION_COUNT = stageIds.indexOf('edit-insert');
const oldKeys: readonly (readonly string[])[] = [
  ['h', 'j', 'k', 'l'], ['w'], ['b'], ['e'], ['0'], ['$'], ['^'], ['gg'], ['G'],
  ['3j', '12G'], ['f{char}'], ['F{char}'], ['t{char}'], ['T{char}'], [';'], [','],
  ['/text↵'], ['?text↵'], ['n'], ['N'], ['%'],
];
export const challengeKeys: readonly (readonly string[])[] = stageIds.map(id => {
  const old = legacyIds.indexOf(id as typeof legacyIds[number]);
  if (old >= 0) return oldKeys[old]!;
  if (id.startsWith('review-')) return ['review'];
  if (id === 'navigator') return ['all motions'];
  return ['edit', ':w'];
});
export const stageBadge = (index: number): string | null => {
  const old = legacyIds.indexOf(stageIds[index] as typeof legacyIds[number]);
  return old > 0 ? badges[old - 1]! : stageIds[index] === 'navigator' ? 'Navigator' : null;
};
export const earnedBadges = (completed: number): string[] => stageIds.slice(0, completed).map((_, i) => stageBadge(i)).filter((badge): badge is string => badge !== null);


export const challengeTitles = stageIds.map(id => {
  const foundation = foundationDefinitions.find(definition => definition.id === id);
  if (foundation) return 'hubTitle' in foundation ? foundation.hubTitle : foundation.title;
  const advanced = advancedDefinitions[id];
  if (advanced) return advanced.title;
  return id === 'navigator' ? 'Navigator challenge' : id.startsWith('review-') ? `Review: ${id.slice('review-'.length)}` : `Editing: ${id.slice('edit-'.length)}`;
});
export const navigationBadges = badges.filter(badge => badge !== 'Navigator');
