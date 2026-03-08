
CREATE TABLE public.daily_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  start_time time NOT NULL,
  end_time time NOT NULL,
  total_hours numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.daily_time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own time logs" ON public.daily_time_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own time logs" ON public.daily_time_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own time logs" ON public.daily_time_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own time logs" ON public.daily_time_logs FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_daily_time_logs_updated_at
  BEFORE UPDATE ON public.daily_time_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
