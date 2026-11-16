import React from 'react';
import { Lightbulb, Plus, Users, X } from 'lucide-react';

export interface NewModuleNoteCandidate {
  id: string;
  mode: 'reunion' | 'idea';
  kind: 'added' | 'replaced';
  text: string;
}

interface NewModuleModalProps {
  isOpen: boolean;
  name: string;
  onNameChange: (name: string) => void;
  candidates: NewModuleNoteCandidate[];
  selectedIds: Set<string>;
  onToggleNote: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const NewModuleModal: React.FC<NewModuleModalProps> = ({
  isOpen,
  name,
  onNameChange,
  candidates,
  selectedIds,
  onToggleNote,
  onSelectAll,
  onSelectNone,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const reunionNotes = candidates.filter((note) => note.mode === 'reunion');
  const ideaNotes = candidates.filter((note) => note.mode === 'idea');
  const selectedCount = candidates.filter((note) =>
    selectedIds.has(note.id),
  ).length;
  const canCreate = name.trim().length > 0 && selectedCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-module-modal-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3.5">
          <h2
            id="new-module-modal-title"
            className="text-base font-semibold text-zinc-900"
          >
            Nuevo módulo
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canCreate) onConfirm();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="space-y-4 overflow-y-auto p-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-zinc-700">
                Nombre del módulo
              </span>
              <input
                type="text"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Ej. Integración de pagos"
                autoFocus
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-zinc-700">
                  Notas nuevas
                </span>
                <div className="flex items-center gap-2 text-[10px] font-medium">
                  <button
                    type="button"
                    onClick={onSelectAll}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={onSelectNone}
                    className="text-zinc-500 hover:text-zinc-900"
                  >
                    Ninguna
                  </button>
                </div>
              </div>

              {candidates.length === 0 ? (
                <p className="rounded-md border border-dashed border-zinc-200 px-3 py-4 text-center text-xs text-zinc-500">
                  No hay notas nuevas en Reunión ni Idea.
                </p>
              ) : (
                <div className="space-y-3">
                  {reunionNotes.length > 0 && (
                    <div className="rounded-md border border-zinc-200">
                      <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50/70 px-3 py-2 text-[11px] font-semibold text-zinc-700">
                        <Users className="h-3.5 w-3.5 text-zinc-500" />
                        Modo Reunión
                        <span className="font-normal text-zinc-400">
                          ({reunionNotes.length})
                        </span>
                      </div>
                      <ul className="divide-y divide-zinc-100">
                        {reunionNotes.map((note) => (
                          <li key={note.id}>
                            <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 hover:bg-zinc-50/60">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(note.id)}
                                onChange={() => onToggleNote(note.id)}
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-blue-600"
                              />
                              <span className="min-w-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-700">
                                {note.text}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {ideaNotes.length > 0 && (
                    <div className="rounded-md border border-zinc-200">
                      <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50/70 px-3 py-2 text-[11px] font-semibold text-zinc-700">
                        <Lightbulb className="h-3.5 w-3.5 text-zinc-500" />
                        Modo Idea
                        <span className="font-normal text-zinc-400">
                          ({ideaNotes.length})
                        </span>
                      </div>
                      <ul className="divide-y divide-zinc-100">
                        {ideaNotes.map((note) => (
                          <li key={note.id}>
                            <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 hover:bg-zinc-50/60">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(note.id)}
                                onChange={() => onToggleNote(note.id)}
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-blue-600"
                              />
                              <span className="min-w-0 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-700">
                                {note.text}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canCreate}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Crear módulo ({selectedCount})
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
