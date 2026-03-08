import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { formatRub } from '@/lib/rates';
import { format, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { generateTimesheetPDF } from '@/lib/generateReport';

const Report = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
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

  // Build daily rows
  const dailyData = useMemo(() => {
    const daysInMonth = getDaysInMonth(new Date(monthStart));
    const days: Array<{
      day: number;
      date: string;
      startTime: string;
      endTime: string;
      hours: number;
      nesting: number;
      tariffHours: number;
      description: string;
    }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      const timeLog = timeLogs.find((t: any) => t.date === dateStr);
      const dayEntries = entries.filter((e: any) => e.date === dateStr);

      let totalHours = timeLog ? Number(timeLog.total_hours) : 0;
      let totalNesting = 0;
      let totalTariff = 0;
      const descriptions: string[] = [];

      for (const e of dayEntries) {
        const sheets = Number(e.full_sheets) + Number(e.half_sheets) * 0.5;
        totalNesting += sheets;
        totalTariff += Number(e.hours);

        let desc = e.project_name || '';
        if (e.item_name) desc += ` ${e.item_name}`;
        if (sheets > 0) desc += ` ${sheets}л.`;
        if (Number(e.hours) > 0) desc += ` ${e.hours}ч.`;
        if (e.product_quantity > 0 && (e as any).products) {
          desc += ` ${(e as any).products.name}—${formatRub((e as any).products.price)}`;
        }
        descriptions.push(desc.trim());
      }

      days.push({
        day: d,
        date: dateStr,
        startTime: timeLog ? (timeLog.start_time as string).slice(0, 5) : '',
        endTime: timeLog ? (timeLog.end_time as string).slice(0, 5) : '',
        hours: totalHours,
        nesting: totalNesting,
        tariffHours: totalTariff,
        description: descriptions.join('. '),
      });
    }

    return days;
  }, [entries, timeLogs, month, monthStart]);

  // Project summary
  const projectSummary = useMemo(() => {
    const map = new Map<string, { hours: number; nesting: number; serial: number }>();

    for (const e of entries) {
      const key = (e.project_name || 'Без проекта').trim();
      const existing = map.get(key) || { hours: 0, nesting: 0, serial: 0 };
      existing.hours += Number(e.hours);
      existing.nesting += Number(e.full_sheets) + Number(e.half_sheets) * 0.5;
      if (e.product_quantity > 0 && (e as any).products) {
        existing.serial += (e as any).products.price * e.product_quantity;
      }
      map.set(key, existing);
    }

    return Array.from(map.entries()).map(([name, data]) => ({ name, ...data }));
  }, [entries]);

  // Totals
  const totals = useMemo(() => {
    let totalWorkHours = 0;
    let totalTariffStandard = 0;
    let totalTariffOvertime = 0;
    let totalTariffSick = 0;
    let totalNesting = 0;
    let totalSerial = 0;

    for (const t of timeLogs) {
      totalWorkHours += Number(t.total_hours);
    }

    for (const e of entries) {
      const h = Number(e.hours);
      if (e.hour_type === 'overtime') totalTariffOvertime += h;
      else if (e.hour_type === 'sick_leave') totalTariffSick += h;
      else totalTariffStandard += h;

      totalNesting += Number(e.full_sheets) + Number(e.half_sheets) * 0.5;

      if (e.product_quantity > 0 && (e as any).products) {
        totalSerial += (e as any).products.price * e.product_quantity;
      }
    }

    return {
      totalWorkHours,
      totalTariffStandard,
      totalTariffOvertime,
      totalTariffSick,
      totalNesting,
      totalSerial,
    };
  }, [entries, timeLogs]);

  const monthLabel = format(new Date(monthStart), 'LLLL yyyy', { locale: ru });
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      await generateTimesheetPDF({
        monthLabel: monthLabelCapitalized,
        userName: user?.email?.split('@')[0] || 'Сотрудник',
        dailyData,
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
          <p className="text-xs text-muted-foreground">Ежемесячный отчёт для бухгалтерии</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input-industrial"
          />
          <Button onClick={handleDownload} className="h-12 rounded-xl font-bold gap-2">
            <FileDown size={18} />
            Скачать PDF
          </Button>
        </div>
      </div>

      {/* Preview table */}
      <div className="stat-card overflow-x-auto">
        <p className="label-industrial text-xs mb-3">Предпросмотр — {monthLabelCapitalized}</p>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-1 text-muted-foreground font-display">Дата</th>
              <th className="text-left py-2 px-1 text-muted-foreground font-display">Начало</th>
              <th className="text-left py-2 px-1 text-muted-foreground font-display">Конец</th>
              <th className="text-right py-2 px-1 text-muted-foreground font-display">Часы</th>
              <th className="text-right py-2 px-1 text-muted-foreground font-display">Нест.</th>
              <th className="text-right py-2 px-1 text-muted-foreground font-display">Тариф</th>
              <th className="text-left py-2 px-2 text-muted-foreground font-display">Описание</th>
            </tr>
          </thead>
          <tbody>
            {dailyData.map((day) => (
              <tr
                key={day.day}
                className={`border-b border-border/50 ${day.description ? '' : 'opacity-40'}`}
              >
                <td className="py-1.5 px-1 font-display">{day.day}</td>
                <td className="py-1.5 px-1">{day.startTime}</td>
                <td className="py-1.5 px-1">{day.endTime}</td>
                <td className="py-1.5 px-1 text-right font-display">{day.hours || ''}</td>
                <td className="py-1.5 px-1 text-right font-display">{day.nesting || ''}</td>
                <td className="py-1.5 px-1 text-right font-display">
                  {day.tariffHours ? `${day.tariffHours}:00` : ''}
                </td>
                <td className="py-1.5 px-2 max-w-[300px] truncate">{day.description}</td>
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

          <span className="text-muted-foreground">Часов по тарифу:</span>
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
              <span className="text-muted-foreground">Больничные/отпускные:</span>
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
              <span className="text-muted-foreground">Серийная мебель:</span>
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
