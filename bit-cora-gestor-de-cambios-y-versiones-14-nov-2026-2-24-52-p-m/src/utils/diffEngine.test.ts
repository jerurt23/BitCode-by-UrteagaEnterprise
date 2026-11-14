import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySelectedDiffChanges,
  computeSplitDiff,
  countDiffStats,
} from './diffEngine';

test('computeSplitDiff identifies unchanged, replaced, removed, and added lines', () => {
  const before = [
    'Autenticación JWT con expiración 24h',
    'Cache en memoria local',
    'Endpoint /api/v1/pagos',
    'Logs en texto plano',
  ].join('\n');

  const after = [
    'Autenticación JWT con expiración 24h',
    'Cache distribuida en Redis',
    'Endpoint /api/v1/pagos',
    'Validación estricta de webhook HMAC',
  ].join('\n');

  const rows = computeSplitDiff(before, after);
  const stats = countDiffStats(rows);

  assert.equal(stats.unchanged, 2);
  assert.equal(stats.replaced, 2);
  assert.equal(stats.added, 0);
  assert.equal(stats.removed, 0);

  assert.equal(rows[1].kind, 'replaced');
  assert.equal(rows[1].leftText, 'Cache en memoria local');
  assert.equal(rows[1].rightText, 'Cache distribuida en Redis');
});

test('applySelectedDiffChanges selectively applies checked replacements, deletions, and additions', () => {
  const before = [
    'Línea fija 1',
    'Vieja regla de negocio',
    'Línea a eliminar',
    'Línea fija 2',
  ].join('\n');

  const after = [
    'Línea fija 1',
    'Nueva regla de negocio',
    'Línea fija 2',
    'Regla adicional de auditoría',
  ].join('\n');

  const rows = computeSplitDiff(before, after);
  // Expect:
  // row-0: unchanged ("Línea fija 1")
  // row-1: replaced ("Vieja regla de negocio" -> "Nueva regla de negocio")
  // row-2: removed ("Línea a eliminar")
  // row-3: unchanged ("Línea fija 2")
  // row-4: added ("Regla adicional de auditoría")
  assert.equal(rows.length, 5);

  // Select ONLY row-1 (replace) and row-4 (add), leave row-2 (remove) unchecked so it stays!
  const selected = new Set([rows[1].id, rows[4].id]);
  const merged = applySelectedDiffChanges(rows, selected);

  assert.equal(
    merged,
    [
      'Línea fija 1',
      'Nueva regla de negocio',
      'Línea a eliminar',
      'Línea fija 2',
      'Regla adicional de auditoría',
    ].join('\n'),
  );

  // Now also check row-2 to confirm deletion
  const selectedWithDelete = new Set([rows[1].id, rows[2].id, rows[4].id]);
  const mergedDeleted = applySelectedDiffChanges(rows, selectedWithDelete);
  assert.equal(mergedDeleted, after);
});
