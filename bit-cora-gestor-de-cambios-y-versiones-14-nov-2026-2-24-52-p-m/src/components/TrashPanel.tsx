import React from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Project } from '../types/workspace';
import {
  TRASH_RETENTION_DAYS,
  formatShortDate,
  getProjectTrash,
  getTrashDaysLeft,
} from '../utils/projectHelpers';

interface TrashPanelProps {
  project: Project;
  onRestoreModule: (trashId: string) => void;
  onPurgeModule: (trashId: string) => void;
}

export const TrashPanel: React.FC<TrashPanelProps> = ({
  project,
  onRestoreModule,
  onPurgeModule,
}) => {
  const trash = getProjectTrash(project);

  const handlePurge = (trashId: string, moduleName: string) => {
    const confirmed = window.confirm(
      `¿Eliminar definitivamente el módulo "${moduleName}"? Esta acción no se puede deshacer.`,
    );
    if (confirmed) onPurgeModule(trashId);
  };

  return (
    <section
      aria-label="Papelera de módulos"
      className="rounded-lg border border-zinc-200 bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <Trash2 className="h-4 w-4 text-zinc-400" />
            Papelera
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-600">
              {trash.length}
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Los módulos eliminados o completados se borran definitivamente a los{' '}
            {TRASH_RETENTION_DAYS} días.
          </p>
        </div>
      </div>

      {trash.length === 0 ? (
        <p className="px-4 py-5 text-xs text-zinc-500 sm:px-5">
          La papelera está vacía. Los módulos que elimines o marques como completados
          aparecerán aquí.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {trash.map((entry) => {
            const daysLeft = getTrashDaysLeft(entry.trashedAt);
            return (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-zinc-900">
                      {entry.module.name}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        entry.reason === 'completado'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-zinc-200 bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {entry.reason === 'completado' ? 'Completado' : 'Eliminado'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Movido el {formatShortDate(entry.trashedAt)} ·{' '}
                    {daysLeft === 1 ? 'queda 1 día' : `quedan ${daysLeft} días`} antes
                    del borrado definitivo
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onRestoreModule(entry.id)}
                    className="inline-flex items-center gap-1.5 rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurar
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePurge(entry.id, entry.module.name)}
                    aria-label={`Eliminar definitivamente ${entry.module.name}`}
                    className="inline-flex items-center gap-1.5 rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
