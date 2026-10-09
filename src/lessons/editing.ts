import { stageIds } from './catalog.js';
import { definition as challenge } from './definitions/edit-challenge.js';
import { definition as insert } from './definitions/edit-insert.js';
import { definition as lines } from './definitions/edit-lines.js';
import { definition as repair } from './definitions/edit-repair.js';
import { definition as undo } from './definitions/edit-undo.js';
import type { EditingDefinition, Lesson } from './types.js';

const EDITING_REFERENCE_KEYS = 20;
const EDITING_START = { row: 0, col: 2 };
const editingDefinitions: Record<string, EditingDefinition> = {
  'edit-insert': insert,
  'edit-lines': lines,
  'edit-repair': repair,
  'edit-undo': undo,
  'edit-challenge': challenge,
};
export function editingLesson(index: number): Lesson {
  const id = stageIds[index]!;
  const spec = editingDefinitions[id]!;
  return { id, title: `${index + 1} · ${id.replace('edit-', 'Editing: ')}`, instruction: spec.instruction,
    hint: `${spec.hint} Target file: ${spec.expected.join(' | ')}`,
    lines: [...spec.lines], start: { ...(spec.start ?? EDITING_START) }, checkpoints: [{ ...(spec.start ?? EDITING_START) }], idealKeys: [spec.referenceKeys ?? EDITING_REFERENCE_KEYS], badge: null,
    referenceRoutes: [], editing: { filename: `${id}.txt`, expected: [...spec.expected], requireSave: true } };
}
