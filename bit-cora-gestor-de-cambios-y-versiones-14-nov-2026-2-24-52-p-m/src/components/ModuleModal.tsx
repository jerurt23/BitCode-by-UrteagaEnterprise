import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { GitBranchItem, ModuleStatus, ProjectModule } from '../types/workspace';
import { MODULE_STATUS_LABELS } from '../utils/projectHelpers';

interface ModuleFormData {
  name: string;
  description: string;
  deadline: string;
  progress: number;
  status: ModuleStatus;
  branchId: string;
}

interface ModuleModalProps {
  isOpen: boolean;
  editingModule: ProjectModule | null;
  projectName: string;
  branches: GitBranchItem[];
  activeBranchId: string;
  onClose: () => void;
  onSave: (data: ModuleFormData) => void;
}

export const ModuleModal: React.FC<ModuleModalProps> = ({
  isOpen,
  editingModule,
  projectName,
  branches,
  activeBranchId,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('2026-12-15');
  const [progress, setProgress] = useState(100);
  const [status, setStatus] = useState<ModuleStatus>('en_progreso');
  const [branchId, setBranchId] = useState(activeBranchId);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (editingModule) {
      setName(editingModule.name);
      setDescription(editingModule.description);
      setDeadline(editingModule.deadline);
      setProgress(editingModule.progress);
      setStatus(editingModule.status);
      setBranchId(editingModule.branchId ?? activeBranchId);
    } else {
      setName('');
      setDescription('');
      setDeadline('2026-12-15');
      setProgress(88);
      setStatus('en_progreso');
      setBranchId(activeBranchId || branches[0]?.id || '');
    }
    setError('');
  }, [isOpen, editingModule, activeBranchId, branches]);

  if (!isOpen) return null;

  const handleProgressChange = (val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setProgress(clamped);
    if (clamped === 100) {
      setStatus('completado');
    } else if (clamped === 0) {
      setStatus('pendiente');
    } else if (status === 'completado' || status === 'pendiente') {
      setStatus('en_progreso');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('El nombre del módulo es obligatorio.');
      return;
    }

    onSave({
      name: trimmedName,
      description: description.trim() || 'Sin descripción de módulo.',
      deadline,
      progress,
      status,
      branchId,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="module-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3.5 sm:px-5 sm:py-4">
          <div>
            <h2 id="module-modal-title" className="text-base font-semibold text-zinc-900">
              {editingModule ? 'Editar módulo' : 'Crear módulo'}
            </h2>
            <p className="text-xs text-zinc-500">{projectName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de módulo"
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5">
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="mod-name" className="mb-1.5 block text-xs font-medium text-zinc-700">
              Nombre del módulo
            </label>
            <input
              id="mod-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Autenticación OAuth2"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="mod-desc" className="mb-1.5 block text-xs font-medium text-zinc-700">
              Descripción
            </label>
            <textarea
              id="mod-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Alcance funcional y entregables del módulo..."
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="mod-deadline" className="mb-1.5 block text-xs font-medium text-zinc-700">
                Fecha límite
              </label>
              <input
                id="mod-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="mod-status" className="mb-1.5 block text-xs font-medium text-zinc-700">
                Estado
              </label>
              <select
                id="mod-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ModuleStatus)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none"
              >
                {Object.entries(MODULE_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="mod-branch" className="mb-1.5 block text-xs font-medium text-zinc-700">
              Rama Git asignada
            </label>
            <select
              id="mod-branch"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.isMerged ? ' (fusionada)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="mod-progress" className="text-xs font-medium text-zinc-700">
                Estado de progreso inicial
              </label>
              <span className="font-mono text-xs font-semibold text-zinc-900 tabular-nums">
                {progress}%
              </span>
            </div>
            <input
              id="mod-progress"
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => handleProgressChange(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 whitespace-nowrap shrink-0"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              Guardar módulo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
