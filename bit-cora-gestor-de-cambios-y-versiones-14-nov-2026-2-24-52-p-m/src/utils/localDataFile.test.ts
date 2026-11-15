import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDataFileText } from './localDataFile';
import { Project } from '../types/workspace';

const project = {
  id: 'proj-1',
  name: 'Proyecto de prueba',
  modules: [],
} as unknown as Project;

test('acepta el formato exportado por BitCode', () => {
  const text = JSON.stringify({
    app: 'BitCode',
    version: 1,
    fileName: 'Datos BitCode.json',
    savedAt: new Date().toISOString(),
    projects: [project],
  });

  assert.deepEqual(parseDataFileText(text), [project]);
});

test('acepta un arreglo de proyectos sin envoltorio', () => {
  assert.deepEqual(parseDataFileText(JSON.stringify([project])), [project]);
});

test('rechaza archivos sin proyectos', () => {
  assert.throws(() => parseDataFileText('{}'), /no contiene proyectos/);
  assert.throws(() => parseDataFileText('[]'), /no contiene proyectos/);
});

test('rechaza proyectos con formato inválido', () => {
  assert.throws(
    () => parseDataFileText(JSON.stringify([{ name: 'sin id' }])),
    /no tiene el formato/,
  );
});
