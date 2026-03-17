import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { formatRub, formatHoursHHMM, getEntryHours, abbreviate, calculateWorkdayHours } from '@/lib/rates';
import { format, endOfMonth, getDaysInMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { FileDown, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { generateTimesheetPDF } from '@/lib/generateReport';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const Report = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));

  const monthStart = `${month}-01`;
  const monthEnd = format(endOfMonth(new Date(monthStart)), 'yyyy-MM-dd');

  const { data: entries = [] } = useQuery({
    queryKey: ['work_entries', 'report', month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_entries')
        .select('*, products(name, price)')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date')
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const { data: timeLogs = [] } = useQuery({
    queryKey: ['daily_time_logs', 'report', month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_time_logs')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date');
      if (error) throw error;
      return data;
    },
  });

  // Delete workday mutation
  const deleteWorkdayMutation = useMutation({
    mutationFn: async (dateStr: string) => {
      const { error: e1 } = await supabase.from('work_entries').delete().eq('date', dateStr).eq('user_id', user!.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('daily_time_logs').delete().eq('date', dateStr).eq('user_id', user!.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work_entries'] });
      queryClient.invalidateQueries({ queryKey: ['daily_time_logs'] });
      toast.success('Рабочий день удалён');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // New month mutation
  const newMonthMutation = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase.from('work_entries').delete().gte('date', monthStart).lte('date', monthEnd).eq('user_id', user!.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('daily_time_logs').delete().gte('date', monthStart).lte('date', monthEnd).eq('user_id', user!.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work_entries'] });
      queryClient.invalidateQueries({ queryKey: ['daily_time_logs'] });
      toast.success('Месяц обнулён');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Build daily rows with grouped descriptions
  const dailyData = useMemo(() => {
    const daysInMonth = getDaysInMonth(new Date(monthStart));
    const days: Array<{
      day: number; date: string; startTime: string; endTime: string;
      hours: number; hoursStd: number; hoursOt: number; nesting: number;
      tariffHours: number; description: string; dayType: string; hasData: boolean;
    }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      const timeLog = timeLogs.find((t: any) => t.date === dateStr);
      const dayEntries = entries.filter((e: any) => e.date === dateStr);
      const dayTypeVal = (timeLog as any)?.day_type || 'work';

      const totalHours = timeLog ? Number(timeLog.total_hours) : 0;
      let totalNesting = 0;
      let totalStd = 0;
      let totalOt = 0;
      let totalTariff = 0;

      // Group entries by project (case-insensitive)
      const projectGroups = new Map<string, { displayName: string; items: string[] }>();

      for (const e of dayEntries) {
        const { standard, overtime } = getEntryHours(e);
        totalStd += standard;
        totalOt += overtime;
        totalTariff += standard + overtime;

        const sheets = Number(e.full_sheets) + Number(e.half_sheets) * 0.5;
        totalNesting += sheets;

        const isSerial = e.product_quantity > 0 && (e as any).products;
        const rawName = isSerial ? 'TR' : (e.project_name || '').trim();
        const key = rawName.toLowerCase();
        const group = projectGroups.get(key) || { displayName: rawName, items: [] };

        const parts: string[] = [];
        if (e.item_name) parts.push(abbreviate(e.item_name));
        if (standard > 0) parts.push(`${standard}ч`);
        if (overtime > 0) parts.push(`${overtime}св`);
        if (sheets > 0) parts.push(`${sheets}л`);
        if (isSerial) parts.push(`${(e as any).products.name}×${e.product_quantity}`);

        group.items.push(parts.join(' '));
        projectGroups.set(key, group);
      }

      let description = '';
      if (dayTypeVal === 'sick') {
        description = 'Больничный';
      } else if (dayTypeVal === 'vacation') {
        description = 'Отпуск';
      } else {
        const descs = Array.from(projectGroups.values()).map(g => {
          const itemsStr = g.items.filter(Boolean).join(', ');
          return itemsStr ? `${g.displayName}: ${itemsStr}` : g.displayName;
        });
        description = descs.join('. ');
      }

      const hasData = !!timeLog || dayEntries.length > 0;

      days.push({
        day: d, date: dateStr,
        startTime: timeLog ? (timeLog.start_time as string).slice(0, 5) : '',
        endTime: timeLog ? (timeLog.end_time as string).slice(0, 5) : '',
        hours: totalHours, hoursStd: totalStd, hoursOt: totalOt,
        nesting: totalNesting, tariffHours: totalTariff,
        description, dayType: dayTypeVal, hasData,
      });
    }
    return days;
  }, [entries, timeLogs, month, monthStart]);

  // Project summary
  const projectSummary = useMemo(() => {
    const map = new Map<string, { displayName: string; hours: number; nesting: number; serial: number }>();
    for (const e of entries) {
      const isSerial = e.product_quantity > 0 && (e as any).products;
      const rawName = isSerial ? 'TR' : (e.project_name || '').trim();
      if (!rawName && !isSerial) continue;
      const key = rawName.toLowerCase();
      const existing = map.get(key) || { displayName: rawName, hours: 0, nesting: 0, serial: 0 };
      const { standard, overtime } = getEntryHours(e);
      existing.hours += standard + overtime;
      existing.nesting += Number(e.full_sheets) + Number(e.half_sheets) * 0.5;
      if (isSerial) existing.serial += (e as any).products.price * e.product_quantity;
      map.set(key, existing);
    }
    return Array.from(map.values()).map(({ displayName, ...d }) => ({ name: displayName, ...d }));
  }, [entries]);

  // Totals
  const totals = useMemo(() => {
    let totalWorkHours = 0, totalTariffStandard = 0, totalTariffOvertime = 0;
    let totalTariffSick = 0, totalNesting = 0, totalSerial = 0;

    for (const t of timeLogs) {
      const dayType = (t as any).day_type || 'work';
      if (dayType === 'sick' || dayType === 'vacation') {
        totalTariffSick += 8; // 8-hour sick/vacation day
      } else {
        totalWorkHours += Number(t.total_hours);
      }
    }

    for (const e of entries) {
      const { standard, overtime, sick } = getEntryHours(e);
      totalTariffStandard += standard;
      totalTariffOvertime += overtime;
      totalTariffSick += sick;
      totalNesting += Number(e.full_sheets) + Number(e.half_sheets) * 0.5;
      if (e.product_quantity > 0 && (e as any).products) {
        totalSerial += (e as any).products.price * e.product_quantity;
      }
    }

    return { totalWorkHours, totalTariffStandard, totalTariffOvertime, totalTariffSick, totalNesting, totalSerial };
  }, [entries, timeLogs]);

  const monthLabel = format(new Date(monthStart), 'LLLL yyyy', { locale: ru });
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await generateTimesheetPDF({
        monthLabel: monthLabelCapitalized,
        userName: settings.full_name || user?.email?.split('@')[0] || 'Сотрудник',
        dailyData: dailyData.map(d => ({
          day: d.day, startTime: d.startTime, endTime: d.endTime,
          hours: d.hours, hoursStd: d.hoursStd, hoursOt: d.hoursOt,
          nesting: d.nesting, tariffHours: d.tariffHours,
          description: d.description, dayType: d.dayType,
        })),
        projectSummary,
        totals,
        settings,
      });
      toast.success('PDF сформирован');
    } catch (e: any) {
      toast.error('Ошибка: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-foreground">Табель</h2>
          <p className="text-xs text-muted-foreground">Ежемесячный отчёт</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input-industrial" />
          <Button onClick={handleDownload} disabled={generating} size="sm" className="h-10 rounded-xl font-bold gap-1.5">
            <FileDown size={16} />
            PDF
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="h-10 rounded-xl gap-1.5">
                <RotateCcw size={16} />
                Новый месяц
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Обнулить {monthLabelCapitalized}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Все записи и рабочие дни за {monthLabelCapitalized} будут удалены. Это действие нельзя отменить.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={() => newMonthMutation.mutate()}>Обнулить</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Preview table — compact */}
      <div className="stat-card overflow-x-auto">
        <p className="label-industrial text-xs mb-3">Предпросмотр — {monthLabelCapitalized}</p>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1 px-0.5 text-muted-foreground font-display w-6">Д</th>
              <th className="text-left py-1 px-0.5 text-muted-foreground font-display w-10">Нач</th>
              <th className="text-left py-1 px-0.5 text-muted-foreground font-display w-10">Кон</th>
              <th className="text-right py-1 px-0.5 text-muted-foreground font-display w-6">Ч</th>
              <th className="text-right py-1 px-0.5 text-muted-foreground font-display w-6">СУ</th>
              <th className="text-right py-1 px-0.5 text-muted-foreground font-display w-6">Н</th>
              <th className="text-right py-1 px-0.5 text-muted-foreground font-display w-10">Тариф</th>
              <th className="text-left py-1 px-1 text-muted-foreground font-display">Описание</th>
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody>
            {dailyData.map((day) => (
              <tr
                key={day.day}
                className={`border-b border-border/50 ${day.hasData ? '' : 'opacity-30'} ${day.dayType !== 'work' ? 'bg-accent/10' : ''}`}
              >
                <td className="py-1 px-0.5 font-display">{day.day}</td>
                <td className="py-1 px-0.5">{day.startTime}</td>
                <td className="py-1 px-0.5">{day.endTime}</td>
                <td className="py-1 px-0.5 text-right font-display">{day.hours || ''}</td>
                <td className="py-1 px-0.5 text-right font-display text-accent">{day.hoursOt || ''}</td>
                <td className="py-1 px-0.5 text-right font-display">{day.nesting || ''}</td>
                <td className="py-1 px-0.5 text-right font-display">{formatHoursHHMM(day.tariffHours)}</td>
                <td className="py-1 px-1 max-w-[250px] truncate">{day.description}</td>
                <td className="py-1 px-0.5">
                  {day.hasData && (
                    <button
                      onClick={() => deleteWorkdayMutation.mutate(day.date)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                      title="Удалить день"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Project summary */}
      {projectSummary.length > 0 && (
        <div className="stat-card">
          <p className="label-industrial text-xs mb-3">По проектам</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-1 text-muted-foreground font-display">Проект</th>
                <th className="text-right py-2 px-1 text-muted-foreground font-display">Часы</th>
                <th className="text-right py-2 px-1 text-muted-foreground font-display">Нестинг</th>
                <th className="text-right py-2 px-1 text-muted-foreground font-display">Серийка</th>
              </tr>
            </thead>
            <tbody>
              {projectSummary.map((p) => (
                <tr key={p.name} className="border-b border-border/50">
                  <td className="py-1.5 px-1 font-semibold">{p.name}</td>
                  <td className="py-1.5 px-1 text-right font-display">{p.hours || ''}</td>
                  <td className="py-1.5 px-1 text-right font-display">{p.nesting || ''}</td>
                  <td className="py-1.5 px-1 text-right font-display">{p.serial ? formatRub(p.serial) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="stat-card space-y-2">
        <p className="label-industrial text-xs mb-3">Итого</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground">Всего часов:</span>
          <span className="text-right font-display font-bold">{totals.totalWorkHours}</span>

          <span className="text-muted-foreground">Часов (норма):</span>
          <span className="text-right font-display font-bold">
            {totals.totalTariffStandard} × {formatRub(settings.rate_standard)} = {formatRub(totals.totalTariffStandard * settings.rate_standard)}
          </span>

          {totals.totalTariffOvertime > 0 && (
            <>
              <span className="text-muted-foreground">Сверхурочные:</span>
              <span className="text-right font-display font-bold">
                {totals.totalTariffOvertime} × {formatRub(settings.rate_overtime)} = {formatRub(totals.totalTariffOvertime * settings.rate_overtime)}
              </span>
            </>
          )}

          {totals.totalTariffSick > 0 && (
            <>
              <span className="text-muted-foreground">Больничные/отпуск:</span>
              <span className="text-right font-display font-bold">
                {totals.totalTariffSick} × {formatRub(settings.rate_sick_leave)} = {formatRub(totals.totalTariffSick * settings.rate_sick_leave)}
              </span>
            </>
          )}

          <span className="text-muted-foreground">Нестинг:</span>
          <span className="text-right font-display font-bold">
            {totals.totalNesting} × {formatRub(settings.rate_full_sheet)} = {formatRub(totals.totalNesting * settings.rate_full_sheet)}
          </span>

          {totals.totalSerial > 0 && (
            <>
              <span className="text-muted-foreground">Серийная мебель (TR):</span>
              <span className="text-right font-display font-bold">{formatRub(totals.totalSerial)}</span>
            </>
          )}

          <span className="text-foreground font-bold border-t border-border pt-2 mt-2">ИТОГО ЗП:</span>
          <span className="text-right font-display font-bold text-primary text-lg border-t border-border pt-2 mt-2">
            {formatRub(
              totals.totalTariffStandard * settings.rate_standard +
              totals.totalTariffOvertime * settings.rate_overtime +
              totals.totalTariffSick * settings.rate_sick_leave +
              totals.totalNesting * settings.rate_full_sheet +
              totals.totalSerial
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Report;
