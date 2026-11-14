import React from 'react';

interface ProgressCircleProps {
  progress: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  progress,
  color,
  size = 36,
  strokeWidth = 3,
  showLabel = true,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`Progreso ${clamped}%`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--track)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      {showLabel && (
        <span className="absolute font-mono text-[9px] font-semibold text-zinc-800 tabular-nums">
          {clamped}
        </span>
      )}
    </div>
  );
};
