/** Formats an amount as currency (MXN unless the bank says otherwise). */
export function formatMoney(amount: number | null | undefined, currency?: string | null): string {
  const value = amount ?? 0;
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
    }).format(value);
  } catch {
    // Unknown currency code from the bank: fall back to pesos.
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  }
}

const BANK_ACCOUNT_TYPES: Record<string, string> = {
  'Credit Card': 'Tarjeta de crédito',
  Checking: 'Cuenta de débito',
  Savings: 'Ahorro',
  Loan: 'Préstamo',
  Investment: 'Inversión',
};

/** Spanish label for a bank account type reported by Syncfy. */
export function bankAccountTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Cuenta';
  return BANK_ACCOUNT_TYPES[type] ?? type;
}

const FINNIT_ACCOUNT_TYPES: Record<string, string> = {
  cash: 'Efectivo',
  credit: 'Crédito',
  debit: 'Débito',
  ewallet: 'Monedero',
  savings: 'Ahorro',
};

export function finnitAccountTypeLabel(type: string): string {
  return FINNIT_ACCOUNT_TYPES[type] ?? type;
}

/** Image sources from Syncfy are data: URIs; tolerate bare base64 too. */
export function toImageUri(base64OrUri: string): string {
  return base64OrUri.startsWith('data:') ? base64OrUri : `data:image/png;base64,${base64OrUri}`;
}
