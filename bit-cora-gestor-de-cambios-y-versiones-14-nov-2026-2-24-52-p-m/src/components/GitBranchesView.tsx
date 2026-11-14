import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  FileText,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { ChangeCommit, GitBranchItem, Project } from '../types/workspace';
import { computeBranchGraphLayout } from '../utils/gitGraph';
import { formatDateTime } from '../utils/projectHelpers';

interface GitBranchesViewProps {
  project: Project;
  onCreateBranch: (branchName: string, parentBranchId: string, color?: string) => string | null;
  onUpdateBranch: (branchId: string, updates: { name?: string; color?: string }) => void;
  onDeleteBranch: (branchId: string) => void;
  onSwitchBranch: (branchId: string) => void;
  onRecordBranchChange: (params: {
    branchId: string;
    moduleId: string | null;
    message: string;
    changeDetails: string;
  }) => void;
  onMergeBranch: (sourceBranchId: string, targetBranchId: string, message?: string) => void;
  onInspectCommitDiff: (commitId: string) => void;
}

const BRANCH_COLORS = [
  { hex: '#2563EB', label: 'Azul' },
  { hex: '#0D9488', label: 'Verde' },
  { hex: '#D97706', label: 'Ámbar' },
  { hex: '#7C3AED', label: 'Violeta' },
  { hex: '#DB2777', label: 'Rosa' },
  { hex: '#059669', label: 'Esmeralda' },
];

