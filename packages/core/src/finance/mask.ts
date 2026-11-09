/**
 * Amounts hidden on screen ("ocultar montos"): every figure shows the same
 * placeholder, so nothing about its size leaks.
 */
export const MASKED_AMOUNT = '$ ••••';

export function maskIf(hidden: boolean, text: string): string {
  return hidden ? MASKED_AMOUNT : text;
}
