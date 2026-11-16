import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Columns2,
  FileText,
  GitBranch,
  GitCompareArrows,
  History,
  Lightbulb,
  MessageSquare,
  Plus,
  RotateCcw,
  Save,
  Send,
  Square,
  Trash2,
  Users,
} from 'lucide-react';
import { NoteCaptureMode, Project, ProjectModule } from '../types/workspace';
import {
  applySelectedDiffChanges,
  computeSplitDiff,
  countDiffStats,
} from '../utils/diffEngine';
import {
  computeProgressFromBloc,
  computeProjectProgress,
  countBlocAssignedItems,
} from '../utils/projectHelpers';
import { BulletNoteEditor } from './BulletNoteEditor';
import { HistoryDiffView } from './HistoryDiffView';
import { ProgressCircle } from './ProgressCircle';
import { SplitDiffViewer } from './SplitDiffViewer';

type NotebookLayoutMode = 'dual' | 'compare' | 'single';
export type NotebookInnerTab = 'editor' | 'history';

interface NotebookComparatorViewProps {
  projects: Project[];
  project: Project;
  selectedModuleId: string | null;
  innerTab: NotebookInnerTab;
  initialHistoryCommitId: string | null;
  onChangeInnerTab: (tab: NotebookInnerTab) => void;
  onSelectModule: (moduleId: string) => void;
  onCreateModule: () => void;
  onDeleteModule: (moduleId: string) => void;
  onUpdateModuleNotes: (
    moduleId: string,
    patch: Partial<Pick<ProjectModule, 'currentNote' | 'meetingNote' | 'ideaNote'>>,
  ) => void;
  onSetModuleProgress: (moduleId: string, progress: number) => void;
  onAssignModuleBranch: (moduleId: string, branchId: string) => void;
  onApplySelectiveChanges: (params: {
    moduleId: string;
    mode: 'reunion' | 'idea';
    beforeText: string;
    afterText: string;
    commitMessage: string;
  }) => void;
  onSendNotesToModule: (params: {
    sourceModuleId: string;
    targetModuleId: string;
    mode: 'reunion' | 'idea';
    lines: string[];
    commitMessage: string;
  }) => number;
  onCreateModuleFromNotes: (params: {
    sourceModuleId: string;
    name: string;
    mode: 'reunion' | 'idea';
    lines: string[];
    commitMessage: string;
  }) => ProjectModule | null;
  onCommitManualSnapshot: (params: {
    moduleId: string;
    beforeText: string;
    afterText: string;
    commitMessage: string;
  }) => void;
  onSwitchBranch: (branchId: string) => void;
}

