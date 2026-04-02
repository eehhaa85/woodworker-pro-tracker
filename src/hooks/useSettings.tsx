import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface UserSettings {
  id?: string;
  full_name: string;
  rate_standard: number;
  rate_overtime: number;
  rate_sick_leave: number;
  rate_full_sheet: number;
  rate_half_sheet: number;
  background_url: string | null;
  background_opacity: number;
  advance_payment: number;
  widget_opacity: number;
  widget_theme: 'dark' | 'light';
}

const DEFAULT_SETTINGS: UserSettings = {
  full_name: '',
  rate_standard: 400,
  rate_overtime: 600,
  rate_sick_leave: 200,
  rate_full_sheet: 660,
  rate_half_sheet: 330,
  background_url: null,
  background_opacity: 0.85,
  advance_payment: 20000,
  widget_opacity: 0.8,
  widget_theme: 'dark',
};

interface SettingsContextType {
  settings: UserSettings;
  isLoading: boolean;
  refetch: () => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  isLoading: true,
  refetch: () => {},
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['user_settings', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const settings: UserSettings = data
    ? {
        id: data.id,
        full_name: data.full_name ?? '',
        rate_standard: Number(data.rate_standard),
        rate_overtime: Number(data.rate_overtime),
        rate_sick_leave: Number(data.rate_sick_leave),
        rate_full_sheet: Number(data.rate_full_sheet),
        rate_half_sheet: Number(data.rate_half_sheet),
        background_url: data.background_url,
        background_opacity: Number(data.background_opacity ?? 0.85),
        advance_payment: Number(data.advance_payment ?? 20000),
      }
    : DEFAULT_SETTINGS;

  return (
    <SettingsContext.Provider value={{ settings, isLoading, refetch }}>
      {children}
    </SettingsContext.Provider>
  );
};
