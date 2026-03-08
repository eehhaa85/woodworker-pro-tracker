import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, Upload, X, ImageIcon } from 'lucide-react';

const Settings = () => {
  const { user } = useAuth();
  const { settings, isLoading } = useSettings();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rateStandard, setRateStandard] = useState<number | null>(null);
  const [rateOvertime, setRateOvertime] = useState<number | null>(null);
  const [rateSickLeave, setRateSickLeave] = useState<number | null>(null);
  const [rateFullSheet, setRateFullSheet] = useState<number | null>(null);
  const [rateHalfSheet, setRateHalfSheet] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localOpacity, setLocalOpacity] = useState<number | null>(null);

  // Use local state if edited, otherwise settings from DB
  const val = (local: number | null, fallback: number) => local ?? fallback;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: user!.id,
        rate_standard: val(rateStandard, settings.rate_standard),
        rate_overtime: val(rateOvertime, settings.rate_overtime),
        rate_sick_leave: val(rateSickLeave, settings.rate_sick_leave),
        rate_full_sheet: val(rateFullSheet, settings.rate_full_sheet),
        rate_half_sheet: val(rateHalfSheet, settings.rate_half_sheet),
        background_url: settings.background_url,
      };

      if (settings.id) {
        const { error } = await supabase
          .from('user_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_settings')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_settings'] });
      toast.success('Тарифы сохранены');
      // Reset local state
      setRateStandard(null);
      setRateOvertime(null);
      setRateSickLeave(null);
      setRateFullSheet(null);
      setRateHalfSheet(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleUploadBackground = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/background.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('backgrounds')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('backgrounds')
        .getPublicUrl(filePath);

      const bgUrl = urlData.publicUrl + '?t=' + Date.now();

      // Save to settings
      if (settings.id) {
        const { error } = await supabase
          .from('user_settings')
          .update({ background_url: bgUrl })
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            background_url: bgUrl,
          });
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['user_settings'] });
      toast.success('Фон загружен');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!settings.id) return;
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ background_url: null })
        .eq('id', settings.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['user_settings'] });
      toast.success('Фон сброшен');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <p className="text-muted-foreground text-sm">Загрузка...</p>
      </div>
    );
  }

  const rateFields = [
    { label: 'Стандарт (₽/ч)', value: val(rateStandard, settings.rate_standard), set: setRateStandard },
    { label: 'Сверхурочные (₽/ч)', value: val(rateOvertime, settings.rate_overtime), set: setRateOvertime },
    { label: 'Больничный (₽/ч)', value: val(rateSickLeave, settings.rate_sick_leave), set: setRateSickLeave },
    { label: 'Целый лист (₽)', value: val(rateFullSheet, settings.rate_full_sheet), set: setRateFullSheet },
    { label: 'Половина листа (₽)', value: val(rateHalfSheet, settings.rate_half_sheet), set: setRateHalfSheet },
  ];

  return (
    <div className="max-w-lg mx-auto p-4 md:p-6 space-y-8">
      {/* Rates */}
      <div>
        <h2 className="text-lg font-black text-foreground mb-1">Тарифы</h2>
        <p className="text-xs text-muted-foreground mb-5">Настройте почасовые ставки и расценки за нестинг</p>

        <div className="space-y-4">
          {/* Hourly rates */}
          <div className="stat-card space-y-3">
            <p className="label-industrial text-xs">Почасовые ставки</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {rateFields.slice(0, 3).map((f) => (
                <div key={f.label}>
                  <label className="text-xs text-muted-foreground block mb-1.5">{f.label}</label>
                  <input
                    type="number"
                    min={0}
                    value={f.value || ''}
                    onChange={e => f.set(Number(e.target.value))}
                    className="input-industrial w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Nesting rates */}
          <div className="stat-card space-y-3">
            <p className="label-industrial text-xs">Нестинг</p>
            <div className="grid grid-cols-2 gap-3">
              {rateFields.slice(3).map((f) => (
                <div key={f.label}>
                  <label className="text-xs text-muted-foreground block mb-1.5">{f.label}</label>
                  <input
                    type="number"
                    min={0}
                    value={f.value || ''}
                    onChange={e => f.set(Number(e.target.value))}
                    className="input-industrial w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full h-14 text-base font-bold rounded-xl shadow-lg shadow-primary/20"
          >
            <Save size={18} />
            Сохранить тарифы
          </Button>
        </div>
      </div>

      {/* Background */}
      <div>
        <h2 className="text-lg font-black text-foreground mb-1">Фон приложения</h2>
        <p className="text-xs text-muted-foreground mb-5">Загрузите своё изображение для фона</p>

        <div className="stat-card space-y-4">
          {settings.background_url ? (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-border aspect-video">
                <img
                  src={settings.background_url}
                  alt="Background preview"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Opacity slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground">Прозрачность затемнения</label>
                  <span className="text-xs font-display text-foreground">{Math.round(settings.background_opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(settings.background_opacity * 100)}
                  onChange={async (e) => {
                    const opacity = Number(e.target.value) / 100;
                    if (!settings.id) return;
                    await supabase
                      .from('user_settings')
                      .update({ background_opacity: opacity } as any)
                      .eq('id', settings.id);
                    queryClient.invalidateQueries({ queryKey: ['user_settings'] });
                  }}
                  className="w-full accent-primary h-2 rounded-full appearance-none bg-muted cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Прозрачно</span>
                  <span>Затемнено</span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={handleRemoveBackground}
                className="w-full btn-olive"
              >
                <X size={16} />
                Сбросить фон
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ImageIcon size={32} className="mb-2 opacity-50" />
              <p className="text-sm">Фон не задан</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadBackground(file);
              e.target.value = '';
            }}
          />

          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full h-12 rounded-xl"
          >
            <Upload size={16} />
            {uploading ? 'Загрузка...' : 'Загрузить изображение'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
