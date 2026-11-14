export type BulletFamily = 'bullet' | 'numeric' | 'checklist';

export type BulletStyleType =
  | 'disc'
  | 'circle'
  | 'square'
  | 'arrow'
  | 'dash'
  | 'decimal'
  | 'subdecimal'
  | 'alpha'
  | 'roman'
  | 'checkbox-open'
  | 'checkbox-done';

export interface BulletItem {
  id: string;
  indent: number;
  style: BulletStyleType;
  text: string;
}

export const MAX_BULLET_INDENT = 5;

export const BULLET_STYLE_OPTIONS: Array<{
  style: BulletStyleType;
  label: string;
  preview: string;
  family: BulletFamily;
}> = [
  { style: 'disc', label: 'Punto sólido', preview: '•', family: 'bullet' },
  { style: 'circle', label: 'Círculo abierto', preview: '◦', family: 'bullet' },
  { style: 'square', label: 'Cuadrado', preview: '▪', family: 'bullet' },
  { style: 'arrow', label: 'Flecha', preview: '▸', family: 'bullet' },
  { style: 'dash', label: 'Guión', preview: '–', family: 'bullet' },
  { style: 'decimal', label: 'Numérico (1.)', preview: '1.', family: 'numeric' },
  { style: 'subdecimal', label: 'Subnumérico (1.1.)', preview: '1.1.', family: 'numeric' },
  { style: 'alpha', label: 'Alfabético (a))', preview: 'a)', family: 'numeric' },
  { style: 'roman', label: 'Romano (i))', preview: 'i)', family: 'numeric' },
  { style: 'checkbox-open', label: 'Checklist pendiente', preview: '☐', family: 'checklist' },
];

const BULLET_CYCLE: BulletStyleType[] = ['disc', 'circle', 'square', 'arrow', 'dash', 'dash'];
const NUMERIC_CYCLE: BulletStyleType[] = ['decimal', 'subdecimal', 'alpha', 'roman', 'decimal', 'alpha'];

export function getDefaultStyleForLevel(
  family: BulletFamily,
  indent: number,
): BulletStyleType {
  const idx = Math.max(0, Math.min(MAX_BULLET_INDENT, indent));
  if (family === 'checklist') return 'checkbox-open';
  if (family === 'numeric') return NUMERIC_CYCLE[idx];
  return BULLET_CYCLE[idx];
}

export function getFamilyFromStyle(style: BulletStyleType): BulletFamily {
  if (style === 'checkbox-open' || style === 'checkbox-done') return 'checklist';
  if (
    style === 'decimal' ||
    style === 'subdecimal' ||
    style === 'alpha' ||
    style === 'roman'
  ) {
    return 'numeric';
  }
  return 'bullet';
}

export function getLevelLabel(indent: number): string {
  if (indent <= 0) return 'Viñeta principal (N1)';
  if (indent === 1) return 'Sub-viñeta (N2)';
  if (indent === 2) return 'Sub-sub-viñeta (N3)';
  return `Sub-viñeta nivel ${indent + 1}`;
}

function toRoman(num: number): string {
  const table: Array<[number, string]> = [
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];
  let n = Math.max(1, num);
  let out = '';
  for (const [val, sym] of table) {
    while (n >= val) {
      out += sym;
      n -= val;
    }
  }
  return out;
}

function toAlpha(num: number): string {
  const n = Math.max(1, num);
  const code = ((n - 1) % 26) + 97;
  return String.fromCharCode(code);
}

/**
 * Computes the 1-based ordinal index of items[index] within its parent scope
 * (contiguous sibling group at the same indent level after any lower-indent item).
 */
function computeSiblingOrdinal(items: BulletItem[], index: number): number {
  const targetIndent = items[index].indent;
  let count = 1;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (items[i].indent < targetIndent) break;
    if (items[i].indent === targetIndent) count += 1;
  }
  return count;
}

function findParentOrdinal(items: BulletItem[], index: number): number {
  const targetIndent = items[index].indent;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (items[i].indent < targetIndent) {
      return computeSiblingOrdinal(items, i);
    }
  }
  return 1;
}

