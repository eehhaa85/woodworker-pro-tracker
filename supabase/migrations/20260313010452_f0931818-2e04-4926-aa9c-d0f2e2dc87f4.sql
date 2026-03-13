
ALTER TABLE public.work_entries ADD COLUMN hours_overtime numeric NOT NULL DEFAULT 0;
ALTER TABLE public.daily_time_logs ADD COLUMN day_type text NOT NULL DEFAULT 'work';
