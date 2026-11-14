export type DiffRowKind = 'unchanged' | 'removed' | 'added' | 'replaced';

export interface SplitDiffRow {
  id: string;
  kind: DiffRowKind;
  leftLineNumber: number | null;
  rightLineNumber: number | null;
  leftText: string | null;
  rightText: string | null;
}

export interface DiffStats {
  added: number;
  removed: number;
  replaced: number;
  unchanged: number;
}

interface RawOp {
  type: 'equal' | 'remove' | 'add';
  text: string;
}

function splitLines(text: string): string[] {
  if (text === '') return [];
  return text.replace(/\r\n/g, '\n').split('\n');
}

/**
 * Longest Common Subsequence (Myers-equivalent deterministic line diff).
 */
function computeLineOps(beforeLines: string[], afterLines: string[]): RawOp[] {
  const n = beforeLines.length;
  const m = afterLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (beforeLines[i] === afterLines[j]) {
        dp[i][j] = 1 + dp[i + 1][j + 1];
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const ops: RawOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (beforeLines[i] === afterLines[j]) {
      ops.push({ type: 'equal', text: beforeLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'remove', text: beforeLines[i] });
      i++;
    } else {
      ops.push({ type: 'add', text: afterLines[j] });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: 'remove', text: beforeLines[i] });
    i++;
  }
  while (j < m) {
    ops.push({ type: 'add', text: afterLines[j] });
    j++;
  }
  return ops;
}

/**
 * Pairs consecutive remove+add runs into 'replaced' rows for VS Code-style split diff
 * and selective merge checkboxes (replace, delete, add).
 */
export function computeSplitDiff(beforeText: string, afterText: string): SplitDiffRow[] {
  const beforeLines = splitLines(beforeText);
  const afterLines = splitLines(afterText);
  const ops = computeLineOps(beforeLines, afterLines);

  const rows: SplitDiffRow[] = [];
  let leftLine = 1;
  let rightLine = 1;
  let idx = 0;
  let rowCounter = 0;

  while (idx < ops.length) {
    const current = ops[idx];
    if (current.type === 'equal') {
      rows.push({
        id: `row-${rowCounter++}`,
        kind: 'unchanged',
        leftLineNumber: leftLine++,
        rightLineNumber: rightLine++,
        leftText: current.text,
        rightText: current.text,
      });
      idx++;
      continue;
    }

    const removedBatch: string[] = [];
    const addedBatch: string[] = [];

    while (idx < ops.length && ops[idx].type === 'remove') {
      removedBatch.push(ops[idx].text);
      idx++;
    }
    while (idx < ops.length && ops[idx].type === 'add') {
      addedBatch.push(ops[idx].text);
      idx++;
    }

    const maxPair = Math.max(removedBatch.length, addedBatch.length);
    for (let k = 0; k < maxPair; k++) {
      const hasLeft = k < removedBatch.length;
      const hasRight = k < addedBatch.length;

      if (hasLeft && hasRight) {
        rows.push({
          id: `row-${rowCounter++}`,
          kind: 'replaced',
          leftLineNumber: leftLine++,
          rightLineNumber: rightLine++,
          leftText: removedBatch[k],
          rightText: addedBatch[k],
        });
      } else if (hasLeft) {
        rows.push({
          id: `row-${rowCounter++}`,
          kind: 'removed',
          leftLineNumber: leftLine++,
          rightLineNumber: null,
          leftText: removedBatch[k],
          rightText: null,
        });
      } else if (hasRight) {
        rows.push({
          id: `row-${rowCounter++}`,
          kind: 'added',
          leftLineNumber: null,
          rightLineNumber: rightLine++,
          leftText: null,
          rightText: addedBatch[k],
        });
      }
    }
  }

  return rows;
}

export function countDiffStats(rows: SplitDiffRow[]): DiffStats {
  return rows.reduce<DiffStats>(
    (acc, row) => {
      acc[row.kind] += 1;
      return acc;
    },
    { added: 0, removed: 0, replaced: 0, unchanged: 0 },
  );
}

/**
 * Applies only user-checked diff operations (replace, remove, add) onto the current note.
 * - 'unchanged': always kept
 * - 'replaced': if checked -> uses rightText; if unchecked -> keeps leftText
 * - 'removed': if checked -> deletes line (omitted); if unchecked -> keeps leftText
 * - 'added': if checked -> inserts rightText; if unchecked -> omits rightText
 */
export function applySelectedDiffChanges(
  rows: SplitDiffRow[],
  selectedRowIds: Set<string>,
): string {
  const resultLines: string[] = [];

  for (const row of rows) {
    const isSelected = selectedRowIds.has(row.id);

    if (row.kind === 'unchanged') {
      if (row.leftText !== null) resultLines.push(row.leftText);
    } else if (row.kind === 'replaced') {
      if (isSelected) {
        if (row.rightText !== null) resultLines.push(row.rightText);
      } else {
        if (row.leftText !== null) resultLines.push(row.leftText);
      }
    } else if (row.kind === 'removed') {
      // Checked means user confirms deletion
      if (!isSelected && row.leftText !== null) {
        resultLines.push(row.leftText);
      }
    } else if (row.kind === 'added') {
      if (isSelected && row.rightText !== null) {
        resultLines.push(row.rightText);
      }
    }
  }

  return resultLines.join('\n');
}