export function getDisplayMarker(items: BulletItem[], index: number): string {
  const item = items[index];
  if (!item) return '•';
  switch (item.style) {
    case 'disc':
      return '•';
    case 'circle':
      return '◦';
    case 'square':
      return '▪';
    case 'arrow':
      return '▸';
    case 'dash':
      return '–';
    case 'checkbox-open':
      return '[ ]';
    case 'checkbox-done':
      return '[x]';
    case 'decimal':
      return `${computeSiblingOrdinal(items, index)}.`;
    case 'subdecimal': {
      const parentOrd = findParentOrdinal(items, index);
      const ord = computeSiblingOrdinal(items, index);
      return `${parentOrd}.${ord}.`;
    }
    case 'alpha':
      return `${toAlpha(computeSiblingOrdinal(items, index))})`;
    case 'roman':
      return `${toRoman(computeSiblingOrdinal(items, index))})`;
  }
}

function makeItemId(index: number): string {
  return `bi-${index}-${Math.random().toString(36).slice(2, 6)}`;
}

export function parseBulletLines(rawText: string): BulletItem[] {
  const normalized = (rawText ?? '').replace(/\r\n/g, '\n');
  if (!normalized.trim()) {
    return [
      {
        id: makeItemId(0),
        indent: 0,
        style: 'disc',
        text: '',
      },
    ];
  }

  const rawLines = normalized.split('\n');
  const items: BulletItem[] = [];

  for (let i = 0; i < rawLines.length; i += 1) {
    const raw = rawLines[i];
    if (!raw.trim() && rawLines.length > 1) {
      // Skip blank spacer lines when parsing into structured bullet rows
      continue;
    }

    const tabMatch = raw.match(/^(\t+)/);
    const spaceMatch = raw.match(/^( +)/);
    let indent = 0;
    if (tabMatch) {
      indent = Math.min(MAX_BULLET_INDENT, tabMatch[1].length);
    } else if (spaceMatch) {
      indent = Math.min(MAX_BULLET_INDENT, Math.floor(spaceMatch[1].length / 2));
    }

    const trimmed = raw.trim();

    // Match checkbox variants: "- [x] foo", "• [ ] foo", "[x] foo"
    const doneMatch = trimmed.match(
      /^(?:[-*•◦▪▸–]|\d+(?:\.\d+)*\.|[a-z]+\)|[ivxlcdm]+\))?\s*\[[xX]\]\s*(.*)$/i,
    );
    if (doneMatch) {
      items.push({
        id: makeItemId(i),
        indent,
        style: 'checkbox-done',
        text: doneMatch[1],
      });
      continue;
    }

    const openMatch = trimmed.match(
      /^(?:[-*•◦▪▸–]|\d+(?:\.\d+)*\.|[a-z]+\)|[ivxlcdm]+\))?\s*\[\s\]\s*(.*)$/,
    );
    if (openMatch) {
      items.push({
        id: makeItemId(i),
        indent,
        style: 'checkbox-open',
        text: openMatch[1],
      });
      continue;
    }

    // Match headings (# foo) -> convert to principal bullet so notes are always bulleted
    const headingMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      items.push({
        id: makeItemId(i),
        indent: 0,
        style: 'disc',
        text: headingMatch[1],
      });
      continue;
    }

    // Match explicit bullet glyphs
    if (trimmed.startsWith('• ')) {
      items.push({ id: makeItemId(i), indent, style: 'disc', text: trimmed.slice(2) });
      continue;
    }
    if (trimmed === '•') {
      items.push({ id: makeItemId(i), indent, style: 'disc', text: '' });
      continue;
    }
    if (trimmed.startsWith('◦ ')) {
      items.push({ id: makeItemId(i), indent, style: 'circle', text: trimmed.slice(2) });
      continue;
    }
    if (trimmed === '◦') {
      items.push({ id: makeItemId(i), indent, style: 'circle', text: '' });
      continue;
    }
    if (trimmed.startsWith('▪ ')) {
      items.push({ id: makeItemId(i), indent, style: 'square', text: trimmed.slice(2) });
      continue;
    }
    if (trimmed === '▪') {
      items.push({ id: makeItemId(i), indent, style: 'square', text: '' });
      continue;
    }
    if (trimmed.startsWith('▸ ')) {
      items.push({ id: makeItemId(i), indent, style: 'arrow', text: trimmed.slice(2) });
      continue;
    }
    if (trimmed === '▸') {
      items.push({ id: makeItemId(i), indent, style: 'arrow', text: '' });
      continue;
    }
    if (/^[–-]\s+/.test(trimmed) || trimmed === '-' || trimmed === '–') {
      const content = trimmed.replace(/^[–-]\s*/, '');
      items.push({
        id: makeItemId(i),
        indent,
        style: trimmed.startsWith('–') ? 'dash' : getDefaultStyleForLevel('bullet', indent),
        text: content,
      });
      continue;
    }

    // Match sub-decimal (e.g. 1.1. )
    const subDecMatch = trimmed.match(/^\d+\.\d+\.?\s+(.*)$/);
    if (subDecMatch) {
      items.push({ id: makeItemId(i), indent, style: 'subdecimal', text: subDecMatch[1] });
      continue;
    }

    // Match decimal (e.g. 1. )
    const decMatch = trimmed.match(/^\d+[.)]\s*(.*)$/);
    if (decMatch) {
      items.push({ id: makeItemId(i), indent, style: 'decimal', text: decMatch[1] });
      continue;
    }

    // Match roman (i), ii), iii), iv), etc. — single letters c), d), l), m), v), x) remain alpha)
    const romanMatch = trimmed.match(/^(?:i|ii|iii|iv|vi|vii|viii|ix|xi|xii)\)\s*(.*)$/);
    if (romanMatch) {
      items.push({ id: makeItemId(i), indent, style: 'roman', text: romanMatch[1] });
      continue;
    }

    // Match alpha (e.g. a) b) c) )
    const alphaMatch = trimmed.match(/^[a-z]\)\s*(.*)$/);
    if (alphaMatch) {
      items.push({ id: makeItemId(i), indent, style: 'alpha', text: alphaMatch[1] });
      continue;
    }

    // Bare line -> enforce bullet format automatically
    items.push({
      id: makeItemId(i),
      indent,
      style: getDefaultStyleForLevel('bullet', indent),
      text: trimmed,
    });
  }

  return items.length > 0
    ? items
    : [{ id: makeItemId(0), indent: 0, style: 'disc', text: '' }];
}

