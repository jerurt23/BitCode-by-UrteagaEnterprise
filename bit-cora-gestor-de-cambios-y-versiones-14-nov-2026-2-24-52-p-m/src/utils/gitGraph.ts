import { ChangeCommit, ChangeOriginMode, GitBranchItem, Project } from '../types/workspace';
import { computeSplitDiff, countDiffStats } from './diffEngine';

export interface GraphCommitNode {
  commit: ChangeCommit;
  lane: number;
  row: number;
  color: string;
  parentCoordinates: Array<{ lane: number; row: number; color: string }>;
}

export interface BranchGraphLayout {
  nodes: GraphCommitNode[];
  laneCount: number;
  lanes: Array<{ lane: number; branchId: string; branchName: string; color: string }>;
}

const BRANCH_PALETTE = [
  '#2563EB', // Cobalt (main)
  '#0D9488', // Teal
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#DB2777', // Rose
  '#059669', // Emerald
];

export function nextBranchColor(existingCount: number): string {
  return BRANCH_PALETTE[existingCount % BRANCH_PALETTE.length];
}

export function generateShortHash(seed: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(7, '0').slice(0, 7);
}

export function createBranchInProject(
  project: Project,
  branchName: string,
  parentBranchId: string,
  customColor?: string,
): { project: Project; newBranch: GitBranchItem } {
  const cleanName = branchName.trim().replace(/\s+/g, '-');
  const parentBranch =
    project.branches.find((b) => b.id === parentBranchId) ?? project.branches[0];

  const newBranch: GitBranchItem = {
    id: `br-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    color: customColor ?? nextBranchColor(project.branches.length),
    parentBranchId: parentBranch ? parentBranch.id : null,
    headCommitId: parentBranch ? parentBranch.headCommitId : null,
    createdAt: new Date().toISOString(),
    isMerged: false,
  };

  return {
    newBranch,
    project: {
      ...project,
      branches: [...project.branches, newBranch],
      activeBranchId: newBranch.id,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function updateBranchInProject(
  project: Project,
  branchId: string,
  updates: { name?: string; color?: string },
): Project {
  const cleanName = updates.name?.trim().replace(/\s+/g, '-');
  const updatedBranches = project.branches.map((b) => {
    if (b.id !== branchId) return b;
    return {
      ...b,
      name: cleanName || b.name,
      color: updates.color ?? b.color,
    };
  });

  const updatedCommits = cleanName
    ? project.commits.map((c) =>
        c.branchId === branchId ? { ...c, branchName: cleanName } : c,
      )
    : project.commits;

  return {
    ...project,
    branches: updatedBranches,
    commits: updatedCommits,
    updatedAt: new Date().toISOString(),
  };
}

export function deleteBranchInProject(project: Project, branchId: string): Project {
  const target = project.branches.find((b) => b.id === branchId);
  if (!target || target.name === 'main' || project.branches.length <= 1) {
    return project;
  }

  const remaining = project.branches.filter((b) => b.id !== branchId);
  const nextActive =
    project.activeBranchId === branchId
      ? (remaining.find((b) => b.name === 'main')?.id ?? remaining[0].id)
      : project.activeBranchId;

  return {
    ...project,
    branches: remaining,
    activeBranchId: nextActive,
    updatedAt: new Date().toISOString(),
  };
}

export function commitProjectChange(
  project: Project,
  params: {
    moduleId: string | null;
    moduleName: string;
    message: string;
    mode: ChangeOriginMode;
    beforeText: string;
    afterText: string;
    branchId?: string;
    timestamp?: string;
  },
): { project: Project; commit: ChangeCommit } {
  const activeBranch =
    (params.branchId ? project.branches.find((b) => b.id === params.branchId) : undefined) ??
    project.branches.find((b) => b.id === project.activeBranchId) ??
    project.branches[0];

  const rows = computeSplitDiff(params.beforeText, params.afterText);
  const stats = countDiffStats(rows);
  const timestamp = params.timestamp ?? new Date().toISOString();
  const id = `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const commit: ChangeCommit = {
    id,
    shortHash: generateShortHash(`${id}-${params.message}-${timestamp}`),
    projectId: project.id,
    moduleId: params.moduleId,
    moduleName: params.moduleName,
    branchId: activeBranch.id,
    branchName: activeBranch.name,
    parentCommitIds: activeBranch.headCommitId ? [activeBranch.headCommitId] : [],
    timestamp,
    message: params.message,
    mode: params.mode,
    beforeText: params.beforeText,
    afterText: params.afterText,
    addedLines: stats.added + stats.replaced,
    removedLines: stats.removed + stats.replaced,
  };

  const updatedBranches = project.branches.map((b) =>
    b.id === activeBranch.id ? { ...b, headCommitId: commit.id } : b,
  );

  return {
    commit,
    project: {
      ...project,
      branches: updatedBranches,
      commits: [commit, ...project.commits],
      updatedAt: timestamp,
    },
  };
}

export function mergeBranchInProject(
  project: Project,
  sourceBranchId: string,
  targetBranchId: string,
  customMessage?: string,
): { project: Project; mergeCommit: ChangeCommit | null } {
  if (sourceBranchId === targetBranchId) {
    return { project, mergeCommit: null };
  }

  const sourceBranch = project.branches.find((b) => b.id === sourceBranchId);
  const targetBranch = project.branches.find((b) => b.id === targetBranchId);
  if (!sourceBranch || !targetBranch) {
    return { project, mergeCommit: null };
  }

  const sourceHead = project.commits.find((c) => c.id === sourceBranch.headCommitId);
  const targetHead = project.commits.find((c) => c.id === targetBranch.headCommitId);

  const parentCommitIds: string[] = [];
  if (targetBranch.headCommitId) parentCommitIds.push(targetBranch.headCommitId);
  if (sourceBranch.headCommitId && sourceBranch.headCommitId !== targetBranch.headCommitId) {
    parentCommitIds.push(sourceBranch.headCommitId);
  }

  const timestamp = new Date().toISOString();
  const id = `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const message =
    customMessage?.trim() || `Merge rama '${sourceBranch.name}' en '${targetBranch.name}'`;

  const beforeText = targetHead?.afterText ?? '';
  const afterText = sourceHead?.afterText ?? beforeText;
  const stats = countDiffStats(computeSplitDiff(beforeText, afterText));

  const mergeCommit: ChangeCommit = {
    id,
    shortHash: generateShortHash(`${id}-${message}`),
    projectId: project.id,
    moduleId: sourceHead?.moduleId ?? null,
    moduleName: sourceHead?.moduleName ?? 'Integración de rama',
    branchId: targetBranch.id,
    branchName: targetBranch.name,
    parentCommitIds,
    timestamp,
    message,
    mode: 'merge',
    beforeText,
    afterText,
    addedLines: stats.added + stats.replaced,
    removedLines: stats.removed + stats.replaced,
  };

  const updatedBranches = project.branches.map((b) => {
    if (b.id === targetBranch.id) {
      return { ...b, headCommitId: mergeCommit.id };
    }
    if (b.id === sourceBranch.id) {
      return { ...b, isMerged: true, mergedIntoBranchId: targetBranch.id };
    }
    return b;
  });

  return {
    mergeCommit,
    project: {
      ...project,
      branches: updatedBranches,
      activeBranchId: targetBranch.id,
      commits: [mergeCommit, ...project.commits],
      updatedAt: timestamp,
    },
  };
}

/**
 * Assigns each branch to a deterministic horizontal lane and orders commits newest-first
 * so an SVG metro-rail Git graph can render branch forks, commits, and merges cleanly.
 */
export function computeBranchGraphLayout(
  branches: GitBranchItem[],
  commits: ChangeCommit[],
): BranchGraphLayout {
  const sortedCommits = [...commits].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const branchLaneMap = new Map<string, number>();
  const lanes: BranchGraphLayout['lanes'] = [];

  branches.forEach((branch, index) => {
    branchLaneMap.set(branch.id, index);
    lanes.push({
      lane: index,
      branchId: branch.id,
      branchName: branch.name,
      color: branch.color,
    });
  });

  const commitPosMap = new Map<string, { lane: number; row: number; color: string }>();

  sortedCommits.forEach((commit, row) => {
    let lane = branchLaneMap.get(commit.branchId);
    if (lane === undefined) {
      lane = lanes.length;
      branchLaneMap.set(commit.branchId, lane);
      lanes.push({
        lane,
        branchId: commit.branchId,
        branchName: commit.branchName,
        color: nextBranchColor(lane),
      });
    }
    const color = lanes[lane]?.color ?? '#2563EB';
    commitPosMap.set(commit.id, { lane, row, color });
  });

  const nodes: GraphCommitNode[] = sortedCommits.map((commit, row) => {
    const pos = commitPosMap.get(commit.id)!;
    const parentCoordinates = commit.parentCommitIds
      .map((pid) => commitPosMap.get(pid))
      .filter((item): item is { lane: number; row: number; color: string } => Boolean(item));

    return {
      commit,
      lane: pos.lane,
      row,
      color: pos.color,
      parentCoordinates,
    };
  });

  return {
    nodes,
    laneCount: Math.max(lanes.length, 1),
    lanes,
  };
}
