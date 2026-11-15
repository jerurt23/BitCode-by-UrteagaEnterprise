import { useMutation, useQuery } from 'convex/react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Menu,
  Moon,
  Plus,
  Search,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { DashboardView } from './components/DashboardView';
import { GitBranchesView } from './components/GitBranchesView';
import { ModuleModal } from './components/ModuleModal';
import {
  NotebookComparatorView,
  NotebookInnerTab,
} from './components/NotebookComparatorView';
import { ProgressCircle } from './components/ProgressCircle';
import { ProjectModal } from './components/ProjectModal';
import { SettingsView } from './components/SettingsView';
import { api } from '../convex/_generated/api';
import { SEED_PROJECTS } from './data/seedProjects';
import {
  ModuleStatus,
  Priority,
  Project,
  ProjectModule,
  WorkspaceSection,
} from './types/workspace';
import {
  commitProjectChange,
  createBranchInProject,
  deleteBranchInProject,
  mergeBranchInProject,
  updateBranchInProject,
} from './utils/gitGraph';
import {
  LOCAL_DATA_FILE_NAME,
  exportDataFile,
  parseDataFileText,
  requestPersistentStorage,
  saveLocalDataFile,
} from './utils/localDataFile';
import { getDeviceId } from './utils/device';
import {
  PRIORITY_LABELS,
  computeProgressFromBloc,
  computeProjectProgress,
  deleteTrashedModule,
  deriveStatusFromProgress,
  moveModuleToTrash,
  purgeExpiredTrash,
  recalculateProjectWithModules,
  restoreModuleFromTrash,
} from './utils/projectHelpers';

const STORAGE_KEY = 'bitacora_projects_v2';
const THEME_KEY = 'bitcode_theme';

type ThemeMode = 'light' | 'dark';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function loadInitialTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Sin preferencia guardada
  }
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

function normalizeProjects(projects: Project[]): Project[] {
  return projects.map((project) => purgeExpiredTrash({ ...project, trash: project.trash ?? [] }));
}

function loadInitialProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeProjects(SEED_PROJECTS);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Un arreglo vacío es válido: significa "empezar desde cero".
      return normalizeProjects(parsed as Project[]);
    }
    return normalizeProjects(SEED_PROJECTS);
  } catch {
    return normalizeProjects(SEED_PROJECTS);
  }
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>(loadInitialProjects);
  const [activeProjectId, setActiveProjectId] = useState<string>(
    () => loadInitialProjects()[0]?.id ?? '',
  );
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(
    () => new Set(loadInitialProjects()[0]?.id ? [loadInitialProjects()[0].id] : []),
  );
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(
    () => loadInitialProjects()[0]?.modules[0]?.id ?? null,
  );
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('dashboard');
  const [notebookInnerTab, setNotebookInnerTab] = useState<NotebookInnerTab>('editor');
  const [historyCommitId, setHistoryCommitId] = useState<string | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(loadInitialTheme);
  const [localFileSavedAt, setLocalFileSavedAt] = useState<Date | null>(null);
  const [localFileUnavailable, setLocalFileUnavailable] = useState(false);
  const [dataNotice, setDataNotice] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );
  const [isInstalledApp] = useState(
    () =>
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true,
  );
  const [isIos] = useState(() => /iphone|ipad|ipod/i.test(navigator.userAgent));
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const noticeTimer = useRef<number | null>(null);

  const showDataNotice = (kind: 'ok' | 'error', text: string) => {
    setDataNotice({ kind, text });
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setDataNotice(null), 5000);
  };

  // --- Sincronización con Convex ---
  const remoteProjects = useQuery(api.workspace.get);
  const saveWorkspace = useMutation(api.workspace.save);
  const resetWorkspace = useMutation(api.workspace.reset);
  const deviceId = useMemo(getDeviceId, []);
  const hydratedFromConvex = useRef(false);
  const lastSyncedPayload = useRef<string | null>(null);
  const pendingPayload = useRef<string | null>(null);

  // Modals
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<ProjectModule | null>(null);

  // Copia local como caché/fallback mientras Convex responde.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [projects]);

  // Sincronización en vivo: cualquier cambio remoto se aplica al instante.
  useEffect(() => {
    if (remoteProjects === undefined) return;

    // null significa que todavía no existe el documento en Convex (primer uso).
    if (remoteProjects === null) {
      if (!hydratedFromConvex.current) {
        hydratedFromConvex.current = true;
        const local = loadInitialProjects();
        lastSyncedPayload.current = JSON.stringify(local);
        saveWorkspace({ projects: local, deviceId }).catch((error) => {
          console.warn('No se pudo inicializar el workspace en Convex', error);
        });
      }
      return;
    }

    // Un arreglo vacío es un espacio de trabajo reiniciado, no "sin datos".
    const remote = normalizeProjects(remoteProjects as Project[]);
    const remotePayload = JSON.stringify(remote);
    // Es el eco de nuestro propio guardado.
    if (remotePayload === lastSyncedPayload.current) return;
    // Hay ediciones locales esperando a guardarse: no las pisamos.
    if (pendingPayload.current !== null) return;

    hydratedFromConvex.current = true;
    lastSyncedPayload.current = remotePayload;
    setProjects((prev) => (JSON.stringify(prev) === remotePayload ? prev : remote));
  }, [remoteProjects, saveWorkspace, deviceId]);

  // Guardado con debounce cuando cambia el estado local.
  useEffect(() => {
    if (!hydratedFromConvex.current) return;

    const payload = JSON.stringify(projects);
    if (payload === lastSyncedPayload.current) return;

    pendingPayload.current = payload;
    const timer = setTimeout(() => {
      saveWorkspace({ projects, deviceId })
        .then(() => {
          lastSyncedPayload.current = payload;
        })
        .catch((error) => {
          console.warn('No se pudo guardar el workspace en Convex', error);
        })
        .finally(() => {
          pendingPayload.current = null;
        });
    }, 400);

    return () => clearTimeout(timer);
  }, [projects, saveWorkspace]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore storage quota errors cleanly
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0b0b0d' : '#FAF9F6');
    }
  }, [theme]);

  // --- Archivo local "Datos BitCode" + PWA ---
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      showDataNotice('ok', 'BitCode quedó instalada en tu teléfono.');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Guarda una copia en el archivo interno "Datos BitCode.json" en cada cambio.
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      saveLocalDataFile(projects)
        .then((saved) => {
          if (cancelled) return;
          if (saved) {
            setLocalFileSavedAt(new Date());
            setLocalFileUnavailable(false);
          } else {
            setLocalFileUnavailable(true);
          }
        })
        .catch(() => {
          // Sin OPFS disponible, localStorage sigue funcionando como caché.
        });
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [projects]);

  const handleExportData = async () => {
    try {
      const result = await exportDataFile(projects);
      showDataNotice(
        'ok',
        result === 'shared'
          ? 'Copia lista. Guárdala en Archivos/Drive.'
          : `${LOCAL_DATA_FILE_NAME} descargado.`,
      );
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      showDataNotice('error', 'No se pudo exportar la copia.');
    }
  };

  const handleImportDataFile = async (file: File) => {
    try {
      const imported = parseDataFileText(await file.text());
      const ok = window.confirm(
        `Se reemplazarán los datos actuales (${projects.length} proyectos) por los del archivo (${imported.length} proyectos). ¿Continuar?`,
      );
      if (!ok) return;

      const next = normalizeProjects(imported);
      hydratedFromConvex.current = true;
      lastSyncedPayload.current = null;
      pendingPayload.current = null;
      setProjects(next);
      setActiveProjectId(next[0]?.id ?? '');
      setSelectedModuleId(next[0]?.modules[0]?.id ?? null);
      setExpandedProjectIds(new Set(next[0]?.id ? [next[0].id] : []));
      showDataNotice('ok', `Copia importada: ${next.length} proyectos.`);
    } catch (error) {
      showDataNotice(
        'error',
        error instanceof Error ? error.message : 'No se pudo leer el archivo.',
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === 'accepted') {
      showDataNotice('ok', 'BitCode instalado en tu teléfono.');
    }
  };

  const handleResetAll = async () => {
    await resetWorkspace({});

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Sin almacenamiento disponible.
    }

    hydratedFromConvex.current = true;
    lastSyncedPayload.current = '[]';
    pendingPayload.current = null;
    setProjects([]);
    setActiveProjectId('');
    setExpandedProjectIds(new Set());
    setSelectedModuleId(null);
    setProjectModalOpen(false);
    setEditingProject(null);
    setModuleModalOpen(false);
    setEditingModule(null);
    setActiveSection('settings');

    // Deja el archivo local vacío para que no reaparezcan los datos al abrir.
    await saveLocalDataFile([]);
  };

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null,
    [projects, activeProjectId],
  );

  useEffect(() => {
    if (!activeProject) {
      setSelectedModuleId(null);
      return;
    }
    const belongs = activeProject.modules.some((m) => m.id === selectedModuleId);
    if (!belongs) {
      setSelectedModuleId(activeProject.modules[0]?.id ?? null);
    }
  }, [activeProject?.id, activeProject?.modules.length]);

  const filteredSidebarProjects = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.location.toLowerCase().includes(q) ||
        p.modules.some((m) => m.name.toLowerCase().includes(q)),
    );
  }, [projects, sidebarSearch]);

  const updateProject = (projectId: string, updater: (prev: Project) => Project) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? updater(p) : p)));
  };

  const handleSelectProjectTab = (projectId: string) => {
    setActiveProjectId(projectId);
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      next.add(projectId);
      return next;
    });
  };

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // --- Project CRUD ---
  const handleSaveProject = (data: {
    name: string;
    description: string;
    location: string;
    priority: Priority;
    color: string;
    tags: string[];
    initialModuleName?: string;
  }) => {
    if (editingProject) {
      updateProject(editingProject.id, (prev) => ({
        ...prev,
        name: data.name,
        description: data.description,
        location: data.location,
        priority: data.priority,
        color: data.color,
        tags: data.tags,
        updatedAt: new Date().toISOString(),
      }));
      setProjectModalOpen(false);
      setEditingProject(null);
      return;
    }

    const now = new Date().toISOString();
    const todayKey = now.slice(0, 10);
    const todayLabel = new Date(now).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
    });

    const projectId = `proj-${Date.now()}`;
    const mainBranchId = `br-${Date.now()}-main`;
    const initialNote = data.initialModuleName
      ? `• ${data.initialModuleName}\n  ◦ Objetivo inicial del módulo\n    ▪ Criterios de aceptación`
      : '';
    const initialModules: ProjectModule[] = data.initialModuleName
      ? [
          {
            id: `mod-${Date.now()}`,
            name: data.initialModuleName,
            description: 'Módulo inicial creado con el proyecto.',
            deadline: '2026-12-20',
            progress: computeProgressFromBloc(initialNote),
            status: 'en_progreso',
            branchId: mainBranchId,
            currentNote: initialNote,
            meetingNote: initialNote,
            ideaNote: initialNote,
            updatedAt: now,
          },
        ]
      : [];

    const initialPct = computeProjectProgress(initialModules);

    const newProject: Project = {
      id: projectId,
      name: data.name,
      description: data.description,
      color: data.color,
      location: data.location,
      priority: data.priority,
      tags: data.tags,
      modules: initialModules,
      progressHistory: [{ date: todayKey, label: todayLabel, progress: initialPct }],
      branches: [
        {
          id: mainBranchId,
          name: 'main',
          color: data.color,
          parentBranchId: null,
          headCommitId: null,
          createdAt: now,
          isMerged: false,
        },
      ],
      activeBranchId: mainBranchId,
      commits: [],
      createdAt: now,
      updatedAt: now,
    };

    const withInitCommit =
      initialModules.length > 0
        ? commitProjectChange(newProject, {
            moduleId: initialModules[0].id,
            moduleName: initialModules[0].name,
            message: `Inicialización de ${data.name}`,
            mode: 'manual',
            beforeText: '',
            afterText: initialModules[0].currentNote,
            timestamp: now,
          }).project
        : newProject;

    setProjects((prev) => [withInitCommit, ...prev]);
    setActiveProjectId(withInitCommit.id);
    setExpandedProjectIds((prev) => new Set(prev).add(withInitCommit.id));
    setSelectedModuleId(initialModules[0]?.id ?? null);
    setProjectModalOpen(false);
    setEditingProject(null);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== projectId);
      if (activeProjectId === projectId) {
        setActiveProjectId(next[0]?.id ?? '');
      }
      return next;
    });
  };

  // --- Module CRUD ---
  const handleSaveModule = (data: {
    name: string;
    description: string;
    deadline: string;
    progress: number;
    status: ModuleStatus;
    branchId: string;
  }) => {
    if (!activeProject) return;
    const now = new Date().toISOString();

    if (editingModule) {
      updateProject(activeProject.id, (prev) => {
        const updatedModules = prev.modules.map((m) =>
          m.id === editingModule.id
            ? {
                ...m,
                name: data.name,
                description: data.description,
                deadline: data.deadline,
                progress: data.progress,
                status: data.status,
                branchId: data.branchId,
                updatedAt: now,
              }
            : m,
        );
        return recalculateProjectWithModules(prev, updatedModules);
      });
    } else {
      const baseNote = `• ${data.name}\n  ◦ ${data.description}`;
      const autoProgress = computeProgressFromBloc(baseNote);
      const created: ProjectModule = {
        id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: data.name,
        description: data.description,
        deadline: data.deadline,
        progress: data.progress ?? autoProgress,
        status: data.status,
        branchId: data.branchId || activeProject.activeBranchId,
        currentNote: baseNote,
        meetingNote: baseNote,
        ideaNote: baseNote,
        updatedAt: now,
      };
      updateProject(activeProject.id, (prev) => {
        const withMod = recalculateProjectWithModules(prev, [...prev.modules, created]);
        return commitProjectChange(withMod, {
          moduleId: created.id,
          moduleName: created.name,
          message: `Crear módulo: ${created.name}`,
          mode: 'manual',
          beforeText: '',
          afterText: baseNote,
          branchId: created.branchId,
          timestamp: now,
        }).project;
      });
      setSelectedModuleId(created.id);
    }

    setModuleModalOpen(false);
    setEditingModule(null);
  };

  const handleDeleteModule = (moduleId: string) => {
    if (!activeProject) return;
    updateProject(activeProject.id, (prev) =>
      moveModuleToTrash(prev, moduleId, 'eliminado'),
    );
  };

  const handleCompleteModule = (moduleId: string) => {
    if (!activeProject) return;
    updateProject(activeProject.id, (prev) =>
      moveModuleToTrash(prev, moduleId, 'completado'),
    );
  };

  const handleRestoreModule = (trashId: string) => {
    if (!activeProject) return;
    updateProject(activeProject.id, (prev) => restoreModuleFromTrash(prev, trashId));
  };

  const handlePurgeModule = (trashId: string) => {
    if (!activeProject) return;
    updateProject(activeProject.id, (prev) => deleteTrashedModule(prev, trashId));
  };

  // --- Notebook, Bloc-Based Progress & Diff Handlers ---
  const handleUpdateModuleNotes = (
    moduleId: string,
    patch: Partial<Pick<ProjectModule, 'currentNote' | 'meetingNote' | 'ideaNote'>>,
  ) => {
    if (!activeProject) return;
    updateProject(activeProject.id, (prev) => {
      const updatedModules = prev.modules.map((m) => {
        if (m.id !== moduleId) return m;
        const nextCurrent = patch.currentNote ?? m.currentNote;
        // When currentNote changes, recalculate module progress inversely from bloc items
        const nextProgress =
          patch.currentNote !== undefined
            ? computeProgressFromBloc(nextCurrent)
            : m.progress;
        const nextStatus =
          patch.currentNote !== undefined
            ? deriveStatusFromProgress(nextProgress, m.status)
            : m.status;

        return {
          ...m,
          ...patch,
          progress: nextProgress,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        };
      });

      if (patch.currentNote !== undefined) {
        return recalculateProjectWithModules(prev, updatedModules);
      }
      return {
        ...prev,
        modules: updatedModules,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleSetModuleProgress = (moduleId: string, progress: number) => {
    if (!activeProject) return;
    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
    updateProject(activeProject.id, (prev) => {
      const updatedModules = prev.modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              progress: clamped,
              status: deriveStatusFromProgress(clamped, m.status),
              updatedAt: new Date().toISOString(),
            }
          : m,
      );
      return recalculateProjectWithModules(prev, updatedModules);
    });
  };

  const handleAssignModuleBranch = (moduleId: string, branchId: string) => {
    if (!activeProject) return;
    updateProject(activeProject.id, (prev) => ({
      ...prev,
      modules: prev.modules.map((m) =>
        m.id === moduleId ? { ...m, branchId } : m,
      ),
    }));
  };

  const handleApplySelectiveChanges = (params: {
    moduleId: string;
    mode: 'reunion' | 'idea';
    beforeText: string;
    afterText: string;
    commitMessage: string;
  }) => {
    if (!activeProject) return;
    const mod = activeProject.modules.find((m) => m.id === params.moduleId);
    if (!mod) return;

    updateProject(activeProject.id, (prev) => {
      const nextProgress = computeProgressFromBloc(params.afterText);
      const updatedModules = prev.modules.map((m) =>
        m.id === params.moduleId
          ? {
              ...m,
              currentNote: params.afterText,
              progress: nextProgress,
              status: deriveStatusFromProgress(nextProgress, m.status),
              updatedAt: new Date().toISOString(),
            }
          : m,
      );
      const updatedProj = recalculateProjectWithModules(prev, updatedModules);
      return commitProjectChange(updatedProj, {
        moduleId: mod.id,
        moduleName: mod.name,
        message: params.commitMessage,
        mode: params.mode,
        beforeText: params.beforeText,
        afterText: params.afterText,
        branchId: mod.branchId ?? prev.activeBranchId,
      }).project;
    });
  };

  /**
   * Envía las notas seleccionadas de una reunión a otro módulo existente.
   * Devuelve cuántas líneas nuevas se añadieron (0 si ya existían).
   */
  const handleSendNotesToModule = (params: {
    sourceModuleId: string;
    targetModuleId: string;
    mode: 'reunion' | 'idea';
    lines: string[];
    commitMessage: string;
  }): number => {
    if (!activeProject) return 0;
    const target = activeProject.modules.find(
      (m) => m.id === params.targetModuleId,
    );
    if (!target) return 0;

    const seen = new Set(
      target.currentNote.split('\n').map((line) => line.trim()),
    );
    const incoming: string[] = [];
    for (const rawLine of params.lines) {
      // Se conserva la sangría (sub-viñetas), solo se recorta el final.
      const line = rawLine.replace(/\s+$/, '');
      const key = line.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      incoming.push(line);
    }
    if (incoming.length === 0) return 0;

    const addition = incoming.join('\n');
    const afterText = target.currentNote.trim()
      ? `${target.currentNote.trimEnd()}\n${addition}`
      : addition;
    const nextProgress = computeProgressFromBloc(afterText);

    updateProject(activeProject.id, (prev) => {
      const updatedModules = prev.modules.map((m) =>
        m.id === target.id
          ? {
              ...m,
              currentNote: afterText,
              progress: nextProgress,
              status: deriveStatusFromProgress(nextProgress, m.status),
              updatedAt: new Date().toISOString(),
            }
          : m,
      );
      const updatedProj = recalculateProjectWithModules(prev, updatedModules);
      return commitProjectChange(updatedProj, {
        moduleId: target.id,
        moduleName: target.name,
        message: params.commitMessage,
        mode: params.mode,
        beforeText: target.currentNote,
        afterText,
        branchId: target.branchId ?? prev.activeBranchId,
      }).project;
    });

    return incoming.length;
  };

  /**
   * Crea un módulo nuevo con las notas seleccionadas en la reunión.
   * Devuelve el módulo creado (o null si faltan datos).
   */
  const handleCreateModuleFromNotes = (params: {
    sourceModuleId: string;
    name: string;
    mode: 'reunion' | 'idea';
    lines: string[];
    commitMessage: string;
  }): ProjectModule | null => {
    if (!activeProject) return null;
    const name = params.name.trim();
    const note = params.lines
      .map((line) => line.replace(/\s+$/, ''))
      .filter((line) => line.trim().length > 0)
      .join('\n');
    if (!name || !note) return null;

    const now = new Date().toISOString();
    const deadlineDate = new Date(now);
    deadlineDate.setDate(deadlineDate.getDate() + 30);

    const source = activeProject.modules.find(
      (m) => m.id === params.sourceModuleId,
    );
    const branchId = source?.branchId ?? activeProject.activeBranchId;
    const created: ProjectModule = {
      id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      description: 'Módulo creado desde Modo Reunión con notas seleccionadas.',
      deadline: deadlineDate.toISOString().slice(0, 10),
      progress: computeProgressFromBloc(note),
      status: 'en_progreso',
      branchId,
      currentNote: note,
      meetingNote: note,
      ideaNote: '',
      updatedAt: now,
    };

    updateProject(activeProject.id, (prev) => {
      const withModule = recalculateProjectWithModules(prev, [
        ...prev.modules,
        created,
      ]);
      return commitProjectChange(withModule, {
        moduleId: created.id,
        moduleName: created.name,
        message: params.commitMessage,
        mode: params.mode,
        beforeText: '',
        afterText: note,
        branchId,
      }).project;
    });

    return created;
  };

  const handleCommitManualSnapshot = (params: {
    moduleId: string;
    beforeText: string;
    afterText: string;
    commitMessage: string;
  }) => {
    if (!activeProject) return;
    const mod = activeProject.modules.find((m) => m.id === params.moduleId);
    if (!mod) return;

    updateProject(activeProject.id, (prev) =>
      commitProjectChange(prev, {
        moduleId: mod.id,
        moduleName: mod.name,
        message: params.commitMessage,
        mode: 'manual',
        beforeText: params.beforeText,
        afterText: params.afterText,
        branchId: mod.branchId ?? prev.activeBranchId,
      }).project,
    );
  };

  // --- Git Branch Handlers ---
  const handleCreateBranch = (
    branchName: string,
    parentBranchId: string,
    color?: string,
  ): string | null => {
    if (!activeProject) return null;
    const res = createBranchInProject(activeProject, branchName, parentBranchId, color);
    updateProject(activeProject.id, () => res.project);
    return res.newBranch.id;
  };

  const handleUpdateBranch = (
    branchId: string,
    updates: { name?: string; color?: string },
  ) => {
    if (!activeProject) return;
    updateProject(activeProject.id, (prev) =>
      updateBranchInProject(prev, branchId, updates),
    );
  };

  const handleDeleteBranch = (branchId: string) => {
    if (!activeProject) return;
    updateProject(activeProject.id, (prev) =>
      deleteBranchInProject(prev, branchId),
    );
  };

  const handleSwitchBranch = (branchId: string) => {
    if (!activeProject) return;
    updateProject(activeProject.id, (prev) => ({
      ...prev,
      activeBranchId: branchId,
    }));
  };

  const handleRecordBranchChange = (params: {
    branchId: string;
    moduleId: string | null;
    message: string;
    changeDetails: string;
  }) => {
    if (!activeProject) return;
    const mod = params.moduleId
      ? activeProject.modules.find((m) => m.id === params.moduleId)
      : undefined;
    const branch = activeProject.branches.find((b) => b.id === params.branchId);
    const previousBranchCommit = activeProject.commits.find(
      (c) => c.id === branch?.headCommitId,
    );

    updateProject(activeProject.id, (prev) =>
      commitProjectChange(prev, {
        moduleId: mod?.id ?? null,
        moduleName: mod?.name ?? 'General del proyecto',
        message: params.message,
        mode: 'manual',
        beforeText: previousBranchCommit?.afterText ?? '',
        afterText: params.changeDetails,
        branchId: params.branchId,
      }).project,
    );
  };

  const handleMergeBranch = (
    sourceBranchId: string,
    targetBranchId: string,
    message?: string,
  ) => {
    if (!activeProject) return;
    updateProject(
      activeProject.id,
      (prev) => mergeBranchInProject(prev, sourceBranchId, targetBranchId, message).project,
    );
  };

  const navItems: Array<{ id: WorkspaceSection; label: string }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'notebook', label: 'Bloc y Comparador' },
    { id: 'branches', label: 'Ramas Git' },
    { id: 'settings', label: 'Configuración' },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-start justify-between border-b border-zinc-200 px-4 py-3.5">
        <div className="min-w-0">
          <div className="font-display text-base font-bold leading-tight tracking-tight text-zinc-900">
            BitCode
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium leading-none text-zinc-500">
            <span>by Urteaga Enterprise</span>
            <svg
              viewBox="0 0 11 8"
              className="h-3 w-4 shrink-0"
              role="img"
              aria-label="Alienígena pixelado"
              shapeRendering="crispEdges"
            >
              {/* Canonical 11x8 Space Invader (👾) silhouette in dark gray */}
              <path
                fill="#3F3F46"
                d="M2 0h1v1H2V0zm6 0h1v1H8V0zM3 1h1v1H3V1zm4 0h1v1H7V1zM2 2h7v1H2V2zM1 3h2v1H1V3zm3 0h3v1H4V3zm4 0h2v1H8V3zM0 4h11v1H0V4zM0 5h1v1H0V5zm2 0h7v1H2V5zm8 0h1v1h-1V5zM0 6h1v1H0V6zm2 0h1v1H2V6zm6 0h1v1H8V6zm2 0h1v1h-1V6zM3 7h2v1H3V7zm3 0h2v1H6V7z"
              />
            </svg>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Cerrar menú lateral"
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-zinc-200 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            aria-label="Filtrar proyectos o módulos"
            placeholder="Filtrar proyectos o módulos..."
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-2.5 text-xs text-zinc-900 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-semibold text-zinc-500">
            Proyectos ({filteredSidebarProjects.length})
          </span>
        </div>

        {/* Projects divided into expandable tabs with circular progress indicator on the left & modules list inside */}
        <ul className="space-y-1.5">
          {filteredSidebarProjects.map((proj) => {
            const isActive = activeProject?.id === proj.id;
            const isExpanded = expandedProjectIds.has(proj.id);
            const pct = computeProjectProgress(proj.modules);

            return (
              <li
                key={proj.id}
                className={`rounded-md border transition-colors ${
                  isActive
                    ? 'border-zinc-200 bg-zinc-50/90'
                    : 'border-transparent hover:border-zinc-200/80 hover:bg-zinc-50/50'
                }`}
              >
                <div className="group relative flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    onClick={() => handleSelectProjectTab(proj.id)}
                    aria-expanded={isExpanded}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-left"
                  >
                    {/* Left Circular Progress Indicator */}
                    <ProgressCircle
                      progress={pct}
                      color={proj.color}
                      size={34}
                      strokeWidth={3}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-zinc-900">
                        {proj.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                        <span>{proj.modules.length} mód.</span>
                        <span aria-hidden="true">·</span>
                        <span>{PRIORITY_LABELS[proj.priority]}</span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleProjectExpand(proj.id)}
                    aria-label={
                      isExpanded
                        ? `Contraer módulos de ${proj.name}`
                        : `Mostrar módulos de ${proj.name}`
                    }
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {projects.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(proj.id)}
                      aria-label={`Eliminar proyecto ${proj.name}`}
                      className="rounded p-1 text-zinc-400 opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 focus:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Expandable Modules Tabs inside each Project */}
                {isExpanded && (
                  <div className="border-t border-zinc-200/70 px-2 py-1.5">
                    {proj.modules.length === 0 ? (
                      <p className="px-2 py-1 text-[11px] text-zinc-400">Sin módulos</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {proj.modules.map((mod) => {
                          const isSelectedMod =
                            isActive && selectedModuleId === mod.id;
                          return (
                            <li key={mod.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveProjectId(proj.id);
                                  setSelectedModuleId(mod.id);
                                  setActiveSection('notebook');
                                  setNotebookInnerTab('editor');
                                  setMobileMenuOpen(false);
                                }}
                                className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[11px] transition-colors ${
                                  isSelectedMod
                                    ? 'bg-white font-medium text-blue-700 shadow-2xs'
                                    : 'text-zinc-600 hover:bg-white/70 hover:text-zinc-900'
                                }`}
                              >
                                <span className="truncate">{mod.name}</span>
                                <span className="shrink-0 font-mono text-[10px] text-zinc-500 tabular-nums">
                                  {mod.progress}%
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-zinc-200 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Datos locales
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-medium ${
              localFileUnavailable
                ? 'text-zinc-400'
                : localFileSavedAt
                  ? 'text-emerald-600'
                  : 'text-zinc-400'
            }`}
            title={
              localFileUnavailable
                ? 'Este navegador solo permite caché local; usa Guardar copia para crear el archivo.'
                : 'Copia automática en el archivo Datos BitCode.json'
            }
          >
            <Check className="h-3 w-3" />
            {localFileUnavailable
              ? 'Solo caché'
              : localFileSavedAt
                ? `Guardado ${localFileSavedAt.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Guardando…'}
          </span>
        </div>
        <p
          className="mb-2 truncate font-mono text-[10px] text-zinc-400"
          title={LOCAL_DATA_FILE_NAME}
        >
          {LOCAL_DATA_FILE_NAME}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={handleExportData}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            title="Descargar o compartir el archivo Datos BitCode.json"
          >
            <Download className="h-3.5 w-3.5" />
            Guardar copia
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            title="Cargar un archivo Datos BitCode.json"
          >
            <Upload className="h-3.5 w-3.5" />
            Cargar copia
          </button>
        </div>

        {installPrompt && !isInstalledApp && (
          <button
            type="button"
            onClick={handleInstallApp}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Instalar en el teléfono
          </button>
        )}

        {!installPrompt && isIos && !isInstalledApp && (
          <p className="mt-2 rounded-md bg-zinc-50 px-2 py-1.5 text-[10px] leading-snug text-zinc-500">
            En iPhone: Compartir → Añadir a pantalla de inicio.
          </p>
        )}

        {dataNotice && (
          <p
            className={`mt-2 text-[10px] leading-snug ${
              dataNotice.kind === 'ok' ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {dataNotice.text}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#FAF9F6] text-zinc-900">
      {/* Desktop Sidebar */}
      <aside className="hidden w-68 shrink-0 border-r border-zinc-200 bg-white lg:block">
        {sidebarContent}
      </aside>

      {/* Mobile & Tablet Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-zinc-950/30"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] border-r border-zinc-200 bg-white">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar Contract: Zone 1 (Project Context) — Zone 2 (3 Nav Links) — Zone 3 (1 Primary CTA) */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-3.5 py-3 sm:gap-6 sm:px-5 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir lista de proyectos"
              className="rounded-md border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-50 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="truncate font-display text-sm font-semibold text-zinc-900 whitespace-nowrap">
              {activeSection === 'settings'
                ? 'Configuración'
                : activeProject
                  ? activeProject.name
                  : 'Espacio de trabajo'}
            </span>
          </div>

          <nav
            aria-label="Secciones principales"
            className="hidden items-center gap-5 md:flex lg:gap-6"
          >
            {navItems.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`border-b-2 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-blue-600 text-zinc-900'
                      : 'border-transparent text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={
                theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'
              }
              title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
              className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white p-2 text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingProject(null);
                setProjectModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 sm:px-3.5 sm:py-2 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo proyecto
            </button>
          </div>
        </header>

        {/* Mobile Secondary Section Switcher */}
        <nav
          aria-label="Navegación móvil"
          className="grid grid-cols-4 gap-1 border-b border-zinc-200 bg-white px-2 py-1.5 md:hidden"
        >
          {navItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`rounded-md px-1 py-1.5 text-center text-[10px] font-medium leading-tight ${
                  active
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Active Workspace Viewport */}
        <main className="mx-auto w-full max-w-6xl flex-1 p-3.5 sm:p-5 lg:p-6">
          {activeSection === 'dashboard' && (
            <DashboardView
              projects={projects}
              activeProject={activeProject}
              onSelectProject={(id) => handleSelectProjectTab(id)}
              onCreateProject={() => {
                setEditingProject(null);
                setProjectModalOpen(true);
              }}
              onEditProject={(proj) => {
                setEditingProject(proj);
                setProjectModalOpen(true);
              }}
              onCreateModule={() => {
                setEditingModule(null);
                setModuleModalOpen(true);
              }}
              onEditModule={(mod) => {
                setEditingModule(mod);
                setModuleModalOpen(true);
              }}
              onCompleteModule={handleCompleteModule}
              onDeleteModule={handleDeleteModule}
              onRestoreModule={handleRestoreModule}
              onPurgeModule={handlePurgeModule}
              onOpenModuleInNotebook={(moduleId) => {
                setSelectedModuleId(moduleId);
                setNotebookInnerTab('editor');
                setActiveSection('notebook');
              }}
            />
          )}

          {activeSection === 'notebook' && activeProject && (
            <NotebookComparatorView
              projects={projects}
              project={activeProject}
              selectedModuleId={selectedModuleId}
              innerTab={notebookInnerTab}
              initialHistoryCommitId={historyCommitId}
              onChangeInnerTab={(tab) => setNotebookInnerTab(tab)}
              onSelectModule={(id) => setSelectedModuleId(id)}
              onCreateModule={() => {
                setEditingModule(null);
                setModuleModalOpen(true);
              }}
              onUpdateModuleNotes={handleUpdateModuleNotes}
              onSetModuleProgress={handleSetModuleProgress}
              onAssignModuleBranch={handleAssignModuleBranch}
              onApplySelectiveChanges={handleApplySelectiveChanges}
              onSendNotesToModule={handleSendNotesToModule}
              onCreateModuleFromNotes={handleCreateModuleFromNotes}
              onCommitManualSnapshot={handleCommitManualSnapshot}
              onSwitchBranch={handleSwitchBranch}
            />
          )}

          {activeSection === 'branches' && activeProject && (
            <GitBranchesView
              project={activeProject}
              onCreateBranch={handleCreateBranch}
              onUpdateBranch={handleUpdateBranch}
              onDeleteBranch={handleDeleteBranch}
              onSwitchBranch={handleSwitchBranch}
              onRecordBranchChange={handleRecordBranchChange}
              onMergeBranch={handleMergeBranch}
              onInspectCommitDiff={(commitId) => {
                setHistoryCommitId(commitId);
                setNotebookInnerTab('history');
                setActiveSection('notebook');
              }}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsView projects={projects} onResetAll={handleResetAll} />
          )}
        </main>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Cargar copia de Datos BitCode"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImportDataFile(file);
        }}
      />

      {/* Modals */}
      <ProjectModal
        isOpen={projectModalOpen}
        editingProject={editingProject}
        onClose={() => {
          setProjectModalOpen(false);
          setEditingProject(null);
        }}
        onSave={handleSaveProject}
      />

      <ModuleModal
        isOpen={moduleModalOpen}
        editingModule={editingModule}
        projectName={activeProject?.name ?? ''}
        branches={activeProject?.branches ?? []}
        activeBranchId={activeProject?.activeBranchId ?? ''}
        onClose={() => {
          setModuleModalOpen(false);
          setEditingModule(null);
        }}
        onSave={handleSaveModule}
      />
    </div>
  );
}