export const NotebookComparatorView: React.FC<NotebookComparatorViewProps> = ({
  projects,
  project,
  selectedModuleId,
  innerTab,
  initialHistoryCommitId,
  onChangeInnerTab,
  onSelectModule,
  onCreateModule,
  onDeleteModule,
  onUpdateModuleNotes,
  onSetModuleProgress,
  onAssignModuleBranch,
  onApplySelectiveChanges,
  onSendNotesToModule,
  onCreateModuleFromNotes,
  onCommitManualSnapshot,
  onSwitchBranch,
}) => {
  const activeModule =
    project.modules.find((m) => m.id === selectedModuleId) ?? project.modules[0] ?? null;

  // Which mode is active: 'actual' | 'reunion' | 'idea'
  const [selectedMode, setSelectedMode] = useState<NoteCaptureMode>('actual');
  // In dual/compare view, secondary pane compares reunion or idea against actual
  const [compareSideMode, setCompareSideMode] = useState<'reunion' | 'idea'>('reunion');
  const [layoutMode, setLayoutMode] = useState<NotebookLayoutMode>('single');
  const [captureSessionActive, setCaptureSessionActive] = useState<'reunion' | 'idea' | null>(
    null,
  );
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState('');
  const [lastSavedNotice, setLastSavedNotice] = useState<string | null>(null);
  const [baselineSnapshot, setBaselineSnapshot] = useState<string>('');
  const [destinationModuleId, setDestinationModuleId] = useState<string>('source');
  const [newModuleName, setNewModuleName] = useState('');
  const [showCommitMessage, setShowCommitMessage] = useState(false);
  const [createdModuleId, setCreatedModuleId] = useState<string | null>(null);

  useEffect(() => {
    if (activeModule) {
      setBaselineSnapshot(activeModule.currentNote);
    }
    setDestinationModuleId('source');
    setNewModuleName('');
    setCreatedModuleId(null);
  }, [activeModule?.id]);

  // Los avisos desaparecen solos para no llenar la pantalla en el teléfono.
  useEffect(() => {
    if (!lastSavedNotice) return;
    const timer = window.setTimeout(() => setLastSavedNotice(null), 10000);
    return () => window.clearTimeout(timer);
  }, [lastSavedNotice]);

  const handleSelectMode = (mode: NoteCaptureMode) => {
    setSelectedMode(mode);
    setLastSavedNotice(null);
    if (mode === 'reunion' || mode === 'idea') {
      setCompareSideMode(mode);
      setCaptureSessionActive(mode);
      // Cuando Modo Reunión o Modo Idea está activo, se coloca en vista de una sola ventana
      setLayoutMode('single');
    } else {
      setCaptureSessionActive(null);
      if (layoutMode === 'compare') {
        setLayoutMode('single');
      }
    }
  };

  const handleEndCaptureMode = () => {
    const endedMode = captureSessionActive ?? (selectedMode === 'idea' ? 'idea' : 'reunion');
    const modeTitle = endedMode === 'reunion' ? 'Modo Reunión' : 'Modo Idea';
    setCaptureSessionActive(null);
    setSelectedMode('actual');
    setCompareSideMode(endedMode);

    if (totalChanges > 0) {
      setLayoutMode('compare');
    } else {
      setLayoutMode('single');
    }
    setLastSavedNotice(`${modeTitle} finalizado.`);
  };

  const handleSelectLayout = (nextLayout: NotebookLayoutMode) => {
    setLayoutMode(nextLayout);
    if (nextLayout === 'compare') {
      setCaptureSessionActive(null);
    }
  };

  const activeBranchId =
    activeModule?.branchId ?? project.activeBranchId ?? project.branches[0]?.id ?? '';
  const activeBranch =
    project.branches.find((b) => b.id === activeBranchId) ?? project.branches[0];

  const comparisonText = activeModule
    ? compareSideMode === 'reunion'
      ? activeModule.meetingNote
      : activeModule.ideaNote
    : '';

  const diffRows = useMemo(() => {
    if (!activeModule) return [];
    return computeSplitDiff(activeModule.currentNote, comparisonText);
  }, [activeModule?.currentNote, comparisonText]);

  const diffStats = useMemo(() => countDiffStats(diffRows), [diffRows]);
  const totalChanges = diffStats.replaced + diffStats.removed + diffStats.added;
  const selectedIncomingLines = useMemo(
    () =>
      diffRows
        .filter((row) => selectedRowIds.has(row.id) && row.rightText !== null)
        .map((row) => row.rightText as string),
    [diffRows, selectedRowIds],
  );

  useEffect(() => {
    const allChangeIds = new Set(
      diffRows.filter((r) => r.kind !== 'unchanged').map((r) => r.id),
    );
    setSelectedRowIds(allChangeIds);
  }, [activeModule?.id, compareSideMode, layoutMode === 'compare']);

  // Al enviar a otro módulo solo interesan las notas nuevas; no hay que
  // desmarcar a mano los reemplazos/borrados del módulo actual.
  useEffect(() => {
    if (destinationModuleId === 'source') {
      setSelectedRowIds(
        new Set(
          diffRows.filter((r) => r.kind !== 'unchanged').map((r) => r.id),
        ),
      );
      return;
    }
    setSelectedRowIds(
      new Set(
        diffRows
          .filter((r) => r.kind !== 'unchanged' && r.rightText !== null)
          .map((r) => r.id),
      ),
    );
    // Solo se recalcula al cambiar el destino, no en cada clic de fila.
  }, [destinationModuleId]);

  const toggleRow = (rowId: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const selectAllChanges = () => {
    setSelectedRowIds(
      new Set(diffRows.filter((r) => r.kind !== 'unchanged').map((r) => r.id)),
    );
  };

  const clearAllChanges = () => {
    setSelectedRowIds(new Set());
  };

  const selectNewChanges = () => {
    setSelectedRowIds(
      new Set(
        diffRows
          .filter((r) => r.kind !== 'unchanged' && r.rightText !== null)
          .map((r) => r.id),
      ),
    );
  };

  const handleApplyChecked = () => {
    if (!activeModule) return;
    const modeLabel =
      compareSideMode === 'reunion' ? 'Modo Reunión' : 'Modo Idea';

    // 1) Aplicar sobre el módulo actual (comportamiento de siempre).
    if (destinationModuleId === 'source') {
      const beforeText = activeModule.currentNote;
      const afterText = applySelectedDiffChanges(diffRows, selectedRowIds);
      if (beforeText === afterText) {
        setLastSavedNotice('No hay cambios seleccionados para aplicar.');
        return;
      }

      const defaultMsg = `Aplicar acuerdos de ${modeLabel} en ${activeModule.name}`;
      onApplySelectiveChanges({
        moduleId: activeModule.id,
        mode: compareSideMode,
        beforeText,
        afterText,
        commitMessage: commitMessage.trim() || defaultMsg,
      });

      setBaselineSnapshot(afterText);
      setCommitMessage('');
      setSelectedRowIds(new Set());
      setCreatedModuleId(null);
      setLastSavedNotice(`Cambios aplicados en "${activeModule.name}".`);
      return;
    }

    // 2) Crear un módulo nuevo con las notas seleccionadas.
    if (destinationModuleId === 'new') {
      const name = newModuleName.trim();
      if (!name) {
        setLastSavedNotice('Escribe el nombre del nuevo módulo.');
        return;
      }
      if (selectedIncomingLines.length === 0) {
        setLastSavedNotice(
          'Selecciona notas nuevas de la propuesta para llevarlas al módulo nuevo.',
        );
        return;
      }

      const created = onCreateModuleFromNotes({
        sourceModuleId: activeModule.id,
        name,
        mode: compareSideMode,
        lines: selectedIncomingLines,
        commitMessage:
          commitMessage.trim() ||
          `Notas de ${modeLabel} → nuevo módulo ${name}`,
      });

      if (!created) {
        setLastSavedNotice('No se pudo crear el módulo con esas notas.');
        return;
      }

      setSelectedRowIds(new Set());
      setCommitMessage('');
      setNewModuleName('');
      setDestinationModuleId('source');
      setCreatedModuleId(created.id);
      setLastSavedNotice(
        `Módulo "${created.name}" creado con ${selectedIncomingLines.length} nota(s).`,
      );
      return;
    }

    // 3) Enviar las notas seleccionadas a otro módulo existente.
    const target = project.modules.find((m) => m.id === destinationModuleId);
    if (!target) {
      setLastSavedNotice('El módulo de destino ya no existe.');
      setDestinationModuleId('source');
      return;
    }
    if (selectedIncomingLines.length === 0) {
      setLastSavedNotice(
        'Selecciona notas nuevas de la propuesta para enviarlas a otro módulo.',
      );
      return;
    }

    const added = onSendNotesToModule({
      sourceModuleId: activeModule.id,
      targetModuleId: target.id,
      mode: compareSideMode,
      lines: selectedIncomingLines,
      commitMessage:
        commitMessage.trim() ||
        `Notas de ${modeLabel} → ${target.name}`,
    });

    if (added === 0) {
      setLastSavedNotice(
        `Esas notas ya existen en "${target.name}". No se duplicaron.`,
      );
      return;
    }

    setSelectedRowIds(new Set());
    setCommitMessage('');
    setCreatedModuleId(null);
    setLastSavedNotice(`${added} nota(s) enviadas a "${target.name}".`);
  };

  const handleSaveManualVersion = () => {
    if (!activeModule) return;
    if (baselineSnapshot === activeModule.currentNote) {
      setLastSavedNotice('Lo anotado actual ya está guardado en el historial.');
      return;
    }
    const msg =
      commitMessage.trim() || `Actualización manual en ${activeModule.name}`;
    onCommitManualSnapshot({
      moduleId: activeModule.id,
      beforeText: baselineSnapshot,
      afterText: activeModule.currentNote,
      commitMessage: msg,
    });
    setBaselineSnapshot(activeModule.currentNote);
    setCommitMessage('');
    setLastSavedNotice(
      `Versión guardada en historial y rama ${activeBranch?.name ?? 'main'}.`,
    );
  };

  const handleCopyCurrentToCapture = () => {
    if (!activeModule) return;
    if (compareSideMode === 'reunion') {
      onUpdateModuleNotes(activeModule.id, { meetingNote: activeModule.currentNote });
    } else {
      onUpdateModuleNotes(activeModule.id, { ideaNote: activeModule.currentNote });
    }
  };

  const assignedCount = activeModule
    ? countBlocAssignedItems(activeModule.currentNote)
    : 0;
  const computedBlocProgress = activeModule
    ? computeProgressFromBloc(activeModule.currentNote)
    : 100;
  const generalProjectProgress = computeProjectProgress(project.modules);

  const routeCount =
    destinationModuleId === 'source'
      ? selectedRowIds.size
      : selectedIncomingLines.length;

  const diffSummary =
    [
      diffStats.replaced > 0
        ? `${diffStats.replaced} reemplazo${diffStats.replaced === 1 ? '' : 's'}`
        : null,
      diffStats.removed > 0
        ? `${diffStats.removed} borrado${diffStats.removed === 1 ? '' : 's'}`
        : null,
      diffStats.added > 0
        ? `${diffStats.added} nueva${diffStats.added === 1 ? '' : 's'}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');

  const singleModeText = activeModule
    ? selectedMode === 'actual'
      ? activeModule.currentNote
      : selectedMode === 'reunion'
        ? activeModule.meetingNote
        : activeModule.ideaNote
    : '';

  const handleSingleModeChange = (value: string) => {
    if (!activeModule) return;
    if (selectedMode === 'actual') {
      onUpdateModuleNotes(activeModule.id, { currentNote: value });
    } else if (selectedMode === 'reunion') {
      onUpdateModuleNotes(activeModule.id, { meetingNote: value });
    } else {
      onUpdateModuleNotes(activeModule.id, { ideaNote: value });
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Inner Tabs inside Bloc y Comparador: Editor y Comparador | Historial Diff */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-2.5">
        <div
          role="tablist"
          aria-label="Pestañas del bloc"
          className="flex max-w-full flex-wrap items-center gap-1 rounded-md border border-zinc-200 bg-zinc-100 p-0.5 sm:flex-nowrap"
        >
          <button
            type="button"
            role="tab"
            aria-selected={innerTab === 'editor'}
            onClick={() => onChangeInnerTab('editor')}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 whitespace-nowrap ${
              innerTab === 'editor'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="sm:hidden">Editor</span>
            <span className="hidden sm:inline">Editor y Comparador</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={innerTab === 'history'}
            onClick={() => onChangeInnerTab('history')}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 whitespace-nowrap ${
              innerTab === 'history'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span className="sm:hidden">Historial ({project.commits.length})</span>
            <span className="hidden sm:inline">
              Historial Diff ({project.commits.length})
            </span>
          </button>
        </div>

        {activeModule && innerTab === 'editor' && (
          <div className="hidden flex-wrap items-center gap-3 text-xs text-zinc-600 sm:flex sm:gap-4">
            <div className="flex items-center gap-2">
              <ProgressCircle
                progress={activeModule.progress}
                color={project.color}
                size={30}
                strokeWidth={3}
              />
              <div>
                <div className="font-medium text-zinc-900 tabular-nums">
                  Módulo: {activeModule.progress}%{' '}
                  <span className="font-normal text-zinc-500">
                    ({assignedCount} {assignedCount === 1 ? 'asignado' : 'asignados'} en bloc)
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 tabular-nums">
                  General proyecto: <strong className="text-zinc-800">{generalProjectProgress}%</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:border-l sm:border-zinc-200 sm:pl-3">
              <label htmlFor="bloc-progress-slider" className="text-[11px] text-zinc-500 whitespace-nowrap">
                Ajustar %:
              </label>
              <input
                id="bloc-progress-slider"
                type="range"
                min={0}
                max={100}
                step={2}
                value={activeModule.progress}
                onChange={(e) =>
                  onSetModuleProgress(activeModule.id, Number(e.target.value))
                }
                className="w-24 accent-blue-600"
              />
              {activeModule.progress !== computedBlocProgress && (
                <button
                  type="button"
                  onClick={() =>
                    onSetModuleProgress(activeModule.id, computedBlocProgress)
                  }
                  title={`Recalcular según bloc (${computedBlocProgress}%)`}
                  className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap"
                >
                  <RotateCcw className="h-3 w-3" />
                  Auto ({computedBlocProgress}%)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {innerTab === 'history' ? (
        <HistoryDiffView
          projects={projects}
          activeProject={project}
          initialSelectedCommitId={initialHistoryCommitId}
        />
      ) : !activeModule ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-zinc-900">
            Sin módulos en {project.name}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Crea un módulo y asígnale una rama Git para trabajar en Modo Actual, Reunión o Idea.
          </p>
          <button
            type="button"
            onClick={onCreateModule}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Crear módulo
          </button>
        </div>
      ) : (
        <>
          {/* Row 1: Contexto del Módulo y Rama asignada */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 sm:px-4">
            <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto sm:gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
                <label htmlFor="notebook-module-select" className="text-xs font-medium text-zinc-500 whitespace-nowrap">
                  Módulo:
                </label>
                <select
                  id="notebook-module-select"
                  value={activeModule.id}
                  onChange={(e) => onSelectModule(e.target.value)}
                  className="min-w-0 flex-1 truncate rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 focus:border-blue-600 focus:outline-none sm:flex-none sm:max-w-[210px]"
                >
                  {project.modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.progress}%)
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onCreateModule}
                  aria-label="Crear nuevo módulo"
                  title="Crear nuevo módulo"
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap shrink-0 sm:px-2.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Módulo</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteModule(activeModule.id)}
                  aria-label={`Eliminar módulo ${activeModule.name}`}
                  title="Eliminar módulo (va a la papelera)"
                  className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-600 sm:text-zinc-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="hidden w-full items-center gap-1.5 sm:flex sm:w-auto">
                <GitBranch className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <label htmlFor="notebook-branch-select" className="sr-only">
                  Rama asignada al módulo
                </label>
                <select
                  id="notebook-branch-select"
                  value={activeBranch?.id ?? ''}
                  onChange={(e) => {
                    onAssignModuleBranch(activeModule.id, e.target.value);
                    onSwitchBranch(e.target.value);
                  }}
                  className="min-w-0 flex-1 truncate rounded-md border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 font-mono text-xs text-zinc-800 focus:border-blue-600 focus:outline-none sm:flex-none sm:max-w-[180px]"
                >
                  {project.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.isMerged ? ' (merged)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <details className="w-full sm:hidden">
              <summary className="cursor-pointer list-none text-[11px] font-medium text-zinc-500">
                Rama y progreso · {activeModule.progress}%
              </summary>
              <div className="mt-2 space-y-2">
                <select
                  aria-label="Rama asignada al módulo"
                  value={activeBranch?.id ?? ''}
                  onChange={(e) => {
                    onAssignModuleBranch(activeModule.id, e.target.value);
                    onSwitchBranch(e.target.value);
                  }}
                  className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 font-mono text-xs text-zinc-800 focus:border-blue-600 focus:outline-none"
                >
                  {project.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.isMerged ? ' (merged)' : ''}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={2}
                    value={activeModule.progress}
                    onChange={(e) =>
                      onSetModuleProgress(activeModule.id, Number(e.target.value))
                    }
                    aria-label="Ajustar progreso del módulo"
                    className="min-w-0 flex-1 accent-blue-600"
                  />
                  <span className="font-mono text-[11px] font-medium text-zinc-700 tabular-nums">
                    {activeModule.progress}%
                  </span>
                  {activeModule.progress !== computedBlocProgress && (
                    <button
                      type="button"
                      onClick={() =>
                        onSetModuleProgress(activeModule.id, computedBlocProgress)
                      }
                      className="rounded border border-zinc-300 bg-white px-1.5 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 whitespace-nowrap"
                    >
                      Auto {computedBlocProgress}%
                    </button>
                  )}
                </div>
              </div>
            </details>
          </div>

          {/* Row 2: Izquierda (Modos + Fin modo) | Centro (Comparar) | Derecha (1 vista | 2 vistas) */}
          <div
            data-testid="bloc-modes-toolbar"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 sm:gap-2.5 sm:px-4 sm:py-2.5 xl:grid xl:grid-cols-[1fr_auto_1fr]"
          >
            {/* LEFT: Modos + Fin modo reunión / Fin modo idea */}
            <div className="flex flex-wrap items-center gap-1.5 xl:flex-nowrap xl:justify-self-start">
              <div
                className="flex max-w-full flex-wrap items-center rounded-md border border-zinc-200 bg-zinc-100 p-0.5 sm:flex-nowrap"
                role="group"
                aria-label="Elegir modo a modificar"
              >
                <button
                  type="button"
                  onClick={() => handleSelectMode('actual')}
                  aria-label="Modo Actual"
                  title="Modo Actual"
                  aria-pressed={selectedMode === 'actual' && layoutMode !== 'compare'}
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 sm:px-2.5 ${
                    selectedMode === 'actual' && layoutMode !== 'compare'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Modo Actual</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectMode('reunion')}
                  aria-label="Modo Reunión"
                  title="Modo Reunión"
                  aria-pressed={
                    captureSessionActive === 'reunion' ||
                    (layoutMode === 'dual' && compareSideMode === 'reunion')
                  }
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 sm:px-2.5 ${
                    captureSessionActive === 'reunion' ||
                    (layoutMode === 'dual' && compareSideMode === 'reunion')
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Modo Reunión</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectMode('idea')}
                  aria-label="Modo Idea"
                  title="Modo Idea"
                  aria-pressed={
                    captureSessionActive === 'idea' ||
                    (layoutMode === 'dual' && compareSideMode === 'idea')
                  }
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 sm:px-2.5 ${
                    captureSessionActive === 'idea' ||
                    (layoutMode === 'dual' && compareSideMode === 'idea')
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Modo Idea</span>
                </button>
              </div>

              {captureSessionActive && (
                <button
                  type="button"
                  onClick={handleEndCaptureMode}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 whitespace-nowrap shrink-0"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="sm:hidden">
                    {captureSessionActive === 'reunion' ? 'Fin reunión' : 'Fin idea'}
                  </span>
                  <span className="hidden sm:inline">
                    {captureSessionActive === 'reunion'
                      ? 'Fin modo reunión'
                      : 'Fin modo idea'}
                  </span>
                </button>
              )}
            </div>

            {/* CENTER: Comparar */}
            <div className="hidden items-center justify-center sm:flex xl:justify-self-center">
              <button
                type="button"
                onClick={() => handleSelectLayout('compare')}
                aria-pressed={layoutMode === 'compare'}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  layoutMode === 'compare'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                <GitCompareArrows className="h-3.5 w-3.5" />
                Comparar ({totalChanges})
              </button>
            </div>

            {/* RIGHT: 1 vista | 2 vistas */}
            <div className="hidden items-center justify-end sm:flex xl:justify-self-end">
              <div
                className="flex items-center rounded-md border border-zinc-200 bg-zinc-100 p-0.5"
                role="group"
                aria-label="Cantidad de vistas"
              >
                <button
                  type="button"
                  onClick={() => handleSelectLayout('single')}
                  aria-pressed={layoutMode === 'single'}
                  className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    layoutMode === 'single'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Square className="h-3.5 w-3.5" />
                  1 vista
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLayout('dual')}
                  aria-pressed={layoutMode === 'dual'}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    layoutMode === 'dual'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Columns2 className="h-3.5 w-3.5" />
                  2 vistas
                </button>
              </div>
            </div>

            {/* Móvil: vista única | doble | comparar */}
            <div
              className="flex items-center rounded-md border border-zinc-200 bg-zinc-100 p-0.5 sm:hidden"
              role="group"
              aria-label="Vista del bloc"
            >
              <button
                type="button"
                onClick={() => handleSelectLayout('single')}
                aria-label="Vista única"
                aria-pressed={layoutMode === 'single'}
                className={`inline-flex items-center justify-center rounded px-2.5 py-1.5 ${
                  layoutMode === 'single'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500'
                }`}
              >
                <Square className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleSelectLayout('dual')}
                aria-label="Dos vistas"
                aria-pressed={layoutMode === 'dual'}
                className={`inline-flex items-center justify-center rounded px-2.5 py-1.5 ${
                  layoutMode === 'dual'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500'
                }`}
              >
                <Columns2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleSelectLayout('compare')}
                aria-label={`Comparar (${totalChanges})`}
                aria-pressed={layoutMode === 'compare'}
                className={`inline-flex items-center justify-center gap-0.5 rounded px-2.5 py-1.5 ${
                  layoutMode === 'compare'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-500'
                }`}
              >
                <GitCompareArrows className="h-3.5 w-3.5" />
                <span className="font-mono text-[10px] tabular-nums">
                  {totalChanges}
                </span>
              </button>
            </div>
          </div>

          {lastSavedNotice && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-900"
            >
              <span className="inline-flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-700" />
                {lastSavedNotice}
              </span>
              <div className="flex items-center gap-3">
                {createdModuleId && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectModule(createdModuleId);
                      setSelectedMode('actual');
                      setCaptureSessionActive(null);
                      setLayoutMode('single');
                      setLastSavedNotice(null);
                      setCreatedModuleId(null);
                    }}
                    className="font-medium text-emerald-900 underline hover:text-emerald-950 whitespace-nowrap"
                  >
                    Abrir módulo
                  </button>
                )}
                {layoutMode === 'compare' && (
                  <button
                    type="button"
                    onClick={() => handleSelectMode('actual')}
                    className="hidden font-medium text-emerald-900 underline hover:text-emerald-950 whitespace-nowrap sm:inline"
                  >
                    Volver a Modo Actual
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLastSavedNotice(null)}
                  className="text-emerald-800 underline hover:text-emerald-950 whitespace-nowrap"
                >
                  Ocultar
                </button>
              </div>
            </div>
          )}

          {/* Workspace Body */}
          {layoutMode === 'compare' ? (
            <div className="space-y-4">
              <div className="space-y-2.5 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-zinc-500">
                    {diffSummary || 'Sin cambios'}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] font-medium">
                    <button
                      type="button"
                      onClick={selectAllChanges}
                      className="text-zinc-500 hover:text-zinc-900"
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={selectNewChanges}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Nuevas
                    </button>
                    <button
                      type="button"
                      onClick={clearAllChanges}
                      className="text-zinc-500 hover:text-zinc-900"
                    >
                      Ninguna
                    </button>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <select
                    id="meeting-destination"
                    aria-label="Módulo de destino"
                    value={destinationModuleId}
                    onChange={(e) => setDestinationModuleId(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none sm:w-auto sm:max-w-[220px]"
                  >
                    <option value="source">
                      Módulo actual: {activeModule?.name ?? ''}
                    </option>
                    {project.modules
                      .filter((mod) => mod.id !== activeModule?.id)
                      .map((mod) => (
                        <option key={mod.id} value={mod.id}>
                          {mod.name}
                        </option>
                      ))}
                    <option value="new">+ Nuevo módulo…</option>
                  </select>

                  {destinationModuleId === 'new' && (
                    <input
                      type="text"
                      value={newModuleName}
                      onChange={(e) => setNewModuleName(e.target.value)}
                      aria-label="Nombre del nuevo módulo"
                      placeholder="Nombre del nuevo módulo"
                      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none sm:w-44"
                    />
                  )}

                  <div className="flex w-full items-center gap-2 sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setShowCommitMessage((prev) => !prev)}
                      aria-label="Mensaje del historial"
                      aria-expanded={showCommitMessage}
                      className="shrink-0 rounded-md border border-zinc-200 bg-white p-1.5 text-zinc-500 hover:bg-zinc-50 sm:hidden"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="text"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      aria-label="Mensaje de cambio para el historial"
                      placeholder="Mensaje (opcional)"
                      className={`${showCommitMessage ? 'block' : 'hidden'} w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-blue-600 focus:outline-none sm:block sm:w-56`}
                    />
                    <button
                      type="button"
                      onClick={handleApplyChecked}
                      disabled={
                        routeCount === 0 ||
                        totalChanges === 0 ||
                        (destinationModuleId === 'new' &&
                          !newModuleName.trim())
                      }
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300 whitespace-nowrap sm:w-auto"
                    >
                      {destinationModuleId === 'source' ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      {destinationModuleId === 'source'
                        ? `Aplicar (${routeCount})`
                        : destinationModuleId === 'new'
                          ? `Crear (${routeCount})`
                          : `Enviar (${routeCount})`}
                    </button>
                  </div>
                </div>
              </div>

              <SplitDiffViewer
                rows={diffRows}
                leftTitle="Lo anotado actual (Base)"
                rightTitle={
                  compareSideMode === 'reunion'
                    ? 'Modo Reunión (Propuesta)'
                    : 'Modo Idea (Propuesta)'
                }
                interactive
                selectedRowIds={selectedRowIds}
                onToggleRow={toggleRow}
              />
            </div>
          ) : layoutMode === 'single' ? (
            /* 1 Vista: Ventana única amplia para apuntar con viñetas */
            <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-zinc-900">
                    {selectedMode === 'actual'
                      ? 'Modo Actual (Lo anotado vigente)'
                      : selectedMode === 'reunion'
                        ? 'Modo Reunión'
                        : 'Modo Idea'}
                  </h3>
                  <p className="truncate text-[11px] text-zinc-500">
                    {selectedMode === 'actual'
                      ? `Base vigente · Cada pendiente reduce el progreso (${assignedCount} ${assignedCount === 1 ? 'asignado' : 'asignados'})`
                      : selectedMode === 'reunion'
                        ? 'Vista única para apuntado rápido en reunión · Notas siempre en viñetas'
                        : 'Vista única para explorar ideas · Notas siempre en viñetas'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedMode === 'actual' ? (
                    <button
                      type="button"
                      onClick={handleSaveManualVersion}
                      disabled={baselineSnapshot === activeModule.currentNote}
                      className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Guardar versión
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCopyCurrentToCapture}
                      className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap"
                    >
                      Copiar base aquí
                    </button>
                  )}
                </div>
              </div>

              <BulletNoteEditor
                ariaLabel={
                  selectedMode === 'actual'
                    ? 'Modo Actual'
                    : selectedMode === 'reunion'
                      ? 'Modo Reunión'
                      : 'Modo Idea'
                }
                value={singleModeText}
                onChange={handleSingleModeChange}
                minHeightClass="min-h-[400px]"
              />
            </div>
          ) : (
            /* 2 Vistas (Doble vista): Lo anotado actual + Modo Reunión o Modo Idea */
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
                <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2.5 sm:px-4">
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-zinc-900">
                      Lo anotado actual
                    </h3>
                    <p className="truncate text-[11px] text-zinc-500">
                      Base vigente · {assignedCount} {assignedCount === 1 ? 'asignado' : 'asignados'} ({activeModule.progress}%)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSaveManualVersion}
                      disabled={baselineSnapshot === activeModule.currentNote}
                      className="inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Guardar versión
                    </button>
                  </div>
                </div>

                <BulletNoteEditor
                  ariaLabel="Lo anotado actual"
                  value={activeModule.currentNote}
                  onChange={(nextVal) =>
                    onUpdateModuleNotes(activeModule.id, { currentNote: nextVal })
                  }
                  minHeightClass="min-h-[360px]"
                />
              </div>

              <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
                <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2.5 sm:px-4">
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-zinc-900">
                      {compareSideMode === 'reunion' ? 'Modo Reunión' : 'Modo Idea'}
                    </h3>
                    <p className="truncate text-[11px] text-zinc-500">
                      {compareSideMode === 'reunion'
                        ? 'Actualizaciones y acuerdos en curso'
                        : 'Exploración de mejoras sobre la base'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyCurrentToCapture}
                      className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap"
                    >
                      Copiar base aquí
                    </button>
                  </div>
                </div>

                <BulletNoteEditor
                  ariaLabel={
                    compareSideMode === 'reunion'
                      ? 'Notas de Modo Reunión'
                      : 'Notas de Modo Idea'
                  }
                  value={comparisonText}
                  onChange={(nextVal) =>
                    onUpdateModuleNotes(
                      activeModule.id,
                      compareSideMode === 'reunion'
                        ? { meetingNote: nextVal }
                        : { ideaNote: nextVal },
                    )
                  }
                  minHeightClass="min-h-[360px]"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
