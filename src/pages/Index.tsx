import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { calculateTotal, formatRub, DAY_TYPE_LABELS } from '@/lib/rates';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Trash2, Pencil, Clock } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

function calcHoursBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const diff = endMinutes - startMinutes;

  if (diff <= 0) return 0;

  const lunchDeduction = startMinutes < 12 * 60 && endMinutes > 13 * 60 ? 60 : 0;
  const net = diff - lunchDeduction;

  return net > 0 ? Math.round(net / 30) * 0.5 : 0;
}

const Index = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [projectName, setProjectName] = useState('');
  const [itemName, setItemName] = useState('');
  const [hoursStandard, setHoursStandard] = useState(0);
  const [hoursOvertime, setHoursOvertime] = useState(0);
  const [sheets, setSheets] = useState(0);
  const [productId, setProductId] = useState('');
  const [productQuantity, setProductQuantity] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dayType, setDayType] = useState<string>('work');

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const workdayHours = useMemo(() => calcHoursBetween(startTime, endTime), [startTime, endTime]);

  // Handle edit from Dashboard history
  useEffect(() => {
    const state = location.state as any;
    if (state?.editEntry) {
      const entry = state.editEntry;
      setDate(entry.date);
      setProjectName(entry.project_name || '');
      setItemName(entry.item_name || '');
      if (entry.hour_type === 'overtime') {
        setHoursStandard(0);
        setHoursOvertime(Number(entry.hours));
      } else {
        setHoursStandard(Number(entry.hours));
        setHoursOvertime(Number(entry.hours_overtime || 0));
      }
      setSheets(Number(entry.full_sheets) + Number(entry.half_sheets) * 0.5);
      setProductId(entry.product_id || '');
      setProductQuantity(entry.product_quantity || 0);
      setEditingId(entry.id);
      // Clear state
      navigate('/', { replace: true, state: {} });
    }
  }, [location.state]);

  const { data: timeLog } = useQuery({
    queryKey: ['daily_time_logs', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_time_logs')
        .select('*')
        .eq('date', date)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setStartTime(data.start_time?.slice(0, 5) || '');
        setEndTime(data.end_time?.slice(0, 5) || '');
        setDayType((data as any).day_type || 'work');
      } else {
        setStartTime('');
        setEndTime('');
        setDayType('work');
      }
      return data;
    },
  });

  const saveTimeMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        user_id: user!.id,
        date,
        start_time: startTime || '00:00',
        end_time: endTime || '00:00',
        total_hours: calcHoursBetween(startTime, endTime),
        day_type: dayType,
      };
      if (timeLog?.id) {
        const { error } = await supabase.from('daily_time_logs').update(payload).eq('id', timeLog.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('daily_time_logs').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily_time_logs'] });
      toast.success(dayType === 'work' ? 'Рабочее время сохранено' : DAY_TYPE_LABELS[dayType] + ' отмечен');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: todayEntries = [] } = useQuery({
    queryKey: ['work_entries', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_entries')
        .select('*, products(name, price)')
        .eq('date', date)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // All unique project names for autocomplete
  const { data: allProjectNames = [] } = useQuery({
    queryKey: ['project_names'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_entries')
        .select('project_name')
        .neq('project_name', '');
      if (error) throw error;
      const unique = [...new Set(data.map((d: any) => d.project_name).filter(Boolean))];
      return unique.sort();
    },
    staleTime: 60000,
  });

  const selectedProduct = products.find(p => p.id === productId);
  const productPrice = selectedProduct?.price || 0;
  const fullSheets = Math.floor(sheets);
  const halfSheets = sheets % 1 >= 0.5 ? 1 : 0;

  const liveTotal = useMemo(() => {
    return calculateTotal(hoursStandard, hoursOvertime, fullSheets, halfSheets, productPrice, productQuantity, settings);
  }, [hoursStandard, hoursOvertime, fullSheets, halfSheets, productPrice, productQuantity, settings]);

  const todayTotal = useMemo(() => {
    return todayEntries.reduce((sum, e) => sum + Number(e.total_amount), 0);
  }, [todayEntries]);

  const resetForm = () => {
    setProjectName('');
    setItemName('');
    setHoursStandard(0);
    setHoursOvertime(0);
    setSheets(0);
    setProductId('');
    setProductQuantity(0);
    setEditingId(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const total = calculateTotal(hoursStandard, hoursOvertime, fullSheets, halfSheets, productPrice, productQuantity, settings);
      const entry: any = {
        user_id: user!.id,
        date,
        project_name: projectName,
        item_name: itemName,
        hours: hoursStandard,
        hours_overtime: hoursOvertime,
        hour_type: 'standard',
        full_sheets: fullSheets,
        half_sheets: halfSheets,
        product_id: productId || null,
        product_quantity: productQuantity,
        total_amount: total,
      };

      if (editingId) {
        const { error } = await supabase.from('work_entries').update(entry).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('work_entries').insert(entry);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work_entries'] });
      toast.success(editingId ? 'Запись обновлена' : 'Запись добавлена');
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
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
    onError: (e: any) => toast.error(e.message),
  });

  const handleEdit = (entry: any) => {
    setProjectName(entry.project_name);
    setItemName(entry.item_name);
    if (entry.hour_type === 'overtime') {
      setHoursStandard(0);
      setHoursOvertime(Number(entry.hours));
    } else {
      setHoursStandard(Number(entry.hours));
      setHoursOvertime(Number(entry.hours_overtime || 0));
    }
    setSheets(entry.full_sheets + entry.half_sheets * 0.5);
    setProductId(entry.product_id || '');
    setProductQuantity(entry.product_quantity);
    setEditingId(entry.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isSickOrVacation = dayType === 'sick' || dayType === 'vacation';

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      {/* Hero total card */}
      <div className="stat-card-hero text-center">
        <p className="label-industrial text-xs mb-2">Сумма текущей записи</p>
        <p className="hero-number">{formatRub(liveTotal)}</p>
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-sm text-muted-foreground">
            Итого за <span className="font-display text-foreground">{date}</span>
          </p>
          <p className="text-xl font-bold font-display text-foreground mt-0.5">{formatRub(todayTotal)}</p>
        </div>
      </div>

      {/* Date */}
      <div>
        <label className="label-industrial block mb-1.5">Дата</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-industrial w-full" />
      </div>

      {/* Workday time block */}
      <div className="stat-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-secondary" />
            <p className="label-industrial text-xs">Рабочий день</p>
          </div>
          <select
            value={dayType}
            onChange={e => setDayType(e.target.value)}
            className="input-industrial text-xs px-2 py-1 w-auto"
          >
            {Object.entries(DAY_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {isSickOrVacation ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              {dayType === 'sick' ? '🏥 Больничный день' : '🌴 Отпуск'}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => saveTimeMutation.mutate()}
              disabled={saveTimeMutation.isPending}
              className="mt-3 rounded-xl"
            >
              Отметить {DAY_TYPE_LABELS[dayType].toLowerCase()}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Начало</label>
              <input type="time" step="600" value={startTime} onChange={e => setStartTime(e.target.value)} className="input-industrial w-full" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Конец</label>
              <input type="time" step="600" value={endTime} onChange={e => setEndTime(e.target.value)} className="input-industrial w-full" />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              {workdayHours > 0 && <span className="text-sm font-display font-bold text-foreground">{workdayHours} ч</span>}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => saveTimeMutation.mutate()}
                disabled={!startTime || !endTime || saveTimeMutation.isPending}
                className="w-full rounded-xl"
              >
                {timeLog ? 'Обновить' : 'Сохранить'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Entry form — hidden when sick/vacation */}
      {!isSickOrVacation && (
        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          {/* Project & Item with autocomplete */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-industrial block mb-1.5">Проект</label>
              <input
                list="project-suggestions"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                className="input-industrial w-full"
                placeholder="Начните вводить..."
              />
              <datalist id="project-suggestions">
                {allProjectNames.map((name: string) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label-industrial block mb-1.5">Предмет</label>
              <input value={itemName} onChange={e => setItemName(e.target.value)} className="input-industrial w-full" />
            </div>
          </div>

          {/* Hours — standard + overtime */}
          <div className="stat-card space-y-3">
            <p className="label-industrial text-xs">Время</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Часы (норма)</label>
                <input type="number" min={0} step={0.5} value={hoursStandard || ''} onChange={e => setHoursStandard(Number(e.target.value))} className="input-industrial w-full" placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Часы (св.ур.)</label>
                <input type="number" min={0} step={0.5} value={hoursOvertime || ''} onChange={e => setHoursOvertime(Number(e.target.value))} className="input-industrial w-full" placeholder="0" />
              </div>
            </div>
          </div>

          {/* Nesting */}
          <div className="stat-card space-y-3">
            <p className="label-industrial text-xs">Нестинг</p>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Листы</label>
              <input type="number" min={0} step={0.5} value={sheets || ''} onChange={e => setSheets(Number(e.target.value))} className="input-industrial w-full" placeholder="0" />
            </div>
          </div>

          {/* Serial furniture */}
          {products.length > 0 && (
            <div className="stat-card space-y-3">
              <p className="label-industrial text-xs">Серийная мебель</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Изделие</label>
                  <select value={productId} onChange={e => setProductId(e.target.value)} className="input-industrial w-full">
                    <option value="">—</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({formatRub(p.price)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Кол-во</label>
                  <input type="number" min={0} value={productQuantity || ''} onChange={e => setProductQuantity(Number(e.target.value))} className="input-industrial w-full" placeholder="0" />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" className="flex-1 h-14 text-base font-bold rounded-xl shadow-lg shadow-primary/20" disabled={saveMutation.isPending}>
              {editingId ? 'Обновить запись' : 'Добавить работу'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm} className="h-14 rounded-xl btn-olive">
                Отмена
              </Button>
            )}
          </div>
        </form>
      )}

      {/* Today's entries */}
      {todayEntries.length > 0 && (
        <div className="space-y-2">
          <p className="label-industrial text-xs">Записи за {date}</p>
          {todayEntries.map((entry: any) => {
            const hs = entry.hour_type === 'overtime' ? 0 : Number(entry.hours);
            const ho = entry.hour_type === 'overtime' ? Number(entry.hours) : Number(entry.hours_overtime || 0);
            return (
              <div key={entry.id} className="stat-card flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {entry.project_name}{entry.item_name ? ` — ${entry.item_name}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {hs > 0 && `${hs}ч`}
                    {ho > 0 && ` ${ho}св.ур.`}
                    {entry.full_sheets > 0 && ` · ${entry.full_sheets} лист.`}
                    {entry.half_sheets > 0 && ` · ${entry.half_sheets}×½`}
                    {entry.product_quantity > 0 && entry.products && ` · ${entry.products.name} ×${entry.product_quantity}`}
                  </p>
                </div>
                <p className="font-display font-bold text-primary whitespace-nowrap text-lg">{formatRub(entry.total_amount)}</p>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => handleEdit(entry)} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteMutation.mutate(entry.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-muted/50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Index;
