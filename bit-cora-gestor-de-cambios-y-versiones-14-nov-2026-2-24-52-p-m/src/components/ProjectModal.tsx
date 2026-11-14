import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Priority, Project } from '../types/workspace';

interface ProjectFormData {
  name: string;
  description: string;
  location: string;
  priority: Priority;
  color: string;
  tags: string[];
  initialModuleName?: string;
}

interface ProjectModalProps {
  isOpen: boolean;
  editingProject: Project | null;
  onClose: () => void;
  onSave: (data: ProjectFormData) => void;
}

const PROJECT_COLORS = [
  { hex: '#2563EB', label: 'Azul cobalto' },
  { hex: '#0D9488', label: 'Verde azulado' },
  { hex: '#D97706', label: 'Ámbar' },
  { hex: '#7C3AED', label: 'Violeta' },
  { hex: '#DC2626', label: 'Carmesí' },
  { hex: '#3F3F46', label: 'Grafito' },
];

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  editingProject,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('/repos/');
  const [priority, setPriority] = useState<Priority>('media');
  const [color, setColor] = useState('#2563EB');
  const [tagsInput, setTagsInput] = useState('');
  const [initialModuleName, setInitialModuleName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (editingProject) {
      setName(editingProject.name);
      setDescription(editingProject.description);
      setLocation(editingProject.location);
      setPriority(editingProject.priority);
      setColor(editingProject.color);
      setTagsInput(editingProject.tags.join(', '));
      setInitialModuleName('');
    } else {
      setName('');
      setDescription('');
      setLocation('/repos/nuevo-proyecto');
      setPriority('media');
      setColor('#2563EB');
      setTagsInput('core, documentacion');
      setInitialModuleName('Módulo principal');
    }
    setError('');
  }, [isOpen, editingProject]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('El nombre del proyecto es obligatorio.');
      return;
    }

    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSave({
      name: trimmedName,
      description: description.trim() || 'Sin descripción registrada.',
      location: location.trim() || '/repos/proyecto',
      priority,
      color,
      tags: parsedTags,
      initialModuleName: initialModuleName.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3.5 sm:px-5 sm:py-4">
          <h2 id="project-modal-title" className="text-base font-semibold text-zinc-900">
            {editingProject ? 'Editar proyecto' : 'Nuevo proyecto'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de proyecto"
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
            <label htmlFor="proj-name" className="mb-1.5 block text-xs font-medium text-zinc-700">
              Nombre del proyecto
            </label>
            <input
              id="proj-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Sistema de Facturación v3"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="proj-desc" className="mb-1.5 block text-xs font-medium text-zinc-700">
              Descripción
            </label>
            <textarea
              id="proj-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objetivo técnico o alcance del proyecto..."
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="proj-location" className="mb-1.5 block text-xs font-medium text-zinc-700">
                Ubicación / Repositorio
              </label>
              <input
                id="proj-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="/repos/mi-proyecto"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="proj-priority" className="mb-1.5 block text-xs font-medium text-zinc-700">
                Prioridad
              </label>
              <select
                id="proj-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="proj-tags" className="mb-1.5 block text-xs font-medium text-zinc-700">
              Etiquetas (separadas por coma)
            </label>
            <input
              id="proj-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="api, frontend, clientes"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-zinc-700">Color identificador</span>
            <div className="flex flex-wrap items-center gap-2">
              {PROJECT_COLORS.map((swatch) => {
                const selected = color === swatch.hex;
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    onClick={() => setColor(swatch.hex)}
                    aria-label={`Color ${swatch.label}`}
                    aria-pressed={selected}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                      selected
                        ? 'border-zinc-900 bg-zinc-100 font-medium text-zinc-900'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <span className="whitespace-nowrap">{swatch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {!editingProject && (
            <div>
              <label htmlFor="proj-init-module" className="mb-1.5 block text-xs font-medium text-zinc-700">
                Módulo inicial
              </label>
              <input
                id="proj-init-module"
                type="text"
                value={initialModuleName}
                onChange={(e) => setInitialModuleName(e.target.value)}
                placeholder="Ej. Arquitectura base"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          )}

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
              {editingProject ? 'Guardar cambios' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
