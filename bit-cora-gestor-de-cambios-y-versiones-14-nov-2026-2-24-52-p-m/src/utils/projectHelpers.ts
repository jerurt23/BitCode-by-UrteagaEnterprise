import { ModuleStatus, ProgressPoint, Project, ProjectModule } from '../types/workspace';

/**
 * Counts assigned/pending items in a module's bloc note.
 * Ignores blank lines and markdown section headings (# ...).
 * Lines marked as done with "[x]" or "[X]" are excluded from remaining work.
 */
export function countBlocAssignedItems(noteText: string): number {
  if (!noteText || !noteText.trim()) return 0;
  const lines = noteText.replace(/\r\n/g, '\n').split('\n');
  let count = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#{1,6}\s/.test(line)) continue;
    if (
      /^(?:[-*•◦▪▸–]|\d+(?:\.\d+)*\.|[a-z]\)|[ivxlcdm]+\))?\s*\[[xX]\]/i.test(
        line,
      )
    ) {
      continue;
    }
    const contentOnly = line
      .replace(
        /^(?:[-*•◦▪▸–]|\d+(?:\.\d+)*\.|[a-z]\)|[ivxlcdm]+\)|\[\s\])\s*/i,
        '',
      )
      .trim();
    if (!contentOnly) continue;
    count += 1;
  }
  return count;
}

/**
 * Computes progress inversely from the number of assigned items in the bloc:
 * - 0 items in bloc -> 100% (nothing pending)
 * - Each pending item reduces remaining completion down to a 5% minimum floor
 */
export function computeProgressFromBloc(noteText: string): number {
  const assigned = countBlocAssignedItems(noteText);
  if (assigned === 0) return 100;
  return Math.max(5, Math.round(100 - assigned * 12));
}

export function deriveStatusFromProgress(
  progress: number,
  currentStatus?: ModuleStatus,
): ModuleStatus {
  if (progress >= 100) return 'completado';
  if (currentStatus === 'en_revision') return 'en_revision';
  if (progress <= 5) return 'pendiente';
  return 'en_progreso';
}

export function computeProjectProgress(modules: ProjectModule[]): number {
  if (modules.length === 0) return 0;
  const total = modules.reduce((sum, mod) => sum + mod.progress, 0);
  return Math.round(total / modules.length);
}

export function appendProgressSnapshot(
  history: ProgressPoint[],
  newProgress: number,
  isoDate?: string,
): ProgressPoint[] {
  const dateObj = isoDate ? new Date(isoDate) : new Date();
  const dateKey = dateObj.toISOString().slice(0, 10);
  const label = dateObj.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
  });

  const existingIdx = history.findIndex((p) => p.date === dateKey);
  if (existingIdx >= 0) {
    return history.map((point, idx) =>
      idx === existingIdx ? { ...point, progress: newProgress } : point,
    );
  }
  return [...history, { date: dateKey, label, progress: newProgress }];
}

export function formatShortDate(isoOrDate: string): string {
  if (!isoOrDate) return 'Sin fecha';
  const d = new Date(isoOrDate.includes('T') ? isoOrDate : `${isoOrDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const MODULE_STATUS_LABELS: Record<ModuleStatus, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  en_revision: 'En revisión',
  completado: 'Completado',
};

export const PRIORITY_LABELS = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
} as const;

export function recalculateProjectWithModules(
  project: Project,
  modules: ProjectModule[],
): Project {
  const avg = computeProjectProgress(modules);
  const progressHistory = appendProgressSnapshot(project.progressHistory, avg);
  return {
    ...project,
    modules,
    progressHistory,
    updatedAt: new Date().toISOString(),
  };
}
