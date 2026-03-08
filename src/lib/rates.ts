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

export interface CustomRates {
  rate_standard: number;
  rate_overtime: number;
  rate_sick_leave: number;
  rate_full_sheet: number;
  rate_half_sheet: number;
}

export function calculateTotal(
  hours: number,
  hourType: keyof typeof HOURLY_RATES,
  fullSheets: number,
  halfSheets: number,
  productPrice: number,
  productQuantity: number,
  customRates?: CustomRates
): number {
  const hourlyRate = customRates
    ? { standard: customRates.rate_standard, overtime: customRates.rate_overtime, sick_leave: customRates.rate_sick_leave }[hourType]
    : HOURLY_RATES[hourType];

  const fullSheetRate = customRates?.rate_full_sheet ?? NESTING_RATES.full_sheet;
  const halfSheetRate = customRates?.rate_half_sheet ?? NESTING_RATES.half_sheet;

  const hourlyTotal = hours * hourlyRate;
  const nestingTotal = fullSheets * fullSheetRate + halfSheets * halfSheetRate;
  const productTotal = productPrice * productQuantity;
  return hourlyTotal + nestingTotal + productTotal;
}

export function formatRub(amount: number): string {
  const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount);
  return `${formatted} р.`;
}
