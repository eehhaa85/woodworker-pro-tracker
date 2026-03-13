import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';

const BackupRestore = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);

  const handleExport = async () => {
    if (!user) return;
    try {
      const [entries, timeLogs, products, settings] = await Promise.all([
        supabase.from('work_entries').select('*').eq('user_id', user.id),
        supabase.from('daily_time_logs').select('*').eq('user_id', user.id),
        supabase.from('products').select('*').eq('user_id', user.id),
        supabase.from('user_settings').select('*').eq('user_id', user.id),
      ]);

      const backup = {
        version: 1,
        exported_at: new Date().toISOString(),
        work_entries: entries.data || [],
        daily_time_logs: timeLogs.data || [],
        products: products.data || [],
        user_settings: settings.data || [],
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Резервная копия скачана');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleImport = async (file: File) => {
    if (!user) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.version || !backup.work_entries) {
        throw new Error('Неверный формат файла');
      }

      // Restore products first (work_entries may reference them)
      if (backup.products?.length) {
        for (const p of backup.products) {
          const { id, created_at, updated_at, user_id, ...rest } = p;
          await supabase.from('products').upsert({ ...rest, id, user_id: user.id });
        }
      }

      // Restore work entries
      if (backup.work_entries?.length) {
        for (const e of backup.work_entries) {
          const { id, created_at, updated_at, user_id, ...rest } = e;
          await supabase.from('work_entries').upsert({ ...rest, id, user_id: user.id });
        }
      }

      // Restore time logs
      if (backup.daily_time_logs?.length) {
        for (const t of backup.daily_time_logs) {
          const { id, created_at, updated_at, user_id, ...rest } = t;
          await supabase.from('daily_time_logs').upsert({ ...rest, id, user_id: user.id });
        }
      }

      // Restore settings
      if (backup.user_settings?.length) {
        for (const s of backup.user_settings) {
          const { id, created_at, updated_at, user_id, ...rest } = s;
          await supabase.from('user_settings').upsert({ ...rest, id, user_id: user.id });
        }
      }

      queryClient.invalidateQueries();
      toast.success('Данные восстановлены из резервной копии');
    } catch (e: any) {
      toast.error('Ошибка: ' + e.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-black text-foreground mb-1">Резервное копирование</h2>
      <p className="text-xs text-muted-foreground mb-5">Сохраните или восстановите данные</p>

      <div className="stat-card space-y-3">
        <Button onClick={handleExport} variant="secondary" className="w-full h-12 rounded-xl gap-2">
          <Download size={16} />
          Сохранить резервную копию
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = '';
          }}
        />

        <Button
          onClick={() => fileRef.current?.click()}
          variant="outline"
          disabled={restoring}
          className="w-full h-12 rounded-xl gap-2 btn-olive"
        >
          <Upload size={16} />
          {restoring ? 'Восстановление...' : 'Загрузить резервную копию'}
        </Button>
      </div>
    </div>
  );
};

export default BackupRestore;
