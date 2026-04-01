import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { formatRub, getEntryHours } from '@/lib/rates';
import { format, startOfMonth, endOfMonth, subMonths, parse } from 'date-fns';
import { ru } from 'date-fns/locale';
import { FileDown, BarChart3, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { generateTimesheetPDF } from '@/lib/generateReport';
import { calculateWorkdayHours, abbreviate } from '@/lib/rates';
import { getDaysInMonth } from 'date-fns';

const Archive = () => {
  const { user } = useAuth();
  const { settings } = useSettings();

  // Archive: past months list
  const pastMonths = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 1; i <= 12; i++) {
      const d = subMonths(now, i);
      months.push(format(d, 'yyyy-MM'));
    }
    return months;
  }, []);

  // Period stats
  const [periodFrom, setPeriodFrom] = useState(format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
  const [periodTo, setPeriodTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: periodEntries = [] } = useQuery({
    queryKey: ['work_entries', 'period', periodFrom, periodTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_entries')
        .select('*, products(name, price)')
        .gte('date', periodFrom)
        .lte('date', periodTo)
        .order('date');
      if (error) throw error;
      return data;
    },
  });

  const { data: periodTimeLogs = [] } = useQuery({
    queryKey: ['daily_time_logs', 'period', periodFrom, periodTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_time_logs')
        .select('*')
        .gte('date', periodFrom)
        .lte('date', periodTo)
        .order('date');
      if (error) throw error;
      return data;
    },
  });

  const periodStats = useMemo(() => {
    let totalSheets = 0;
    let totalWorkHours = 0;
    let totalTariffStandard = 0;
    let totalTariffOvertime = 0;
    let totalSerial = 0;
    let totalEarned = 0;

    for (const t of periodTimeLogs) {
      totalWorkHours += Number(t.total_hours);
    }

    for (const e of periodEntries) {
      const { standard, overtime } = getEntryHours(e);
      totalTariffStandard += standard;
      totalTariffOvertime += overtime;
      totalSheets += Number(e.full_sheets) + Number(e.half_sheets) * 0.5;
      totalEarned += Number(e.total_amount);
      if (e.product_quantity > 0 && (e as any).products) {
        totalSerial += (e as any).products.price * e.product_quantity;
      }
    }

    const avgHourlyRate = totalWorkHours > 0 ? totalEarned / totalWorkHours : 0;

    return { totalSheets, totalWorkHours, totalTariffStandard, totalTariffOvertime, totalSerial, totalEarned, avgHourlyRate };
  }, [periodEntries, periodTimeLogs]);

  // Generate PDF for a past month
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGeneratePDF = async (monthStr: string) => {
    setGenerating(monthStr);
    try {
      const ms = `${monthStr}-01`;
      const me = format(endOfMonth(new Date(ms)), 'yyyy-MM-dd');

      const [entriesRes, timeLogsRes] = await Promise.all([
        supabase.from('work_entries').select('*, products(name, price)').gte('date', ms).lte('date', me).order('date').order('created_at'),
        supabase.from('daily_time_logs').select('*').gte('date', ms).lte('date', me).order('date'),
      ]);

      if (entriesRes.error) throw entriesRes.error;
      if (timeLogsRes.error) throw timeLogsRes.error;

      const entries = entriesRes.data || [];
      const timeLogs = timeLogsRes.data || [];

      // Build daily data
      const daysInMonth = getDaysInMonth(new Date(ms));
      const dailyData = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
        const timeLog = timeLogs.find((t: any) => t.date === dateStr);
        const dayEntries = entries.filter((e: any) => e.date === dateStr);
        const dayTypeVal = (timeLog as any)?.day_type || 'work';

        const totalHours = timeLog ? calculateWorkdayHours((timeLog.start_time as string).slice(0, 5), (timeLog.end_time as string).slice(0, 5)) : 0;
        let totalNesting = 0, totalStd = 0, totalOt = 0, totalTariff = 0;

        const projectGroups = new Map<string, { displayName: string; items: string[] }>();

        for (const e of dayEntries) {
          const { standard, overtime: ot } = getEntryHours(e);
          totalStd += standard;
          totalOt += ot;
          totalTariff += standard;
          const sheets = Number(e.full_sheets) + Number(e.half_sheets) * 0.5;
          totalNesting += sheets;

          const isSerial = e.product_quantity > 0 && (e as any).products;
          const rawName = isSerial ? 'TR' : (e.project_name || '').trim();
          const key = rawName.toLowerCase();
          const group = projectGroups.get(key) || { displayName: rawName, items: [] };
          const parts: string[] = [];
          if (e.item_name) parts.push(abbreviate(e.item_name));
          if (standard > 0) parts.push(`${standard}ч`);
          if (ot > 0) parts.push(`${ot}св`);
          if (sheets > 0) parts.push(`${sheets}л`);
          if (isSerial) parts.push(`${(e as any).products.name}×${e.product_quantity}`);
          group.items.push(parts.join(' '));
          projectGroups.set(key, group);
        }

        let description = '';
        if (dayTypeVal === 'sick') description = 'Больничный';
        else if (dayTypeVal === 'vacation') description = 'Отпуск';
        else {
          const descs = Array.from(projectGroups.values()).map(g => {
            const itemsStr = g.items.filter(Boolean).join(', ');
            return itemsStr ? `${g.displayName}: ${itemsStr}` : g.displayName;
          });
          description = descs.join('. ');
        }

        dailyData.push({
          day: d, startTime: timeLog ? (timeLog.start_time as string).slice(0, 5) : '',
          endTime: timeLog ? (timeLog.end_time as string).slice(0, 5) : '',
          hours: totalHours, hoursStd: totalStd, hoursOt: totalOt,
          nesting: totalNesting, tariffHours: totalTariff,
          description, dayType: dayTypeVal,
        });
      }

      // Project summary
      const projMap = new Map<string, { displayName: string; hours: number; nesting: number; serial: number }>();
      for (const e of entries) {
        const isSerial = e.product_quantity > 0 && (e as any).products;
        const rawName = isSerial ? 'TR' : (e.project_name || '').trim();
        if (!rawName && !isSerial) continue;
        const key = rawName.toLowerCase();
        const existing = projMap.get(key) || { displayName: rawName, hours: 0, nesting: 0, serial: 0 };
        const { standard, overtime: ot } = getEntryHours(e);
        existing.hours += standard + ot;
        existing.nesting += Number(e.full_sheets) + Number(e.half_sheets) * 0.5;
        if (isSerial) existing.serial += (e as any).products.price * e.product_quantity;
        projMap.set(key, existing);
      }
      const projectSummary = Array.from(projMap.values()).map(({ displayName, ...d }) => ({ name: displayName, ...d }));

      // Serial summary
      const serialMap = new Map<string, { name: string; quantity: number }>();
      for (const e of entries) {
        if (e.product_quantity > 0 && (e as any).products) {
          const prodName = (e as any).products.name;
          const existing = serialMap.get(prodName) || { name: prodName, quantity: 0 };
          existing.quantity += e.product_quantity;
          serialMap.set(prodName, existing);
        }
      }
      const serialSummary = Array.from(serialMap.values());

      // Totals
      let totalWorkHours = 0, totalTariffStandard = 0, totalTariffOvertime = 0, totalTariffSick = 0, totalNesting = 0, totalSerial = 0;
      for (const t of timeLogs) {
        const dayType = (t as any).day_type || 'work';
        if (dayType === 'sick' || dayType === 'vacation') totalTariffSick += 8;
        else totalWorkHours += Number(t.total_hours);
      }
      for (const e of entries) {
        const { standard, overtime: ot, sick } = getEntryHours(e);
        totalTariffStandard += standard;
        totalTariffOvertime += ot;
        totalTariffSick += sick;
        totalNesting += Number(e.full_sheets) + Number(e.half_sheets) * 0.5;
        if (e.product_quantity > 0 && (e as any).products) {
          totalSerial += (e as any).products.price * e.product_quantity;
        }
      }

      const monthLabel = format(new Date(ms), 'LLLL yyyy', { locale: ru });
      const cap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

      await generateTimesheetPDF({
        monthLabel: cap,
        monthStart: ms,
        userName: settings.full_name || user?.email?.split('@')[0] || 'Сотрудник',
        dailyData,
        projectSummary,
        serialSummary,
        totals: { totalWorkHours, totalTariffStandard, totalTariffOvertime, totalTariffSick, totalNesting, totalSerial },
        settings,
      });
      toast.success(`PDF за ${cap} сформирован`);
    } catch (e: any) {
      toast.error('Ошибка: ' + e.message);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-8">
      {/* Period statistics */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-primary" />
          <h2 className="text-lg font-black text-foreground">Статистика за период</h2>
        </div>

        <div className="stat-card space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="label-industrial text-xs block mb-1">С</label>
              <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="input-industrial w-full" />
            </div>
            <div className="flex-1">
              <label className="label-industrial text-xs block mb-1">По</label>
              <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="input-industrial w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Листов (нестинг)</p>
              <p className="text-xl font-black font-display">{periodStats.totalSheets}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Отработано часов</p>
              <p className="text-xl font-black font-display">{periodStats.totalWorkHours}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Часов по тарифу</p>
              <p className="text-xl font-black font-display">{periodStats.totalTariffStandard + periodStats.totalTariffOvertime}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Серийная мебель</p>
              <p className="text-xl font-black font-display">{formatRub(periodStats.totalSerial)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Среднее руб/час</p>
              <p className="text-xl font-black font-display text-primary">{formatRub(Math.round(periodStats.avgHourlyRate))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Всего заработано</p>
              <p className="text-xl font-black font-display text-primary">{formatRub(periodStats.totalEarned)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Archive months */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar size={20} className="text-primary" />
          <h2 className="text-lg font-black text-foreground">Архив табелей</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pastMonths.map((m) => {
            const label = format(new Date(`${m}-01`), 'LLLL yyyy', { locale: ru });
            const cap = label.charAt(0).toUpperCase() + label.slice(1);
            return (
              <div key={m} className="stat-card flex items-center justify-between">
                <span className="font-semibold text-sm">{cap}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-xl"
                  onClick={() => handleGeneratePDF(m)}
                  disabled={generating === m}
                >
                  <FileDown size={14} />
                  {generating === m ? '...' : 'PDF'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Archive;
