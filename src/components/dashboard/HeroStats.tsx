import { formatRub } from '@/lib/rates';

interface HeroStatsProps {
  todayEarned: number;
  monthEarned: number;
  totalEarned: number;
}

const HeroStats = ({ todayEarned, monthEarned, totalEarned }: HeroStatsProps) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="stat-card-hero text-center md:col-span-1">
      <p className="label-industrial text-xs mb-2">Сегодня</p>
      <p className="hero-number">{formatRub(todayEarned)}</p>
    </div>
    <div className="stat-card-hero text-center md:col-span-1">
      <p className="label-industrial text-xs mb-2">За месяц</p>
      <p className="hero-number">{formatRub(monthEarned)}</p>
    </div>
    <div className="stat-card-hero text-center md:col-span-1">
      <p className="label-industrial text-xs mb-2">За всё время</p>
      <p className="hero-number text-foreground" style={{ textShadow: 'none' }}>{formatRub(totalEarned)}</p>
    </div>
  </div>
);

export default HeroStats;
