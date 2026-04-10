export type SupportedCurrency = 'PHP' | 'USD' | 'EUR';

const PHP_PER_UNIT: Record<SupportedCurrency, number> = {
  PHP: 1,
  USD: 56,
  EUR: 61,
};

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
};

export function toSupportedCurrency(value: string | null | undefined): SupportedCurrency {
  if (value === 'USD' || value === 'EUR' || value === 'PHP') return value;
  return 'PHP';
}

export function normalizeToPhp(amount: number, currency: string | null | undefined): number {
  const unit = toSupportedCurrency(currency);
  return amount * PHP_PER_UNIT[unit];
}

export function convertFromPhp(amountPhp: number, target: SupportedCurrency): number {
  return amountPhp / PHP_PER_UNIT[target];
}

export function formatCurrency(amount: number, currency: SupportedCurrency): string {
  return `${CURRENCY_SYMBOLS[currency]}${Math.round(amount).toLocaleString()}`;
}
