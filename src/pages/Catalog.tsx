import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { formatRub } from '@/lib/rates';
import { toast } from 'sonner';
import { Trash2, Pencil, Plus } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

const Catalog = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) throw error;
      return data as Tables<'products'>[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Введите название');
      if (price <= 0) throw new Error('Введите цену');

      if (editingId) {
        const { error } = await supabase.from('products').update({ name: name.trim(), price }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert({ user_id: user!.id, name: name.trim(), price });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(editingId ? 'Изделие обновлено' : 'Изделие добавлено');
      setName('');
      setPrice(0);
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Изделие удалено');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleEdit = (product: Tables<'products'>) => {
    setName(product.name);
    setPrice(product.price);
    setEditingId(product.id);
  };

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <div>
        <h2 className="label-industrial text-xs mb-4">Справочник изделий</h2>

        <form
          onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
          className="space-y-3"
        >
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Название</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-industrial w-full"
              placeholder="Стол журнальный"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Цена (руб)</label>
            <input
              type="number"
              min={0}
              value={price || ''}
              onChange={e => setPrice(Number(e.target.value))}
              className="input-industrial w-full"
              placeholder="700"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 h-12" disabled={saveMutation.isPending}>
              <Plus size={16} />
              {editingId ? 'Обновить' : 'Добавить'}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={() => { setName(''); setPrice(0); setEditingId(null); }} className="h-12">
                Отмена
              </Button>
            )}
          </div>
        </form>
      </div>

      {products.length > 0 && (
        <div className="space-y-2">
          {products.map(p => (
            <div key={p.id} className="stat-card flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{p.name}</p>
              </div>
              <p className="font-display font-bold text-primary whitespace-nowrap">{formatRub(p.price)}</p>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => handleEdit(p)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={() => deleteMutation.mutate(p.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
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

export default Catalog;
