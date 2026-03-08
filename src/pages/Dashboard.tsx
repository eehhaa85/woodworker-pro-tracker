import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatRub, HOUR_TYPE_LABELS } from '@/lib/rates';
import { format, startOfMonth, startOfDay } from 'date-fns';
import { Trash2, Pencil } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
      if (e.date === today) {
        todayEarned += amount;
      }
    }

    return { todayEarned, monthEarned, totalEarned, monthHours, totalHours, monthSheets, totalSheets };
  }, [entries]);

  const statCards = [
    { label: 'Сегодня', value: formatRub(stats.todayEarned), accent: true },
    { label: 'За месяц', value: formatRub(stats.monthEarned) },
    { label: 'За всё время', value: formatRub(stats.totalEarned) },
    { label: 'Часов (мес / всего)', value: `${stats.monthHours} / ${stats.totalHours}` },
    { label: 'Листов (мес / всего)', value: `${stats.monthSheets} / ${stats.totalSheets}` },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((s, i) => (
          <div key={i} className={`stat-card ${i === 0 ? 'col-span-2 md:col-span-1' : ''}`}>
            <p className="label-industrial text-xs">{s.label}</p>
            <p className={`text-xl font-bold font-display mt-1 ${s.accent ? 'text-primary' : 'text-foreground'}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

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
                    <span className="text-sm font-medium text-foreground truncate">
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
                <p className="font-display font-bold text-primary whitespace-nowrap">{formatRub(entry.total_amount)}</p>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => deleteMutation.mutate(entry.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
