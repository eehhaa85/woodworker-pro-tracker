import { useState, useRef, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
}

const ProjectAutocomplete = ({ value, onChange, suggestions, placeholder }: Props) => {
  const { user } = useAuth();
  const { settings, refetch } = useSettings();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const hidden = new Set((settings.hidden_projects || []).map(s => s.toLowerCase()));

  const visible = useMemo(() => {
    const filtered = suggestions.filter(s => !hidden.has(s.toLowerCase()));
    if (!value) return filtered;
    const q = value.toLowerCase();
    return filtered.filter(s => s.toLowerCase().includes(q));
  }, [suggestions, value, settings.hidden_projects]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const hideMutation = useMutation({
    mutationFn: async (name: string) => {
      const next = [...new Set([...(settings.hidden_projects || []), name])];
      const { error } = await supabase
        .from('user_settings')
        .update({ hidden_projects: next } as any)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['user_settings'] });
      toast.success('Удалено из подсказок');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div ref={wrapperRef} className="relative">
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="input-industrial w-full"
        placeholder={placeholder}
      />
      {open && visible.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-border bg-popover shadow-lg">
          {visible.map(name => (
            <div
              key={name}
              className="flex items-center justify-between px-3 py-2 hover:bg-accent/40 cursor-pointer group"
              onClick={() => { onChange(name); setOpen(false); }}
            >
              <span className="text-sm text-foreground truncate">{name}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); hideMutation.mutate(name); }}
                className="p-1 text-muted-foreground hover:text-destructive rounded opacity-60 hover:opacity-100"
                title="Удалить из подсказок"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectAutocomplete;
