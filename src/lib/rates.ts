// Hourly rates (RUB) — defaults, can be overridden by user settings
export const HOURLY_RATES = {
  standard: 400,
  overtime: 600,
  sick_leave: 200,
} as const;

// Nesting rates (RUB)
export const NESTING_RATES = {
  full_sheet: 660,
  half_sheet: 330,
} as const;

export const HOUR_TYPE_LABELS: Record<string, string> = {
  standard: 'Стандарт',
  overtime: 'Сверхурочные',
  sick_leave: 'Больничный/Отпуск',
};

export const DAY_TYPE_LABELS: Record<string, string> = {
  work: 'Рабочий',
  sick: 'Больничный',
  vacation: 'Отпуск',
};

export interface CustomRates {
  rate_standard: number;
  rate_overtime: number;
  rate_sick_leave: number;
  rate_full_sheet: number;
  rate_half_sheet: number;
}

export function calculateTotal(
  hoursStandard: number,
  hoursOvertime: number,
  fullSheets: number,
  halfSheets: number,
  productPrice: number,
  productQuantity: number,
  customRates?: CustomRates
): number {
  const stdRate = customRates?.rate_standard ?? HOURLY_RATES.standard;
  const otRate = customRates?.rate_overtime ?? HOURLY_RATES.overtime;
  const fullSheetRate = customRates?.rate_full_sheet ?? NESTING_RATES.full_sheet;
  const halfSheetRate = customRates?.rate_half_sheet ?? NESTING_RATES.half_sheet;

  return hoursStandard * stdRate + hoursOvertime * otRate +
    fullSheets * fullSheetRate + halfSheets * halfSheetRate +
    productPrice * productQuantity;
}

/** Calculate worked hours between two HH:MM values with lunch deduction only when spanning 12:00-13:00 */
export function calculateWorkdayHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const diff = endMinutes - startMinutes;

  if (diff <= 0) return 0;

  const lunchDeduction = startMinutes < 12 * 60 && endMinutes > 13 * 60 ? 60 : 0;
  const net = diff - lunchDeduction;

  return net > 0 ? Math.round(net / 30) * 0.5 : 0;
}

/** Convert decimal hours to HH:MM string */
export function formatHoursHHMM(hours: number): string {
  if (!hours) return '';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Extract standard/overtime/sick hours from an entry (handles legacy hour_type) */
export function getEntryHours(entry: any): { standard: number; overtime: number; sick: number } {
  if (entry.hour_type === 'sick_leave') {
    return { standard: 0, overtime: 0, sick: Number(entry.hours) };
  }
  if (entry.hour_type === 'overtime') {
    return { standard: 0, overtime: Number(entry.hours), sick: 0 };
  }
  return {
    standard: Number(entry.hours),
    overtime: Number(entry.hours_overtime || 0),
    sick: 0,
  };
}

/** Abbreviate common furniture terms for compact display */
export function abbreviate(text: string): string {
  const map: [RegExp, string][] = [
    [/шкаф/gi, 'шк.'],
    [/стеллаж/gi, 'стел.'],
    [/консоль/gi, 'конс.'],
    [/комод/gi, 'ком.'],
    [/кровать/gi, 'кров.'],
    [/тумба/gi, 'тумб.'],
    [/полка/gi, 'пол.'],
    [/столешница/gi, 'стол.'],
  ];
  let result = text;
  for (const [re, short] of map) {
    result = result.replace(re, short);
  }
  return result;
}

export function formatRub(amount: number): string {
  const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount);
  return `${formatted} р.`;
}
