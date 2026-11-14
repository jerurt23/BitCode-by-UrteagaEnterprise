import React from 'react';
import { SplitDiffRow } from '../utils/diffEngine';

interface SplitDiffViewerProps {
  rows: SplitDiffRow[];
  leftTitle: string;
  rightTitle: string;
  interactive?: boolean;
  selectedRowIds?: Set<string>;
  onToggleRow?: (rowId: string) => void;
}

export const SplitDiffViewer: React.FC<SplitDiffViewerProps> = ({
  rows,
  leftTitle,
  rightTitle,
  interactive = false,
  selectedRowIds,
  onToggleRow,
}) => {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
        No hay contenido para comparar en esta vista.
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
      data-testid="vscode-split-diff"
    >
      {/* Dual Pane Column Headers */}
      <div className="grid grid-cols-1 border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-700 md:grid-cols-2">
        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 md:border-b-0 md:border-r">
          <span className="truncate">{leftTitle}</span>
          <span className="font-mono text-[11px] text-red-700 whitespace-nowrap shrink-0">
            Original / Quitado
          </span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-2">
          <span className="truncate">{rightTitle}</span>
          <span className="font-mono text-[11px] text-emerald-700 whitespace-nowrap shrink-0">
            Propuesta / Agregado
          </span>
        </div>
      </div>

      {/* Split Rows */}
      <div className="divide-y divide-zinc-100 font-mono text-xs leading-6">
        {rows.map((row) => {
          const isChange = row.kind !== 'unchanged';
          const isChecked = selectedRowIds?.has(row.id) ?? false;

          const leftBg =
            row.kind === 'removed' || row.kind === 'replaced'
              ? 'bg-red-50/85 text-red-950'
              : row.kind === 'added'
                ? 'bg-zinc-50/80 text-zinc-400'
                : 'bg-white text-zinc-700';

          const rightBg =
            row.kind === 'added' || row.kind === 'replaced'
              ? 'bg-emerald-50/85 text-emerald-950'
              : row.kind === 'removed'
                ? 'bg-zinc-50/80 text-zinc-400'
                : 'bg-white text-zinc-700';

          const actionLabel =
            row.kind === 'replaced'
              ? 'Reemplazar línea'
              : row.kind === 'removed'
                ? 'Borrar línea'
                : row.kind === 'added'
                  ? 'Agregar línea'
                  : '';

          return (
            <div
              key={row.id}
              className="grid grid-cols-1 md:grid-cols-2"
              data-diff-kind={row.kind}
            >
              {/* Left Pane (Removed / Original) */}
              <div className={`flex min-w-0 items-stretch border-b border-zinc-100 md:border-b-0 md:border-r md:border-zinc-200 ${leftBg}`}>
                {interactive && (
                  <div className="flex w-8 shrink-0 items-center justify-center border-r border-zinc-200/70 bg-white/70 sm:w-9">
                    {isChange ? (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleRow?.(row.id)}
                        aria-label={`${actionLabel}: ${row.leftText ?? row.rightText ?? ''}`}
                        title={actionLabel}
                        className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
                      />
                    ) : (
                      <span className="text-zinc-300">·</span>
                    )}
                  </div>
                )}

                <span className="w-7 shrink-0 select-none border-r border-zinc-200/60 px-1 text-right text-[11px] text-zinc-400 tabular-nums sm:w-9 sm:px-1.5">
                  {row.leftLineNumber ?? ''}
                </span>
                <span className="w-4 shrink-0 select-none text-center font-semibold sm:w-5">
                  {row.kind === 'removed' || row.kind === 'replaced' ? (
                    <span className="text-red-600">-</span>
                  ) : (
                    ''
                  )}
                </span>
                <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-words px-2 py-0.5 font-mono">
                  {row.leftText ?? ''}
                </pre>
              </div>

              {/* Right Pane (Added / Replacement) */}
              <div className={`flex min-w-0 items-stretch ${rightBg}`}>
                <span className="w-7 shrink-0 select-none border-r border-zinc-200/60 px-1 text-right text-[11px] text-zinc-400 tabular-nums sm:w-9 sm:px-1.5">
                  {row.rightLineNumber ?? ''}
                </span>
                <span className="w-4 shrink-0 select-none text-center font-semibold sm:w-5">
                  {row.kind === 'added' || row.kind === 'replaced' ? (
                    <span className="text-emerald-600">+</span>
                  ) : (
                    ''
                  )}
                </span>
                <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-words px-2 py-0.5 font-mono">
                  {row.rightText ?? ''}
                </pre>
                {interactive && isChange && (
                  <span
                    className={`shrink-0 self-center pr-2 text-[10px] font-sans font-medium sm:pr-2.5 ${
                      row.kind === 'replaced'
                        ? 'text-amber-700'
                        : row.kind === 'removed'
                          ? 'text-red-700'
                          : 'text-emerald-700'
                    }`}
                  >
                    {row.kind === 'replaced'
                      ? 'Reemplazo'
                      : row.kind === 'removed'
                        ? 'Borrar'
                        : 'Agregar'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
