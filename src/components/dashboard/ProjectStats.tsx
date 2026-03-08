import { formatRub } from '@/lib/rates';

interface ProjectStat {
  displayName: string;
  hours: number;
  sheets: number;
  earned: number;
}

const ProjectStats = ({ stats }: { stats: ProjectStat[] }) => {
  if (stats.length === 0) return null;

  return (
    <div>
      <p className="label-industrial text-xs mb-3">По проектам (текущий месяц)</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.map((p) => (
          <div key={p.displayName} className="stat-card space-y-2">
            <p className="text-sm font-semibold text-foreground truncate">{p.displayName}</p>
            <div className="flex items-baseline gap-3 text-xs text-muted-foreground">
              <span>{p.hours} ч</span>
              <span>{p.sheets} лист.</span>
            </div>
            <p className="text-lg font-bold font-display text-primary">{formatRub(p.earned)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectStats;
