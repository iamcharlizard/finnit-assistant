import { TransactionType } from '@finnit/database';
import {
  buildHistoryIndex,
  categoryFromHistory,
  type CategorizedSample,
} from './history-category';

const expense = TransactionType.expense;
const income = TransactionType.income;
const sample = (
  key: string,
  categoryId: string,
  type: TransactionType = expense,
): CategorizedSample => ({ key, categoryId, type });

describe('categoryFromHistory', () => {
  it('uses the only category ever given to the merchant, even once', () => {
    const index = buildHistoryIndex([sample('OXXO', 'snacks')]);
    expect(categoryFromHistory(index, expense, 'OXXO')).toBe('snacks');
  });

  it('picks the clear favourite (2+ and 60 %)', () => {
    const index = buildHistoryIndex([
      sample('UBER', 'transport'),
      sample('UBER', 'transport'),
      sample('UBER', 'transport'),
      sample('UBER', 'food'),
    ]);
    expect(categoryFromHistory(index, expense, 'UBER')).toBe('transport');
  });

  it('gives no answer for a tie or a weak favourite', () => {
    const tie = buildHistoryIndex([
      sample('AMAZON', 'home'),
      sample('AMAZON', 'tech'),
    ]);
    expect(categoryFromHistory(tie, expense, 'AMAZON')).toBeNull();
    const weak = buildHistoryIndex([
      sample('WALMART', 'groceries'),
      sample('WALMART', 'groceries'),
      sample('WALMART', 'home'),
      sample('WALMART', 'tech'),
    ]);
    expect(categoryFromHistory(weak, expense, 'WALMART')).toBeNull();
  });

  it('keeps income and expenses apart', () => {
    const index = buildHistoryIndex([sample('ACME', 'salary', income)]);
    expect(categoryFromHistory(index, expense, 'ACME')).toBeNull();
    expect(categoryFromHistory(index, income, 'ACME')).toBe('salary');
  });

  it('needs a key and a known merchant', () => {
    const index = buildHistoryIndex([sample('OXXO', 'snacks')]);
    expect(categoryFromHistory(index, expense, null)).toBeNull();
    expect(categoryFromHistory(index, expense, 'SEVEN')).toBeNull();
  });
});
