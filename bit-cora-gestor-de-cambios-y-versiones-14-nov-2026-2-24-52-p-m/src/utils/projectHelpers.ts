import {
  ModuleStatus,
  ProgressPoint,
  Project,
  ProjectModule,
  TrashedModule,
  TrashReason,
} from '../types/workspace';

/**
 * Counts assigned/pending items in a module's bloc note.
 * Ignores blank lines and markdown section headings (# ...).
 * Lines marked as done with "[x]" or "[X]" are excluded from remaining work.
 */
export function countBlocAssignedItems(noteText: string): number {
  if (!noteText || !noteText.trim()) return 0;
  const lines = String(noteText).replace(/\r\n/g, '\n').split('\n');
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
    // Strip a leading bullet/number/alpha/roman marker, then an optional checkbox
    // marker, so empty bullets and empty checkboxes are ignored.
    const contentOnly = line
      .replace(
        /^(?:(?:[-*•◦▪▸–]|\d+(?:\.\d+)*\.|[a-z]\)|[ivxlcdm]+\))\s*)?(?:\[\s?\])?\s*/i,
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
  if (!noteText || !String(noteText).trim()) return 100;
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

/* =========================================================
   Papelera de módulos (retención de 30 días)
   ========================================================= */

export const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getProjectTrash(project: Project): TrashedModule[] {
  return project.trash ?? [];
}

/** Días completos que quedan antes del borrado definitivo (0 = expirado). */
export function getTrashDaysLeft(trashedAt: string, nowMs: number = Date.now()): number {
  const trashedMs = new Date(trashedAt).getTime();
  if (Number.isNaN(trashedMs)) return 0;
  const expiresMs = trashedMs + TRASH_RETENTION_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((expiresMs - nowMs) / DAY_MS));
}

/** Elimina de la papelera los módulos que ya superaron los 30 días. */
export function purgeExpiredTrash(project: Project, nowMs: number = Date.now()): Project {
  const current = getProjectTrash(project);
  if (current.length === 0) return project;
  const kept = current.filter((entry) => getTrashDaysLeft(entry.trashedAt, nowMs) > 0);
  if (kept.length === current.length) return project;
  return { ...project, trash: kept };
}

/** Mueve un módulo a la papelera, ya sea por eliminación o por completado. */
export function moveModuleToTrash(
  project: Project,
  moduleId: string,
  reason: TrashReason,
  nowIso: string = new Date().toISOString(),
): Project {
  const target = project.modules.find((m) => m.id === moduleId);
  if (!target) return project;

  const entry: TrashedModule = {
    id: `trash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    module: target,
    reason,
    trashedAt: nowIso,
  };
  const remaining = project.modules.filter((m) => m.id !== moduleId);
  const next = recalculateProjectWithModules(project, remaining);
  return { ...next, trash: [entry, ...getProjectTrash(project)] };
}

export function restoreModuleFromTrash(project: Project, trashId: string): Project {
  const entry = getProjectTrash(project).find((e) => e.id === trashId);
  if (!entry) return project;

  const restored: ProjectModule = {
    ...entry.module,
    updatedAt: new Date().toISOString(),
  };
  const next = recalculateProjectWithModules(project, [...project.modules, restored]);
  return { ...next, trash: getProjectTrash(project).filter((e) => e.id !== trashId) };
}

export function deleteTrashedModule(project: Project, trashId: string): Project {
  return {
    ...project,
    trash: getProjectTrash(project).filter((e) => e.id !== trashId),
  };
}