export function serializeBulletLines(items: BulletItem[]): string {
  if (items.length === 0) return '';
  return items
    .map((item, idx) => {
      const prefix = '  '.repeat(Math.max(0, Math.min(MAX_BULLET_INDENT, item.indent)));
      const marker = getDisplayMarker(items, idx);
      return item.text ? `${prefix}${marker} ${item.text}` : `${prefix}${marker}`;
    })
    .join('\n');
}

export function canIndentBullet(items: BulletItem[], index: number): boolean {
  if (index <= 0 || index >= items.length) return false;
  const current = items[index];
  const prev = items[index - 1];
  return (
    current.indent < MAX_BULLET_INDENT &&
    current.indent <= prev.indent
  );
}

export function indentBulletItem(items: BulletItem[], index: number): BulletItem[] {
  if (!canIndentBullet(items, index)) return items;
  return items.map((item, idx) => {
    if (idx !== index) return item;
    const nextIndent = Math.min(MAX_BULLET_INDENT, item.indent + 1);
    const family = getFamilyFromStyle(item.style);
    const nextStyle =
      family === 'checklist'
        ? item.style
        : getDefaultStyleForLevel(family, nextIndent);
    return { ...item, indent: nextIndent, style: nextStyle };
  });
}

export function outdentBulletItem(items: BulletItem[], index: number): BulletItem[] {
  if (index < 0 || index >= items.length) return items;
  const current = items[index];
  if (current.indent <= 0) return items;

  const nextIndent = current.indent - 1;
  return items.map((item, idx) => {
    if (idx !== index) return item;
    const family = getFamilyFromStyle(item.style);
    const nextStyle =
      family === 'checklist'
        ? item.style
        : getDefaultStyleForLevel(family, nextIndent);
    return { ...item, indent: nextIndent, style: nextStyle };
  });
}

export function applyFamilyToAllItems(
  items: BulletItem[],
  family: BulletFamily,
): BulletItem[] {
  return items.map((item) => ({
    ...item,
    style:
      family === 'checklist' && item.style === 'checkbox-done'
        ? 'checkbox-done'
        : getDefaultStyleForLevel(family, item.indent),
  }));
}

export function findParentBulletIndex(items: BulletItem[], index: number): number | null {
  const current = items[index];
  if (!current || current.indent === 0) return null;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (items[i].indent < current.indent) {
      return i;
    }
  }
  return null;
}
