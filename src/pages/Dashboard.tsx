import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth } from 'date-fns';
import { getEntryHours } from '@/lib/rates';
import HeroStats from '@/components/dashboard/HeroStats';
import SecondaryStats from '@/components/dashboard/SecondaryStats';
import ProjectStats from '@/components/dashboard/ProjectStats';
import ProductStats from '@/components/dashboard/ProductStats';
import EntryHistory from '@/components/dashboard/EntryHistory';

const Dashboard = () => {
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

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');

  const stats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    let todayEarned = 0, monthEarned = 0, totalEarned = 0;
    let monthHours = 0, totalHours = 0;
    let monthSheets = 0, totalSheets = 0;

    for (const e of entries) {
      const amount = Number(e.total_amount);
      const { standard, overtime } = getEntryHours(e);
      const h = standard + overtime;
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

    let monthWorkdayHours = 0, totalWorkdayHours = 0;
    for (const t of timeLogs) {
      const h = Number(t.total_hours);
      totalWorkdayHours += h;
      if (t.date >= monthStart) monthWorkdayHours += h;
    }

    const monthHourlyRate = monthWorkdayHours > 0 ? monthEarned / monthWorkdayHours : 0;

    return { todayEarned, monthEarned, totalEarned, monthHours, totalHours, monthSheets, totalSheets, monthWorkdayHours, totalWorkdayHours, monthHourlyRate };
  }, [entries, timeLogs, monthStart]);

  const projectStats = useMemo(() => {
    const map = new Map<string, { displayName: string; hours: number; sheets: number; earned: number }>();

    for (const e of entries) {
      if (e.date < monthStart) continue;
      const isSerial = e.product_quantity > 0 && (e as any).products;
      const rawName = isSerial ? 'TR' : (e.project_name || '').trim();
      const key = rawName.toLowerCase();
      if (!key) continue;

      const { standard, overtime } = getEntryHours(e);
      const h = standard + overtime;
      const sheets = Number(e.full_sheets) + Number(e.half_sheets) * 0.5;
      const amount = Number(e.total_amount);

      const existing = map.get(key);
      if (existing) {
        existing.hours += h;
        existing.sheets += sheets;
        existing.earned += amount;
      } else {
        map.set(key, { displayName: rawName, hours: h, sheets, earned: amount });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.earned - a.earned);
  }, [entries, monthStart]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8">
      <HeroStats todayEarned={stats.todayEarned} monthEarned={stats.monthEarned} totalEarned={stats.totalEarned} />
      <SecondaryStats
        monthHours={stats.monthHours} totalHours={stats.totalHours}
        monthSheets={stats.monthSheets} totalSheets={stats.totalSheets}
        monthWorkdayHours={stats.monthWorkdayHours} totalWorkdayHours={stats.totalWorkdayHours}
      />
      <ProjectStats stats={projectStats} />
      <ProductStats entries={entries as any} monthStart={monthStart} />
      <EntryHistory entries={entries} />
    </div>
  );
};

export default Dashboard;
