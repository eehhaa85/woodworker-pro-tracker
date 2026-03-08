import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { calculateTotal, formatRub, HOUR_TYPE_LABELS } from '@/lib/rates';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Trash2, Pencil, Clock } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type HourType = 'standard' | 'overtime' | 'sick_leave';

function calcHoursBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return 0;
  const startMinutes = sh * 60 + sm;
  const lunchDeduction = startMinutes < 11 * 60 ? 60 : 0;
  const net = diff - lunchDeduction;
  return net > 0 ? Math.round(net / 30) * 0.5 : 0;
}

const Index = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [projectName, setProjectName] = useState('');
  const [itemName, setItemName] = useState('');
  const [hours, setHours] = useState(0);
  const [hourType, setHourType] = useState<HourType>('standard');
  const [fullSheets, setFullSheets] = useState(0);
  const [halfSheets, setHalfSheets] = useState(0);
  const [productId, setProductId] = useState('');
  const [productQuantity, setProductQuantity] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const workdayHours = useMemo(() => calcHoursBetween(startTime, endTime), [startTime, endTime]);

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
      } else {
        setStartTime('');
        setEndTime('');
      }
      return data;
    },
  });

  const saveTimeMutation = useMutation({
    mutationFn: async () => {
      if (!startTime || !endTime) return;
      const totalH = calcHoursBetween(startTime, endTime);
      const payload = {
        user_id: user!.id,
        date,
        start_time: startTime,
        end_time: endTime,
        total_hours: totalH,
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
      toast.success('Рабочее время сохранено');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) throw error;
      return data as Tables<'products'>[];
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

  const selectedProduct = products.find(p => p.id === productId);
  const productPrice = selectedProduct?.price || 0;

  const liveTotal = useMemo(() => {
    return calculateTotal(hours, hourType, fullSheets, halfSheets, productPrice, productQuantity);
  }, [hours, hourType, fullSheets, halfSheets, productPrice, productQuantity]);

  const todayTotal = useMemo(() => {
    return todayEntries.reduce((sum, e) => sum + Number(e.total_amount), 0);
  }, [todayEntries]);

  const resetForm = () => {
    setProjectName('');
    setItemName('');
    setHours(0);
    setHourType('standard');
    setFullSheets(0);
    setHalfSheets(0);
    setProductId('');
    setProductQuantity(0);
    setEditingId(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const total = calculateTotal(hours, hourType, fullSheets, halfSheets, productPrice, productQuantity);
      const entry = {
        user_id: user!.id,
        date,
        project_name: projectName,
        item_name: itemName,
        hours,
        hour_type: hourType,
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
    setHours(entry.hours);
    setHourType(entry.hour_type);
    setFullSheets(entry.full_sheets);
    setHalfSheets(entry.half_sheets);
    setProductId(entry.product_id || '');
    setProductQuantity(entry.product_quantity);
    setEditingId(entry.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      {/* Hero total card — glowing */}
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

      {/* Workday time block */}
      <div className="stat-card space-y-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-secondary" />
          <p className="label-industrial text-xs">Рабочий день</p>
        </div>
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
      </div>

      {/* Date */}
      <div>
        <label className="label-industrial block mb-1.5">Дата</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-industrial w-full" />
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
        className="space-y-4"
      >
        {/* Project & Item */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-industrial block mb-1.5">Проект</label>
            <input value={projectName} onChange={e => setProjectName(e.target.value)} className="input-industrial w-full" />
          </div>
          <div>
            <label className="label-industrial block mb-1.5">Предмет</label>
            <input value={itemName} onChange={e => setItemName(e.target.value)} className="input-industrial w-full" />
          </div>
        </div>

        {/* Hours */}
        <div className="stat-card space-y-3">
          <p className="label-industrial text-xs">Время</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Часы</label>
              <input type="number" min={0} step={0.5} value={hours || ''} onChange={e => setHours(Number(e.target.value))} className="input-industrial w-full" placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Тип</label>
              <select value={hourType} onChange={e => setHourType(e.target.value as HourType)} className="input-industrial w-full">
                {Object.entries(HOUR_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Nesting */}
        <div className="stat-card space-y-3">
          <p className="label-industrial text-xs">Нестинг</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Целые листы</label>
              <input type="number" min={0} value={fullSheets || ''} onChange={e => setFullSheets(Number(e.target.value))} className="input-industrial w-full" placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Половины</label>
              <input type="number" min={0} value={halfSheets || ''} onChange={e => setHalfSheets(Number(e.target.value))} className="input-industrial w-full" placeholder="0" />
            </div>
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

      {/* Today's entries */}
      {todayEntries.length > 0 && (
        <div className="space-y-2">
          <p className="label-industrial text-xs">Записи за {date}</p>
          {todayEntries.map((entry: any) => (
            <div key={entry.id} className="stat-card flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {entry.project_name}{entry.item_name ? ` — ${entry.item_name}` : ''}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {entry.hours > 0 && `${entry.hours}ч ${HOUR_TYPE_LABELS[entry.hour_type] || ''}`}
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
          ))}
        </div>
      )}
    </div>
  );
};

export default Index;
