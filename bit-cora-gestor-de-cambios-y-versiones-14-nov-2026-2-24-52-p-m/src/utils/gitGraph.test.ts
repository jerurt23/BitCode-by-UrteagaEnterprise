import test from 'node:test';
import assert from 'node:assert/strict';
import {
  commitProjectChange,
  computeBranchGraphLayout,
  createBranchInProject,
  deleteBranchInProject,
  mergeBranchInProject,
  updateBranchInProject,
} from './gitGraph';
import { Project } from '../types/workspace';

function makeBaseProject(): Project {
  return {
    id: 'proj-test',
    name: 'Proyecto Test',
    description: 'Prueba',
    color: '#2563EB',
    location: '/repos/test',
    priority: 'alta',
    tags: ['core'],
    modules: [],
    progressHistory: [],
    branches: [
      {
        id: 'br-main',
        name: 'main',
        color: '#2563EB',
        parentBranchId: null,
        headCommitId: null,
        createdAt: '2026-11-01T10:00:00.000Z',
        isMerged: false,
      },
    ],
    activeBranchId: 'br-main',
    commits: [],
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  };
}

test('createBranchInProject, commitProjectChange, mergeBranchInProject, and layout produce valid graph', () => {
  let project = makeBaseProject();

  const c1 = commitProjectChange(project, {
    moduleId: 'm1',
    moduleName: 'Autenticación',
    message: 'Base inicial de notas',
    mode: 'manual',
    beforeText: '',
    afterText: 'Paso 1\nPaso 2',
    timestamp: '2026-11-01T10:05:00.000Z',
  });
  project = c1.project;
  assert.equal(project.commits.length, 1);

  const b2 = createBranchInProject(project, 'reunion/sprint-4', 'br-main');
  project = b2.project;
  assert.equal(project.branches.length, 2);
  assert.equal(project.activeBranchId, b2.newBranch.id);
  assert.equal(b2.newBranch.headCommitId, c1.commit.id);

  const c2 = commitProjectChange(project, {
    moduleId: 'm1',
    moduleName: 'Autenticación',
    message: 'Acuerdos de reunión Q4',
    mode: 'reunion',
    beforeText: 'Paso 1\nPaso 2',
    afterText: 'Paso 1\nPaso 2\nPaso 3 (SSO)',
    timestamp: '2026-11-02T11:00:00.000Z',
  });
  project = c2.project;

  const merged = mergeBranchInProject(project, b2.newBranch.id, 'br-main', 'Merge acuerdos');
  project = merged.project;
  assert.ok(merged.mergeCommit);
  assert.equal(merged.mergeCommit.parentCommitIds.length, 2);
  assert.equal(project.activeBranchId, 'br-main');

  const sourceBranchState = project.branches.find((b) => b.id === b2.newBranch.id);
  assert.equal(sourceBranchState?.isMerged, true);

  const layout = computeBranchGraphLayout(project.branches, project.commits);
  assert.equal(layout.laneCount, 2);
  assert.equal(layout.nodes.length, 3);
  assert.equal(layout.nodes[0].commit.id, merged.mergeCommit.id);
  assert.equal(layout.nodes[0].parentCoordinates.length, 2);
});

test('updateBranchInProject and deleteBranchInProject modify and remove branches safely', () => {
  let project = makeBaseProject();
  const created = createBranchInProject(project, 'feature/tmp', 'br-main');
  project = created.project;

  const c = commitProjectChange(project, {
    moduleId: null,
    moduleName: 'General',
    message: 'Cambio manual en rama',
    mode: 'manual',
    beforeText: '',
    afterText: 'Detalle',
    branchId: created.newBranch.id,
  });
  project = c.project;

  project = updateBranchInProject(project, created.newBranch.id, {
    name: 'feature/renombrada',
    color: '#7C3AED',
  });
  const renamed = project.branches.find((b) => b.id === created.newBranch.id);
  assert.equal(renamed?.name, 'feature/renombrada');
  assert.equal(renamed?.color, '#7C3AED');
  assert.equal(project.commits[0].branchName, 'feature/renombrada');

  // Protecting main from deletion
  project = deleteBranchInProject(project, 'br-main');
  assert.equal(project.branches.length, 2);

  // Deleting secondary branch reassigns activeBranchId to main
  project = deleteBranchInProject(project, created.newBranch.id);
  assert.equal(project.branches.length, 1);
  assert.equal(project.activeBranchId, 'br-main');
});
