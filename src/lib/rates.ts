// Hourly rates (RUB)
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

export function calculateTotal(
  hours: number,
  hourType: keyof typeof HOURLY_RATES,
  fullSheets: number,
  halfSheets: number,
  productPrice: number,
  productQuantity: number
): number {
  const hourlyTotal = hours * HOURLY_RATES[hourType];
  const nestingTotal = fullSheets * NESTING_RATES.full_sheet + halfSheets * NESTING_RATES.half_sheet;
  const productTotal = productPrice * productQuantity;
  return hourlyTotal + nestingTotal + productTotal;
}

export function formatRub(amount: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount);
}
