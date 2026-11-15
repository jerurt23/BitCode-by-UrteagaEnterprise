import React, { useMemo, useState } from 'react';
import { Project } from '../types/workspace';
import { computeProjectProgress } from '../utils/projectHelpers';

interface ProgressLineChartProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (projectId: string) => void;
}

export const ProgressLineChart: React.FC<ProgressLineChartProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
}) => {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const toggleProjectVisibility = (projectId: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // Collect unified sorted timeline dates across all projects
  const { timelineDates, dateLabelMap } = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((proj) => {
      proj.progressHistory.forEach((pt) => {
        map.set(pt.date, pt.label);
      });
    });
    const sorted = Array.from(map.keys()).sort();
    return { timelineDates: sorted, dateLabelMap: map };
  }, [projects]);

  const width = 760;
  const height = 260;
  const padLeft = 44;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const xForIndex = (idx: number) => {
    if (timelineDates.length <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (timelineDates.length - 1)) * plotW;
  };

  const yForProgress = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, pct));
    return padTop + ((100 - clamped) / 100) * plotH;
  };

  const visibleProjects = projects.filter((p) => !hiddenIds.has(p.id));

  if (projects.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-500">
        Crea un proyecto para visualizar su línea de progreso.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3.5 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            Progreso lineal por proyecto
          </h2>
          <p className="text-xs text-zinc-500">
            Evolución porcentual acumulada a partir de los módulos registrados
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {projects.map((proj) => {
            const isHidden = hiddenIds.has(proj.id);
            const currentPct = computeProjectProgress(proj.modules);
            return (
              <button
                key={proj.id}
                type="button"
                onClick={() => toggleProjectVisibility(proj.id)}
                aria-pressed={!isHidden}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-colors whitespace-nowrap shrink-0 ${
                  isHidden
                    ? 'border-zinc-200 bg-zinc-50 text-zinc-400'
                    : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{
                    backgroundColor: isHidden ? '#D4D4D8' : proj.color,
                  }}
                />
                <span>{proj.name}</span>
                <span className="font-mono text-zinc-500 tabular-nums">{currentPct}%</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[460px]"
          role="img"
          aria-label="Gráfico lineal de progreso por proyecto"
          data-testid="progress-line-chart"
        >
          {/* Horizontal gridlines */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = yForProgress(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="var(--grid)"
                  strokeWidth={1}
                  strokeDasharray={tick === 0 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-zinc-500 font-mono text-[11px]"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* X-axis date labels & hover columns */}
          {timelineDates.map((dateKey, idx) => {
            const x = xForIndex(idx);
            const isHovered = hoveredDate === dateKey;
            return (
              <g key={dateKey}>
                {isHovered && (
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={height - padBottom}
                    stroke="var(--axis)"
                    strokeWidth={1}
                  />
                )}
                <text
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-zinc-500 font-mono text-[11px]"
                >
                  {dateLabelMap.get(dateKey) ?? dateKey}
                </text>
              </g>
            );
          })}

          {/* Series lines and data points */}
          {visibleProjects.map((proj) => {
            const pointsMap = new Map(proj.progressHistory.map((pt) => [pt.date, pt.progress]));
            const coords = timelineDates
              .map((dateKey, idx) => {
                const val = pointsMap.get(dateKey);
                if (val === undefined) return null;
                return { dateKey, idx, x: xForIndex(idx), y: yForProgress(val), val };
              })
              .filter(
                (item): item is { dateKey: string; idx: number; x: number; y: number; val: number } =>
                  item !== null,
              );

            if (coords.length === 0) return null;
            const pathD = coords
              .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
              .join(' ');
            const isActive = proj.id === activeProjectId;

            return (
              <g key={proj.id}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={proj.color}
                  strokeWidth={isActive ? 2.75 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={isActive ? 1 : 0.8}
                />
                {coords.map((c) => (
                  <g
                    key={`${proj.id}-${c.dateKey}`}
                    onMouseEnter={() => setHoveredDate(c.dateKey)}
                    onMouseLeave={() => setHoveredDate(null)}
                    onClick={() => onSelectProject(proj.id)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={hoveredDate === c.dateKey ? 5.5 : 4}
                      fill="var(--point-fill)"
                      stroke={proj.color}
                      strokeWidth={2.25}
                    />
                  </g>
                ))}
              </g>
            );
          })}
        </svg>

        {/* Clean inline readout when hovering a date */}
        <div className="mt-2 flex min-h-6 flex-wrap items-center gap-x-5 gap-y-1 border-t border-zinc-100 pt-2 text-xs text-zinc-600">
          {hoveredDate ? (
            <>
              <span className="font-mono font-medium text-zinc-900">
                {dateLabelMap.get(hoveredDate) ?? hoveredDate}:
              </span>
              {visibleProjects.map((proj) => {
                const match = proj.progressHistory.find((p) => p.date === hoveredDate);
                return (
                  <span key={proj.id} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: proj.color }}
                    />
                    <span>{proj.name}:</span>
                    <strong className="font-mono text-zinc-900 tabular-nums">
                      {match ? `${match.progress}%` : '—'}
                    </strong>
                  </span>
                );
              })}
            </>
          ) : (
            <span className="hidden text-zinc-500 sm:inline">
              Pasa el cursor sobre un punto de la gráfica para inspeccionar el porcentaje por fecha o haz clic para seleccionar el proyecto.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
