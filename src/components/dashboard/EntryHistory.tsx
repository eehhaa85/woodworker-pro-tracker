import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Trash2, CalendarIcon, X } from 'lucide-react';
import { formatRub, HOUR_TYPE_LABELS } from '@/lib/rates';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface EntryHistoryProps {
  entries: any[];
}

const EntryHistory = ({ entries }: EntryHistoryProps) => {
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const queryClient = useQueryClient();

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

  const filteredEntries = filterDate
    ? entries.filter((e) => e.date === format(filterDate, 'yyyy-MM-dd'))
    : entries;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="label-industrial text-xs">История записей</p>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 gap-1.5 text-xs border-border',
                  filterDate && 'border-primary/50 text-primary'
                )}
              >
                <CalendarIcon size={12} />
                {filterDate ? format(filterDate, 'd MMM yyyy', { locale: ru }) : 'Фильтр по дате'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={filterDate}
                onSelect={setFilterDate}
                className={cn('p-3 pointer-events-auto')}
                locale={ru}
              />
            </PopoverContent>
          </Popover>
          {filterDate && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setFilterDate(undefined)}
            >
              <X size={14} />
            </Button>
          )}
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {filterDate ? 'Нет записей за эту дату' : 'Записей пока нет'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((entry: any) => (
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
  );
};

export default EntryHistory;
