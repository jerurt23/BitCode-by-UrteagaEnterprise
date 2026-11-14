import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeProgressFromBloc,
  countBlocAssignedItems,
  getTrashDaysLeft,
  moveModuleToTrash,
  purgeExpiredTrash,
  restoreModuleFromTrash,
} from './projectHelpers';
import { Project } from '../types/workspace';

function makeProject(): Project {
  return {
    id: 'proj-test',
    name: 'Proyecto de prueba',
    description: 'Proyecto para probar la papelera.',
    color: '#2563EB',
    location: '/repos/test',
    priority: 'media',
    tags: [],
    modules: [
      {
        id: 'mod-1',
        name: 'Módulo uno',
        description: 'Módulo de prueba.',
        deadline: '2026-12-01',
        progress: 40,
        status: 'en_progreso',
        currentNote: '- Pendiente',
        meetingNote: '',
        ideaNote: '',
        updatedAt: '2026-11-14T09:00:00.000Z',
      },
    ],
    progressHistory: [],
    branches: [],
    activeBranchId: 'br-main',
    commits: [],
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-14T09:00:00.000Z',
  };
}

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

test('moveModuleToTrash mueve el módulo a la papelera y restoreModuleFromTrash lo recupera', () => {
  const nowIso = '2026-11-14T10:00:00.000Z';
  const trashed = moveModuleToTrash(makeProject(), 'mod-1', 'completado', nowIso);

  assert.equal(trashed.modules.length, 0);
  assert.equal(trashed.trash?.length, 1);
  assert.equal(trashed.trash?.[0].reason, 'completado');
  assert.equal(trashed.trash?.[0].module.id, 'mod-1');
  assert.equal(trashed.trash?.[0].trashedAt, nowIso);

  const restored = restoreModuleFromTrash(trashed, trashed.trash![0].id);
  assert.equal(restored.modules.length, 1);
  assert.equal(restored.modules[0].id, 'mod-1');
  assert.equal(restored.trash?.length, 0);
});

test('la papelera conserva el módulo 30 días y luego se purga', () => {
  const nowMs = Date.parse('2026-11-14T10:00:00.000Z');
  const nowIso = new Date(nowMs).toISOString();
  const trashed = moveModuleToTrash(makeProject(), 'mod-1', 'eliminado', nowIso);

  assert.equal(getTrashDaysLeft(nowIso, nowMs), 30);
  assert.equal(getTrashDaysLeft(nowIso, nowMs + 29 * 24 * 60 * 60 * 1000), 1);
  assert.equal(purgeExpiredTrash(trashed, nowMs + 29 * 24 * 60 * 60 * 1000).trash?.length, 1);
  assert.equal(purgeExpiredTrash(trashed, nowMs + 31 * 24 * 60 * 60 * 1000).trash?.length, 0);
});
