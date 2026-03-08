import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatRub, HOUR_TYPE_LABELS } from '@/lib/rates';
import { format, startOfMonth } from 'date-fns';
import { Trash2, Clock, TrendingUp, Calendar, Layers } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const Dashboard = () => {
  const queryClient = useQueryClient();

  const { data: entries = [] } = useQuery({
    queryKey: ['work_entries', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_entries')
        .select('*, products(name, price)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: timeLogs = [] } = useQuery({
    queryKey: ['daily_time_logs', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_time_logs')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('work_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work_entries'] });
      toast.success('Запись удалена');
    },
  });

  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

    let todayEarned = 0, monthEarned = 0, totalEarned = 0;
    let monthHours = 0, totalHours = 0;
    let monthSheets = 0, totalSheets = 0;

    for (const e of entries) {
      const amount = Number(e.total_amount);
      const h = Number(e.hours);
      const sheets = Number(e.full_sheets) + Number(e.half_sheets) * 0.5;

      totalEarned += amount;
      totalHours += h;
      totalSheets += sheets;

      if (e.date >= monthStart) {
        monthEarned += amount;
        monthHours += h;
        monthSheets += sheets;
      }
      if (e.date === today) todayEarned += amount;
    }

    let monthWorkdayHours = 0, totalWorkdayHours = 0, todayWorkdayHours = 0;
    for (const t of timeLogs) {
      const h = Number(t.total_hours);
      totalWorkdayHours += h;
      if (t.date >= monthStart) monthWorkdayHours += h;
      if (t.date === today) todayWorkdayHours += h;
    }

    return { todayEarned, monthEarned, totalEarned, monthHours, totalHours, monthSheets, totalSheets, monthWorkdayHours, totalWorkdayHours, todayWorkdayHours };
  }, [entries, timeLogs]);

  const projectStats = useMemo(() => {
    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const map = new Map<string, { displayName: string; hours: number; sheets: number; earned: number }>();

    for (const e of entries) {
      if (e.date < monthStart) continue;
      const key = (e.project_name || '').trim().toLowerCase();
      if (!key) continue;

      const existing = map.get(key);
      const h = Number(e.hours);
      const sheets = Number(e.full_sheets) + Number(e.half_sheets) * 0.5;
      const amount = Number(e.total_amount);

      if (existing) {
        existing.hours += h;
        existing.sheets += sheets;
        existing.earned += amount;
      } else {
        map.set(key, { displayName: e.project_name.trim(), hours: h, sheets, earned: amount });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.earned - a.earned);
  }, [entries]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8">
      {/* Hero stats — big numbers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card-hero text-center md:col-span-1">
          <p className="label-industrial text-xs mb-2">Сегодня</p>
          <p className="hero-number">{formatRub(stats.todayEarned)}</p>
        </div>
        <div className="stat-card-hero text-center md:col-span-1">
          <p className="label-industrial text-xs mb-2">За месяц</p>
          <p className="hero-number">{formatRub(stats.monthEarned)}</p>
        </div>
        <div className="stat-card-hero text-center md:col-span-1">
          <p className="label-industrial text-xs mb-2">За всё время</p>
          <p className="hero-number text-foreground" style={{ textShadow: 'none' }}>{formatRub(stats.totalEarned)}</p>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card text-center">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <TrendingUp size={12} className="text-secondary" />
            <p className="label-industrial text-[10px]">Часы</p>
          </div>
          <p className="text-lg font-bold font-display text-foreground">{stats.monthHours} <span className="text-muted-foreground text-sm">/ {stats.totalHours}</span></p>
        </div>
        <div className="stat-card text-center">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Layers size={12} className="text-secondary" />
            <p className="label-industrial text-[10px]">Листы</p>
          </div>
          <p className="text-lg font-bold font-display text-foreground">{stats.monthSheets} <span className="text-muted-foreground text-sm">/ {stats.totalSheets}</span></p>
        </div>
        <div className="stat-card text-center">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <Clock size={12} className="text-secondary" />
            <p className="label-industrial text-[10px]">Раб. день</p>
          </div>
          <p className="text-lg font-bold font-display text-foreground">{stats.monthWorkdayHours} <span className="text-muted-foreground text-sm">/ {stats.totalWorkdayHours} ч</span></p>
        </div>
      </div>

      {/* Per-project stats */}
      {projectStats.length > 0 && (
        <div>
          <p className="label-industrial text-xs mb-3">По проектам (текущий месяц)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projectStats.map((p) => (
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
      )}

      {/* History */}
      <div>
        <p className="label-industrial text-xs mb-3">История записей</p>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">Записей пока нет</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry: any) => (
              <div key={entry.id} className="stat-card flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-display">{entry.date}</span>
                    <span className="text-sm font-semibold text-foreground truncate">
                      {entry.project_name}{entry.item_name ? ` — ${entry.item_name}` : ''}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {entry.hours > 0 && `${entry.hours}ч ${HOUR_TYPE_LABELS[entry.hour_type] || ''}`}
                    {entry.full_sheets > 0 && ` · ${entry.full_sheets} лист.`}
                    {entry.half_sheets > 0 && ` · ${entry.half_sheets}×½`}
                    {entry.product_quantity > 0 && entry.products && ` · ${entry.products.name} ×${entry.product_quantity}`}
                  </p>
                </div>
                <p className="font-display font-bold text-primary whitespace-nowrap text-lg">{formatRub(entry.total_amount)}</p>
                <button onClick={() => deleteMutation.mutate(entry.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-muted/50 shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
