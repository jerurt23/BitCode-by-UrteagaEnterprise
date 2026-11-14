import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeProgressFromBloc,
  countBlocAssignedItems,
} from './projectHelpers';

test('countBlocAssignedItems ignores headings, blank lines, empty bullets, and checked [x] items', () => {
  const note = [
    '# Título del módulo',
    '',
    '• Tarea pendiente 1',
    '  ◦ [ ] Tarea pendiente 2',
    '    ▪ [x] Tarea ya resuelta',
    '    ▸ ',
    '## Subtítulo',
    '1. Tarea pendiente 3',
  ].join('\n');

  assert.equal(countBlocAssignedItems(note), 3);
});

test('computeProgressFromBloc returns 100% when bloc is empty and decreases as assigned items grow', () => {
  assert.equal(computeProgressFromBloc(''), 100);
  assert.equal(computeProgressFromBloc('# Solo título\n- [x] Completado'), 100);

  const oneItem = '- Pendiente único';
  const fourItems = '- Uno\n- Dos\n- Tres\n- Cuatro';
  const nineItems = Array.from({ length: 9 }, (_, i) => `- Item ${i + 1}`).join('\n');

  assert.equal(computeProgressFromBloc(oneItem), 88);
  assert.equal(computeProgressFromBloc(fourItems), 52);
  assert.equal(computeProgressFromBloc(nineItems), 5);
});
