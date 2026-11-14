import React from 'react';
import { CheckCircle2, FolderOpen, GitBranch, Pencil, Plus, Trash2 } from 'lucide-react';
import { Project, ProjectModule } from '../types/workspace';
import {
  MODULE_STATUS_LABELS,
  PRIORITY_LABELS,
  computeProjectProgress,
  formatShortDate,
} from '../utils/projectHelpers';
import { ProgressLineChart } from './ProgressLineChart';
import { TrashPanel } from './TrashPanel';

interface DashboardViewProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onCreateModule: () => void;
  onEditModule: (mod: ProjectModule) => void;
  onCompleteModule: (moduleId: string) => void;
  onDeleteModule: (moduleId: string) => void;
  onRestoreModule: (trashId: string) => void;
  onPurgeModule: (trashId: string) => void;
  onOpenModuleInNotebook: (moduleId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onCreateProject,
  onEditProject,
  onCreateModule,
  onEditModule,
  onCompleteModule,
  onDeleteModule,
  onRestoreModule,
  onPurgeModule,
  onOpenModuleInNotebook,
}) => {
  const totalProjects = projects.length;
  const totalModules = projects.reduce((sum, p) => sum + p.modules.length, 0);
  const avgProgress =
    totalProjects === 0
      ? 0
      : Math.round(
          projects.reduce((sum, p) => sum + computeProjectProgress(p.modules), 0) /
            totalProjects,
        );
  const totalCommits = projects.reduce((sum, p) => sum + p.commits.length, 0);

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <section
        aria-label="Resumen general de proyectos"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-4"
      >
        <div className="bg-white p-3.5 sm:p-4">
          <p className="text-xs font-medium text-zinc-500">Cantidad de proyectos</p>
          <p
            className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums"
            data-testid="kpi-project-count"
          >
            {totalProjects}
          </p>
        </div>
        <div className="bg-white p-3.5 sm:p-4">
          <p className="text-xs font-medium text-zinc-500">Módulos registrados</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums">
            {totalModules}
          </p>
        </div>
        <div className="bg-white p-3.5 sm:p-4">
          <p className="text-xs font-medium text-zinc-500">Progreso global promedio</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums">
            {avgProgress}%
          </p>
        </div>
        <div className="bg-white p-3.5 sm:p-4">
          <p className="text-xs font-medium text-zinc-500">Cambios en historial</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-zinc-900 tabular-nums">
            {totalCommits}
          </p>
        </div>
      </section>

      {/* Dominant Focal Anchor: Linear Progress Chart per Project */}
      <ProgressLineChart
        projects={projects}
        activeProjectId={activeProject?.id ?? ''}
        onSelectProject={onSelectProject}
      />

      {/* Active Project Detail & Modules Table */}
      {activeProject ? (
        <>
        <section className="rounded-lg border border-zinc-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 p-4 sm:p-5">
            <div className="min-w-[240px] flex-1 space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-3 w-3 rounded-sm shrink-0"
                  style={{ backgroundColor: activeProject.color }}
                />
                <h2 className="truncate text-lg font-semibold text-zinc-900">
                  {activeProject.name}
                </h2>
              </div>
              <p className="max-w-2xl text-sm text-zinc-600">{activeProject.description}</p>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500">
                <span className="inline-flex items-center gap-1 font-mono text-zinc-700">
                  <FolderOpen className="h-3.5 w-3.5 text-zinc-400" />
                  {activeProject.location}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Prioridad:{' '}
                  <strong className="font-medium text-zinc-800">
                    {PRIORITY_LABELS[activeProject.priority]}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-mono text-zinc-700">
                  <GitBranch className="h-3.5 w-3.5 text-zinc-400" />
                  {activeProject.branches.find((b) => b.id === activeProject.activeBranchId)
                    ?.name ?? 'main'}
                </span>
                {activeProject.tags.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-zinc-600">
                      Etiquetas: {activeProject.tags.join(' / ')}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onEditProject(activeProject)}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar proyecto
              </button>
              <button
                type="button"
                onClick={onCreateModule}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear módulo
              </button>
            </div>
          </div>

          {activeProject.modules.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-zinc-600">
                Este proyecto aún no tiene módulos registrados.
              </p>
              <button
                type="button"
                onClick={onCreateModule}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear primer módulo
              </button>
            </div>
          ) : (
            <>
              {/* Mobile & Tablet Module Cards */}
              <div className="grid grid-cols-1 divide-y divide-zinc-100 md:grid-cols-2 md:gap-px md:divide-y-0 md:bg-zinc-200 lg:hidden">
                {activeProject.modules.map((mod) => {
                  const modBranch =
                    activeProject.branches.find((b) => b.id === mod.branchId) ??
                    activeProject.branches[0];
                  return (
                    <div key={mod.id} className="space-y-2.5 bg-white p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-900">{mod.name}</div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
                            {mod.description}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-xs whitespace-nowrap ${
                            mod.status === 'completado'
                              ? 'font-medium text-emerald-700'
                              : mod.status === 'en_revision'
                                ? 'font-medium text-amber-700'
                                : 'text-zinc-700'
                          }`}
                        >
                          {MODULE_STATUS_LABELS[mod.status]}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1 font-mono text-zinc-700">
                          <GitBranch className="h-3 w-3 text-zinc-400" />
                          {modBranch?.name ?? 'main'}
                        </span>
                        <span className="font-mono tabular-nums">
                          Límite: {formatShortDate(mod.deadline)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${mod.progress}%`,
                              backgroundColor: activeProject.color,
                            }}
                          />
                        </div>
                        <span className="w-9 text-right font-mono text-xs font-medium text-zinc-900 tabular-nums">
                          {mod.progress}%
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => onOpenModuleInNotebook(mod.id)}
                          className="rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          Abrir bloc
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditModule(mod)}
                            aria-label={`Editar módulo ${mod.name}`}
                            className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onCompleteModule(mod.id)}
                            aria-label={`Marcar completado el módulo ${mod.name}`}
                            title="Marcar completado y mover a la papelera"
                            className="rounded p-1.5 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteModule(mod.id)}
                            aria-label={`Mover módulo ${mod.name} a la papelera`}
                            title="Mover a la papelera (30 días)"
                            className="rounded p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs font-medium text-zinc-500">
                      <th className="px-5 py-2.5">Módulo</th>
                      <th className="px-4 py-2.5">Rama Git</th>
                      <th className="px-4 py-2.5">Fecha límite</th>
                      <th className="px-4 py-2.5">Estado</th>
                      <th className="px-4 py-2.5 text-right">Progreso</th>
                      <th className="px-5 py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {activeProject.modules.map((mod) => {
                      const modBranch =
                        activeProject.branches.find((b) => b.id === mod.branchId) ??
                        activeProject.branches[0];
                      return (
                        <tr key={mod.id} className="transition-colors hover:bg-zinc-50/70">
                          <td className="px-5 py-3">
                            <div className="font-medium text-zinc-900">{mod.name}</div>
                            <div className="mt-0.5 max-w-md truncate text-xs text-zinc-500">
                              {mod.description}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-700 whitespace-nowrap">
                            {modBranch?.name ?? 'main'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-zinc-600 whitespace-nowrap tabular-nums">
                            {formatShortDate(mod.deadline)}
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-700 whitespace-nowrap">
                            <span
                              className={
                                mod.status === 'completado'
                                  ? 'font-medium text-emerald-700'
                                  : mod.status === 'en_revision'
                                    ? 'font-medium text-amber-700'
                                    : 'text-zinc-700'
                              }
                            >
                              {MODULE_STATUS_LABELS[mod.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2.5">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-200">
                                <div
                                  className="h-full transition-all"
                                  style={{
                                    width: `${mod.progress}%`,
                                    backgroundColor: activeProject.color,
                                  }}
                                />
                              </div>
                              <span className="w-9 font-mono text-xs font-medium text-zinc-900 tabular-nums">
                                {mod.progress}%
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenModuleInNotebook(mod.id)}
                                className="rounded border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                              >
                                Abrir bloc
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditModule(mod)}
                                aria-label={`Editar módulo ${mod.name}`}
                                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onCompleteModule(mod.id)}
                                aria-label={`Marcar completado el módulo ${mod.name}`}
                                title="Marcar completado y mover a la papelera"
                                className="rounded p-1.5 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteModule(mod.id)}
                                aria-label={`Mover módulo ${mod.name} a la papelera`}
                                title="Mover a la papelera (30 días)"
                                className="rounded p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <TrashPanel
          project={activeProject}
          onRestoreModule={onRestoreModule}
          onPurgeModule={onPurgeModule}
        />
        </>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center">
          <p className="text-sm text-zinc-600">No hay proyectos seleccionados.</p>
          <button
            type="button"
            onClick={onCreateProject}
            className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Crear primer proyecto
          </button>
        </div>
      )}
    </div>
  );
};
