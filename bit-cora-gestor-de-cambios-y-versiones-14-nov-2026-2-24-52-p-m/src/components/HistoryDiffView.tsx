import React, { useEffect, useMemo, useState } from 'react';
import { GitBranch, Search } from 'lucide-react';
import { ChangeCommit, ChangeOriginMode, Project } from '../types/workspace';
import { computeSplitDiff } from '../utils/diffEngine';
import { formatDateTime } from '../utils/projectHelpers';
import { SplitDiffViewer } from './SplitDiffViewer';

interface HistoryDiffViewProps {
  projects: Project[];
  activeProject: Project;
  initialSelectedCommitId: string | null;
}

const MODE_LABELS: Record<ChangeOriginMode, string> = {
  reunion: 'Reunión',
  idea: 'Idea',
  manual: 'Manual',
  merge: 'Merge',
};

export const HistoryDiffView: React.FC<HistoryDiffViewProps> = ({
  projects,
  activeProject,
  initialSelectedCommitId,
}) => {
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const [modeFilter, setModeFilter] = useState<'all' | ChangeOriginMode>('all');
  const [query, setQuery] = useState('');
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(
    initialSelectedCommitId,
  );

  useEffect(() => {
    if (initialSelectedCommitId) {
      setSelectedCommitId(initialSelectedCommitId);
    }
  }, [initialSelectedCommitId]);

  const commitsPool = useMemo(() => {
    const sourceProjects = scope === 'active' ? [activeProject] : projects;
    const all = sourceProjects.flatMap((p) =>
      p.commits.map((c) => ({ ...c, projectName: p.name, projectColor: p.color })),
    );
    return all.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [projects, activeProject, scope]);

  const filteredCommits = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commitsPool.filter((c) => {
      if (modeFilter !== 'all' && c.mode !== modeFilter) return false;
      if (!q) return true;
      return (
        c.message.toLowerCase().includes(q) ||
        c.moduleName.toLowerCase().includes(q) ||
        c.branchName.toLowerCase().includes(q) ||
        c.shortHash.toLowerCase().includes(q)
      );
    });
  }, [commitsPool, modeFilter, query]);

  const selectedCommit: (ChangeCommit & { projectName: string; projectColor: string }) | null =
    filteredCommits.find((c) => c.id === selectedCommitId) ?? filteredCommits[0] ?? null;

  const splitRows = useMemo(() => {
    if (!selectedCommit) return [];
    return computeSplitDiff(selectedCommit.beforeText, selectedCommit.afterText);
  }, [selectedCommit]);

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-3 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex max-w-full flex-wrap items-center rounded-md border border-zinc-200 bg-zinc-100 p-0.5">
            <button
              type="button"
              onClick={() => setScope('active')}
              aria-pressed={scope === 'active'}
              className={`max-w-[180px] truncate rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                scope === 'active' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
              }`}
            >
              {activeProject.name}
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              aria-pressed={scope === 'all'}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                scope === 'all' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
              }`}
            >
              Todos los proyectos
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {(['all', 'reunion', 'idea', 'manual', 'merge'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeFilter(m)}
                aria-pressed={modeFilter === m}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  modeFilter === m
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {m === 'all' ? 'Todos' : MODE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar en historial de cambios"
            placeholder="Buscar mensaje, módulo o rama..."
            className="w-full rounded-md border border-zinc-300 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none sm:w-60"
          />
        </div>
      </div>

      {/* Main Split Grid: Commit List + VS Code Dual-Pane Diff */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left List */}
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white lg:col-span-4">
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
            <h2 className="text-xs font-semibold text-zinc-900">
              Historial de cambios ({filteredCommits.length})
            </h2>
          </div>

          {filteredCommits.length === 0 ? (
            <p className="p-6 text-center text-xs text-zinc-500">
              No hay cambios registrados con los filtros actuales.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {filteredCommits.map((commit) => {
                const isSelected = selectedCommit?.id === commit.id;
                return (
                  <li key={commit.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCommitId(commit.id)}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-medium text-blue-700">
                          {commit.shortHash}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                          {formatDateTime(commit.timestamp)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-zinc-900 line-clamp-2">
                        {commit.message}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                        {scope === 'all' && (
                          <>
                            <span className="font-medium text-zinc-700">
                              {commit.projectName}
                            </span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span>{commit.moduleName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{commit.branchName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{MODE_LABELS[commit.mode]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums whitespace-nowrap">
                          <span className="text-emerald-700">+{commit.addedLines}</span>
                          <span className="text-red-700">-{commit.removedLines}</span>
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right VS Code Split Diff Viewer */}
        <div className="space-y-3 lg:col-span-8">
          {selectedCommit ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-blue-700">
                      {selectedCommit.shortHash}
                    </span>
                    <h3 className="text-sm font-semibold text-zinc-900">
                      {selectedCommit.message}
                    </h3>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                    <span>{selectedCommit.moduleName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-mono text-zinc-700">
                      <GitBranch className="h-3 w-3" />
                      {selectedCommit.branchName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Origen: {MODE_LABELS[selectedCommit.mode]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatDateTime(selectedCommit.timestamp)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                  <span className="font-medium text-emerald-700">
                    +{selectedCommit.addedLines} agregadas
                  </span>
                  <span className="font-medium text-red-700">
                    -{selectedCommit.removedLines} quitadas
                  </span>
                </div>
              </div>

              <SplitDiffViewer
                rows={splitRows}
                leftTitle={`Antes (${selectedCommit.moduleName})`}
                rightTitle={`Después (${selectedCommit.shortHash})`}
              />
            </>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500">
              Selecciona un cambio del historial para inspeccionar su comparativa en doble vista.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
