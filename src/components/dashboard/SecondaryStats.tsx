import { TrendingUp, Layers, Clock, Banknote } from 'lucide-react';
import { formatRub } from '@/lib/rates';

interface SecondaryStatsProps {
  monthHours: number;
  totalHours: number;
  monthSheets: number;
  totalSheets: number;
  monthWorkdayHours: number;
  totalWorkdayHours: number;
  monthHourlyRate: number;
}

const SecondaryStats = ({ monthHours, totalHours, monthSheets, totalSheets, monthWorkdayHours, totalWorkdayHours, monthHourlyRate }: SecondaryStatsProps) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <div className="stat-card text-center">
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <TrendingUp size={12} className="text-secondary" />
        <p className="label-industrial text-[10px]">Часы</p>
      </div>
      <p className="text-lg font-bold font-display text-foreground">{monthHours} <span className="text-muted-foreground text-sm">/ {totalHours}</span></p>
    </div>
    <div className="stat-card text-center">
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <Layers size={12} className="text-secondary" />
        <p className="label-industrial text-[10px]">Листы</p>
      </div>
      <p className="text-lg font-bold font-display text-foreground">{monthSheets} <span className="text-muted-foreground text-sm">/ {totalSheets}</span></p>
    </div>
    <div className="stat-card text-center">
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <Clock size={12} className="text-secondary" />
        <p className="label-industrial text-[10px]">Раб. день</p>
      </div>
      <p className="text-lg font-bold font-display text-foreground">{monthWorkdayHours} <span className="text-muted-foreground text-sm">/ {totalWorkdayHours} ч</span></p>
    </div>
    <div className="stat-card text-center">
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <Banknote size={12} className="text-secondary" />
        <p className="label-industrial text-[10px]">₽ в час</p>
      </div>
      <p className="text-lg font-bold font-display text-primary">{formatRub(monthHourlyRate)}<span className="text-muted-foreground text-sm"> / ч</span></p>
    </div>
  </div>
);

export default SecondaryStats;
