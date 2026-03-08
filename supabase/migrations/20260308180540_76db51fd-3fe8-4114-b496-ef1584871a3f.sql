
-- User settings table for custom rates and preferences
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  rate_standard numeric NOT NULL DEFAULT 400,
  rate_overtime numeric NOT NULL DEFAULT 600,
  rate_sick_leave numeric NOT NULL DEFAULT 200,
  rate_full_sheet numeric NOT NULL DEFAULT 660,
  rate_half_sheet numeric NOT NULL DEFAULT 330,
  background_url text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for background images
INSERT INTO storage.buckets (id, name, public) VALUES ('backgrounds', 'backgrounds', true);

-- Storage RLS policies
CREATE POLICY "Users can upload backgrounds" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'backgrounds' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their backgrounds" ON storage.objects FOR UPDATE USING (bucket_id = 'backgrounds' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete their backgrounds" ON storage.objects FOR DELETE USING (bucket_id = 'backgrounds' AND auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can view backgrounds" ON storage.objects FOR SELECT USING (bucket_id = 'backgrounds');
