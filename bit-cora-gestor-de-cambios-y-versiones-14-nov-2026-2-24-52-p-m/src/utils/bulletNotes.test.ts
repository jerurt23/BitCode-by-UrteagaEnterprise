import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFamilyToAllItems,
  findParentBulletIndex,
  getDisplayMarker,
  indentBulletItem,
  outdentBulletItem,
  parseBulletLines,
  serializeBulletLines,
} from './bulletNotes';

test('parseBulletLines enforces bullet format on plain text and headings', () => {
  const items = parseBulletLines('Primer punto sin viñeta\n# Encabezado\n  ◦ Sub-punto');
  assert.equal(items.length, 3);
  assert.equal(items[0].style, 'disc');
  assert.equal(items[0].text, 'Primer punto sin viñeta');
  assert.equal(items[1].style, 'disc');
  assert.equal(items[1].text, 'Encabezado');
  assert.equal(items[2].indent, 1);
  assert.equal(items[2].style, 'circle');
  assert.equal(items[2].text, 'Sub-punto');
});

test('indentBulletItem links sub-bullets across 4+ nested levels with distinct sub-bullet types', () => {
  const initial = parseBulletLines(
    '• Principal\n• Nivel 2\n• Nivel 3\n• Nivel 4\n• Nivel 5',
  );

  let items = indentBulletItem(initial, 1); // indent 1 -> circle
  items = indentBulletItem(items, 2); // indent 1
  items = indentBulletItem(items, 2); // indent 2 -> square
  items = indentBulletItem(items, 3);
  items = indentBulletItem(items, 3);
  items = indentBulletItem(items, 3); // indent 3 -> arrow
  items = indentBulletItem(items, 4);
  items = indentBulletItem(items, 4);
  items = indentBulletItem(items, 4);
  items = indentBulletItem(items, 4); // indent 4 -> dash

  assert.equal(items[1].indent, 1);
  assert.equal(items[1].style, 'circle');
  assert.equal(items[2].indent, 2);
  assert.equal(items[2].style, 'square');
  assert.equal(items[3].indent, 3);
  assert.equal(items[3].style, 'arrow');
  assert.equal(items[4].indent, 4);
  assert.equal(items[4].style, 'dash');

  // Parent linkage check
  assert.equal(findParentBulletIndex(items, 1), 0);
  assert.equal(findParentBulletIndex(items, 2), 1);
  assert.equal(findParentBulletIndex(items, 3), 2);
  assert.equal(findParentBulletIndex(items, 4), 3);

  // Outdent back cleanly
  const outdented = outdentBulletItem(items, 2);
  assert.equal(outdented[2].indent, 1);
  assert.equal(outdented[2].style, 'circle');
});

test('numeric family computes hierarchical markers (1., 1.1., a), i)) and round-trips cleanly', () => {
  const initial = parseBulletLines(
    '• Principal\n  ◦ Sub 1\n  ◦ Sub 2\n    ▪ Sub-sub A\n      ▸ Sub-sub-sub I',
  );
  const numeric = applyFamilyToAllItems(initial, 'numeric');

  assert.equal(getDisplayMarker(numeric, 0), '1.');
  assert.equal(getDisplayMarker(numeric, 1), '1.1.');
  assert.equal(getDisplayMarker(numeric, 2), '1.2.');
  assert.equal(getDisplayMarker(numeric, 3), 'a)');
  assert.equal(getDisplayMarker(numeric, 4), 'i)');

  const serialized = serializeBulletLines(numeric);
  const reparsed = parseBulletLines(serialized);
  assert.equal(reparsed[0].style, 'decimal');
  assert.equal(reparsed[1].style, 'subdecimal');
  assert.equal(reparsed[3].style, 'alpha');
  assert.equal(reparsed[4].style, 'roman');
});
