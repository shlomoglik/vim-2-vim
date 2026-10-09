import type { NavigationDefinition } from '../types.js';
import { definition as countedMotions } from './counted-motions.js';
import { definition as directions } from './directions.js';
import { definition as fileEnd } from './file-end.js';
import { definition as fileStart } from './file-start.js';
import { definition as findBackward } from './find-backward.js';
import { definition as findForward } from './find-forward.js';
import { definition as firstNonblank } from './first-nonblank.js';
import { definition as lineEnd } from './line-end.js';
import { definition as lineStart } from './line-start.js';
import { definition as matchingPairs } from './matching-pairs.js';
import { definition as repeatFind } from './repeat-find.js';
import { definition as repeatSearch } from './repeat-search.js';
import { definition as reverseFind } from './reverse-find.js';
import { definition as reverseSearch } from './reverse-search.js';
import { definition as searchBackward } from './search-backward.js';
import { definition as searchForward } from './search-forward.js';
import { definition as untilBackward } from './until-backward.js';
import { definition as untilForward } from './until-forward.js';
import { definition as wordBackward } from './word-backward.js';
import { definition as wordEnd } from './word-end.js';
import { definition as wordForward } from './word-forward.js';

export const foundationDefinitions = [directions, wordForward, wordBackward, wordEnd, lineStart] as const;
export const advancedDefinitions: Record<string, NavigationDefinition> = {
  'dollar': lineEnd,
  'caret': firstNonblank,
  'gg': fileStart,
  'G': fileEnd,
  'counts': countedMotions,
  'f': findForward,
  'F': findBackward,
  't': untilForward,
  'T': untilBackward,
  'semicolon': repeatFind,
  'comma': reverseFind,
  'search-forward': searchForward,
  'search-backward': searchBackward,
  'n': repeatSearch,
  'N': reverseSearch,
  'percent': matchingPairs,
};
