export type Priority = 'alta' | 'media' | 'baja';

export type ModuleStatus = 'pendiente' | 'en_progreso' | 'en_revision' | 'completado';

export type NoteCaptureMode = 'actual' | 'reunion' | 'idea';

export type WorkspaceSection = 'dashboard' | 'notebook' | 'branches' | 'settings';

export interface UserProfile {
  name: string;
  email: string;
  color: string;
}

export interface CurrentUser extends UserProfile {
  id: string;
  username: string;
}

export interface ProjectModule {
  id: string;
  name: string;
  description: string;
  deadline: string; // ISO YYYY-MM-DD
  progress: number; // 0 - 100
  status: ModuleStatus;
  branchId?: string;
  currentNote: string;
  meetingNote: string;
  ideaNote: string;
  updatedAt: string;
}

export type TrashReason = 'eliminado' | 'completado';

export interface TrashedModule {
  id: string;
  module: ProjectModule;
  reason: TrashReason;
  trashedAt: string; // ISO timestamp
}

export interface ProgressPoint {
  date: string; // e.g. '2026-10-01'
  label: string; // e.g. '01 Oct'
  progress: number; // 0 - 100
}

export interface GitBranchItem {
  id: string;
  name: string;
  color: string;
  parentBranchId: string | null;
  headCommitId: string | null;
  createdAt: string;
  isMerged: boolean;
  mergedIntoBranchId?: string;
}

export type ChangeOriginMode = 'reunion' | 'idea' | 'manual' | 'merge';

export interface ChangeCommit {
  id: string;
  shortHash: string;
  projectId: string;
  moduleId: string | null;
  moduleName: string;
  branchId: string;
  branchName: string;
  parentCommitIds: string[];
  timestamp: string;
  message: string;
  mode: ChangeOriginMode;
  beforeText: string;
  afterText: string;
  addedLines: number;
  removedLines: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  location: string;
  priority: Priority;
  tags: string[];
  modules: ProjectModule[];
  trash?: TrashedModule[];
  progressHistory: ProgressPoint[];
  branches: GitBranchItem[];
  activeBranchId: string;
  commits: ChangeCommit[];
  createdAt: string;
  updatedAt: string;
}
