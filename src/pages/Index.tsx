import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { calculateTotal, formatRub, HOUR_TYPE_LABELS } from '@/lib/rates';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Trash2, Pencil } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type HourType = 'standard' | 'overtime' | 'sick_leave';

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

  // Fetch products for dropdown
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) throw error;
      return data as Tables<'products'>[];
    },
  });

  // Fetch today's entries
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
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Live total card */}
      <div className="stat-card text-center">
        <p className="label-industrial text-xs">Итого за запись</p>
        <p className="text-3xl font-bold font-display text-primary mt-1">{formatRub(liveTotal)}</p>
        <p className="text-xs text-muted-foreground mt-1">Всего за {date}: {formatRub(todayTotal)}</p>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
        className="space-y-4"
      >
        {/* Date */}
        <div>
          <label className="label-industrial block mb-1.5">Дата</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-industrial w-full" />
        </div>

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
              <label className="text-xs text-muted-foreground block mb-1">Часы</label>
              <input type="number" min={0} step={0.5} value={hours || ''} onChange={e => setHours(Number(e.target.value))} className="input-industrial w-full" placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Тип</label>
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
              <label className="text-xs text-muted-foreground block mb-1">Целые листы</label>
              <input type="number" min={0} value={fullSheets || ''} onChange={e => setFullSheets(Number(e.target.value))} className="input-industrial w-full" placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Половины</label>
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
                <label className="text-xs text-muted-foreground block mb-1">Изделие</label>
                <select value={productId} onChange={e => setProductId(e.target.value)} className="input-industrial w-full">
                  <option value="">—</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({formatRub(p.price)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Кол-во</label>
                <input type="number" min={0} value={productQuantity || ''} onChange={e => setProductQuantity(Number(e.target.value))} className="input-industrial w-full" placeholder="0" />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" className="flex-1 h-12 text-base font-semibold" disabled={saveMutation.isPending}>
            {editingId ? 'Обновить запись' : 'Сохранить'}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={resetForm} className="h-12">
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
                <p className="text-sm font-medium text-foreground truncate">
                  {entry.project_name}{entry.item_name ? ` — ${entry.item_name}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.hours > 0 && `${entry.hours}ч ${HOUR_TYPE_LABELS[entry.hour_type] || ''}`}
                  {entry.full_sheets > 0 && ` · ${entry.full_sheets} лист.`}
                  {entry.half_sheets > 0 && ` · ${entry.half_sheets}×½`}
                  {entry.product_quantity > 0 && entry.products && ` · ${entry.products.name} ×${entry.product_quantity}`}
                </p>
              </div>
              <p className="font-display font-bold text-primary whitespace-nowrap">{formatRub(entry.total_amount)}</p>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => handleEdit(entry)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={() => deleteMutation.mutate(entry.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
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