export const GitBranchesView: React.FC<GitBranchesViewProps> = ({
  project,
  onCreateBranch,
  onUpdateBranch,
  onDeleteBranch,
  onSwitchBranch,
  onRecordBranchChange,
  onMergeBranch,
  onInspectCommitDiff,
}) => {
  // 1. Nueva Rama
  const [newBranchName, setNewBranchName] = useState('');
  const [parentBranchId, setParentBranchId] = useState(
    project.activeBranchId || project.branches[0]?.id || '',
  );
  const [branchColor, setBranchColor] = useState('#0D9488');
  const [branchError, setBranchError] = useState('');

  // 2. Cambios en rama (vinculado a la nueva rama / seleccionada)
  const [changeBranchId, setChangeBranchId] = useState(
    project.activeBranchId || project.branches[0]?.id || '',
  );
  const [changeModuleId, setChangeModuleId] = useState(
    project.modules[0]?.id ?? '',
  );
  const [changeMessage, setChangeMessage] = useState('');
  const [changeDetails, setChangeDetails] = useState('');
  const [changeError, setChangeError] = useState('');
  const [changeFeedback, setChangeFeedback] = useState('');

  // 3. Fusionar ramas
  const [mergeSourceId, setMergeSourceId] = useState(() => {
    const nonMain = project.branches.find((b) => b.name !== 'main' && !b.isMerged);
    return nonMain?.id ?? '';
  });
  const [mergeTargetId, setMergeTargetId] = useState(() => {
    const main = project.branches.find((b) => b.name === 'main');
    return main?.id ?? project.branches[0]?.id ?? '';
  });
  const [mergeMessage, setMergeMessage] = useState('');

  // 4. Ramas configuradas (modificar / borrar)
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editBranchName, setEditBranchName] = useState('');
  const [editBranchColor, setEditBranchColor] = useState('#2563EB');

  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(
    project.commits[0]?.id ?? null,
  );

  // Keep selected branch ids synced when project changes
  useEffect(() => {
    setChangeBranchId(project.activeBranchId || project.branches[0]?.id || '');
    setParentBranchId(project.activeBranchId || project.branches[0]?.id || '');
    setChangeModuleId(project.modules[0]?.id ?? '');
    const nonMain = project.branches.find((b) => b.name !== 'main' && !b.isMerged);
    setMergeSourceId(nonMain?.id ?? '');
    const main = project.branches.find((b) => b.name === 'main');
    setMergeTargetId(main?.id ?? project.branches[0]?.id ?? '');
  }, [project.id]);

  const layout = useMemo(
    () => computeBranchGraphLayout(project.branches, project.commits),
    [project.branches, project.commits],
  );

  const selectedCommit: ChangeCommit | null =
    project.commits.find((c) => c.id === selectedCommitId) ?? project.commits[0] ?? null;

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newBranchName.trim();
    if (!clean) {
      setBranchError('Escribe un nombre para la rama (ej. feature/pagos-qr).');
      return;
    }
    const exists = project.branches.some(
      (b) => b.name.toLowerCase() === clean.toLowerCase(),
    );
    if (exists) {
      setBranchError('Ya existe una rama con ese nombre.');
      return;
    }
    setBranchError('');
    const createdId = onCreateBranch(
      clean,
      parentBranchId || project.activeBranchId,
      branchColor,
    );
    if (createdId) {
      // Link section 2 ("Cambios en rama") directly to the newly created branch
      setChangeBranchId(createdId);
      setMergeSourceId(createdId);
    }
    setNewBranchName('');
  };

  const handleRecordBranchChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeMessage.trim() && !changeDetails.trim()) {
      setChangeError('Escribe el resumen o detalle manual de lo realizado en esta rama.');
      return;
    }
    setChangeError('');
    const targetBranch =
      project.branches.find((b) => b.id === changeBranchId) ?? project.branches[0];

    onRecordBranchChange({
      branchId: targetBranch.id,
      moduleId: changeModuleId || null,
      message: changeMessage.trim() || `Cambio en ${targetBranch.name}`,
      changeDetails: changeDetails.trim() || changeMessage.trim(),
    });

    setChangeMessage('');
    setChangeDetails('');
    setChangeFeedback(`Cambio registrado manualmente en la rama ${targetBranch.name}.`);
  };

  const handleMerge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;
    onMergeBranch(mergeSourceId, mergeTargetId, mergeMessage);
    setMergeMessage('');
  };

  const startEditingBranch = (branch: GitBranchItem) => {
    setEditingBranchId(branch.id);
    setEditBranchName(branch.name);
    setEditBranchColor(branch.color);
  };

  const handleSaveBranchEdit = (branchId: string) => {
    if (!editBranchName.trim()) return;
    onUpdateBranch(branchId, {
      name: editBranchName.trim(),
      color: editBranchColor,
    });
    setEditingBranchId(null);
  };

  // SVG graph geometry constants
  const rowHeight = 76;
  const laneSpacing = 28;
  const graphPadX = 24;
  const graphWidth = Math.max(112, graphPadX * 2 + (layout.laneCount - 1) * laneSpacing);
  const graphHeight = Math.max(160, layout.nodes.length * rowHeight + 24);

  const mergeableSources = project.branches.filter(
    (b) => b.id !== mergeTargetId && !b.isMerged,
  );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Left: Visual Metro-Rail Git Branch Graph */}
      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Seguimiento visual de ramas Git
            </h2>
            <p className="text-xs text-zinc-500">
              Línea temporal de commits, bifurcaciones y fusiones en {project.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {layout.lanes.map((lane) => (
              <span
                key={lane.branchId}
                className="inline-flex items-center gap-1.5 font-mono text-zinc-700"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: lane.color }}
                />
                {lane.branchName}
              </span>
            ))}
          </div>
        </div>

        {layout.nodes.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            Aún no hay commits registrados en este proyecto. Registra un cambio en la columna derecha o desde el Bloc.
          </div>
        ) : (
          <div className="relative flex overflow-x-auto" data-testid="git-branch-graph">
            <svg
              width={graphWidth}
              height={graphHeight}
              className="shrink-0 select-none bg-zinc-50/40"
              aria-hidden="true"
            >
              {layout.nodes.map((node) => {
                const cx = graphPadX + node.lane * laneSpacing;
                const cy = 38 + node.row * rowHeight;

                return node.parentCoordinates.map((parent, pIdx) => {
                  const px = graphPadX + parent.lane * laneSpacing;
                  const py = 38 + parent.row * rowHeight;
                  const midY = (cy + py) / 2;
                  const strokeColor = pIdx === 0 ? node.color : parent.color;

                  const d =
                    cx === px
                      ? `M ${cx} ${cy} L ${px} ${py}`
                      : `M ${cx} ${cy} C ${cx} ${midY}, ${px} ${midY}, ${px} ${py}`;

                  return (
                    <path
                      key={`${node.commit.id}-p-${pIdx}`}
                      d={d}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                    />
                  );
                });
              })}

              {layout.nodes.map((node) => {
                const cx = graphPadX + node.lane * laneSpacing;
                const cy = 38 + node.row * rowHeight;
                const isSelected = selectedCommit?.id === node.commit.id;
                const isMerge = node.commit.parentCommitIds.length > 1;

                return (
                  <g key={node.commit.id}>
                    {isSelected && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={10}
                        fill="none"
                        stroke={node.color}
                        strokeWidth={1.5}
                        opacity={0.4}
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isMerge ? 6.5 : 5.5}
                      fill={isMerge ? '#FFFFFF' : node.color}
                      stroke={node.color}
                      strokeWidth={2.5}
                    />
                  </g>
                );
              })}
            </svg>

            <div className="min-w-[460px] flex-1 divide-y divide-zinc-100">
              {layout.nodes.map((node) => {
                const c = node.commit;
                const isSelected = selectedCommit?.id === c.id;
                const headOfBranches = project.branches.filter(
                  (b) => b.headCommitId === c.id,
                );

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCommitId(c.id)}
                    style={{ height: `${rowHeight}px` }}
                    className={`flex w-full items-center justify-between gap-4 overflow-hidden px-4 text-left transition-colors ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 font-mono text-xs font-semibold text-blue-700">
                          {c.shortHash}
                        </span>
                        <span className="truncate text-sm font-medium text-zinc-900">
                          {c.message}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-tight text-zinc-500">
                        <span className="max-w-[200px] truncate">{c.moduleName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-zinc-700">{c.branchName}</span>
                        {headOfBranches.map((hb) => (
                          <span
                            key={hb.id}
                            className="font-mono font-semibold"
                            style={{ color: hb.color }}
                          >
                            [HEAD → {hb.name}]
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 text-right font-mono text-[11px] text-zinc-500 tabular-nums whitespace-nowrap">
                      <div>{formatDateTime(c.timestamp)}</div>
                      <div>
                        <span className="text-emerald-700">+{c.addedLines}</span>{' '}
                        <span className="text-red-700">-{c.removedLines}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Commit Details Bar */}
        {selectedCommit && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/70 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <GitCommitHorizontal className="h-4 w-4 shrink-0 text-blue-700" />
                <span className="font-mono text-xs font-semibold text-blue-700">
                  {selectedCommit.shortHash}
                </span>
                <span className="truncate text-xs font-semibold text-zinc-900">
                  {selectedCommit.message}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                Rama: <span className="font-mono">{selectedCommit.branchName}</span> · Módulo:{' '}
                {selectedCommit.moduleName}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onInspectCommitDiff(selectedCommit.id)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 whitespace-nowrap shrink-0"
            >
              Ver diff en estilo VS Code
            </button>
          </div>
        )}
      </section>

      {/* Right Column in Strict Order: 1. Nueva Rama -> 2. Cambios en rama -> 3. Fusionar ramas -> 4. Ramas configuradas */}
      <aside className="space-y-4 lg:col-span-5">
        {/* 1. Nueva Rama */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
            <GitBranch className="h-4 w-4 text-zinc-500" />
            1. Nueva rama
          </h3>
          <form onSubmit={handleCreateBranch} className="mt-3 space-y-3">
            {branchError && (
              <p className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                {branchError}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="new-branch-name" className="mb-1 block text-xs font-medium text-zinc-700">
                  Nombre de la rama
                </label>
                <input
                  id="new-branch-name"
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="feature/nuevo-flujo"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="parent-branch-select" className="mb-1 block text-xs font-medium text-zinc-700">
                  Desde rama origen
                </label>
                <select
                  id="parent-branch-select"
                  value={parentBranchId}
                  onChange={(e) => setParentBranchId(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 font-mono text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
                >
                  {project.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {BRANCH_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setBranchColor(c.hex)}
                    aria-label={`Color de rama ${c.label}`}
                    aria-pressed={branchColor === c.hex}
                    className={`h-5 w-5 rounded-full border-2 ${
                      branchColor === c.hex ? 'border-zinc-900' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear rama
              </button>
            </div>
          </form>
        </section>

        {/* 2. Cambios en rama (vinculado a nueva rama) */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
            <FileText className="h-4 w-4 text-zinc-500" />
            2. Cambios en rama
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Escribe manualmente lo que se realizó en la rama seleccionada.
          </p>

          <form onSubmit={handleRecordBranchChange} className="mt-3 space-y-3">
            {changeError && (
              <p className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                {changeError}
              </p>
            )}
            {changeFeedback && (
              <p className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800">
                {changeFeedback}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="change-branch-select" className="mb-1 block text-xs font-medium text-zinc-700">
                  Rama vinculada
                </label>
                <select
                  id="change-branch-select"
                  value={changeBranchId}
                  onChange={(e) => setChangeBranchId(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 font-mono text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
                >
                  {project.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="change-module-select" className="mb-1 block text-xs font-medium text-zinc-700">
                  Módulo relacionado
                </label>
                <select
                  id="change-module-select"
                  value={changeModuleId}
                  onChange={(e) => setChangeModuleId(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">General del proyecto</option>
                  {project.modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="branch-change-title" className="mb-1 block text-xs font-medium text-zinc-700">
                Título del cambio
              </label>
              <input
                id="branch-change-title"
                type="text"
                value={changeMessage}
                onChange={(e) => setChangeMessage(e.target.value)}
                placeholder="Ej. Ajuste de validación de tokens en endpoint"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="branch-change-detail" className="mb-1 block text-xs font-medium text-zinc-700">
                Lo que se hizo en esta rama (manual)
              </label>
              <textarea
                id="branch-change-detail"
                rows={3}
                value={changeDetails}
                onChange={(e) => setChangeDetails(e.target.value)}
                placeholder="- Se agregó soporte para firma SHA256&#10;- Se corrigió timeout en reintentos"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Registrar cambio en rama
            </button>
          </form>
        </section>

        {/* 3. Fusionar ramas */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
            <GitMerge className="h-4 w-4 text-zinc-500" />
            3. Fusionar ramas
          </h3>
          {mergeableSources.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">
              Crea una rama secundaria activa para poder fusionarla hacia la rama destino.
            </p>
          ) : (
            <form onSubmit={handleMerge} className="mt-3 space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="merge-src" className="mb-1 block text-xs font-medium text-zinc-700">
                    Origen
                  </label>
                  <select
                    id="merge-src"
                    value={mergeSourceId}
                    onChange={(e) => setMergeSourceId(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs text-zinc-900"
                  >
                    {mergeableSources.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="merge-dst" className="mb-1 block text-xs font-medium text-zinc-700">
                    Destino
                  </label>
                  <select
                    id="merge-dst"
                    value={mergeTargetId}
                    onChange={(e) => setMergeTargetId(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs text-zinc-900"
                  >
                    {project.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <input
                type="text"
                value={mergeMessage}
                onChange={(e) => setMergeMessage(e.target.value)}
                aria-label="Mensaje de merge"
                placeholder="Mensaje opcional de fusión..."
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
              />

              <button
                type="submit"
                disabled={!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Fusionar rama en destino
              </button>
            </form>
          )}
        </section>

        {/* 4. Ramas configuradas (con opción para modificar o borrar rama) */}
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-900">4. Ramas configuradas</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Activa, modifica o elimina ramas de este proyecto.
          </p>

          <ul className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100">
            {project.branches.map((branch) => {
              const isActive = branch.id === project.activeBranchId;
              const isEditing = editingBranchId === branch.id;
              const isMain = branch.name === 'main';

              return (
                <li key={branch.id} className="py-2.5">
                  {isEditing ? (
                    <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-2.5">
                      <input
                        type="text"
                        value={editBranchName}
                        onChange={(e) => setEditBranchName(e.target.value)}
                        aria-label={`Editar nombre de rama ${branch.name}`}
                        className="w-full rounded border border-zinc-300 bg-white px-2.5 py-1 font-mono text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {BRANCH_COLORS.map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              onClick={() => setEditBranchColor(c.hex)}
                              aria-label={`Nuevo color ${c.label}`}
                              className={`h-4 w-4 rounded-full border-2 ${
                                editBranchColor === c.hex
                                  ? 'border-zinc-900'
                                  : 'border-transparent'
                              }`}
                              style={{ backgroundColor: c.hex }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingBranchId(null)}
                            aria-label="Cancelar edición de rama"
                            className="rounded border border-zinc-300 bg-white p-1 text-zinc-600 hover:bg-zinc-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveBranchEdit(branch.id)}
                            aria-label={`Guardar rama ${branch.name}`}
                            className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: branch.color }}
                          />
                          <span className="truncate font-mono text-xs font-medium text-zinc-900">
                            {branch.name}
                          </span>
                        </div>
                        {branch.isMerged && (
                          <span className="pl-4 text-[11px] text-zinc-500">Fusionada</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isActive ? (
                          <span className="mr-1 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-blue-700 whitespace-nowrap">
                            <Check className="h-3 w-3" />
                            Activa
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSwitchBranch(branch.id)}
                            className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap"
                          >
                            Usar
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => startEditingBranch(branch)}
                          aria-label={`Modificar rama ${branch.name}`}
                          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>

                        {!isMain && (
                          <button
                            type="button"
                            onClick={() => onDeleteBranch(branch.id)}
                            aria-label={`Borrar rama ${branch.name}`}
                            className="rounded p-1 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
};
