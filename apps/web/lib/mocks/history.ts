import {
  Banknote,
  ShoppingCart,
  TriangleAlert,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import type {
  ItemVariant,
  StatusVariant,
} from '@finnit/ui/components/finance/transaction-item-with-status';
import type { CategoryRow } from '@finnit/ui/components/finance/popular-categories-card';

// TODO: replace with GraphQL (transactions module, cursor pagination).
// Copied from apps/finnit-app/screens/history.tsx.

export type FilterValue = 'all' | 'income' | 'expenses' | 'investment';

export interface HistoryTransaction {
  id: string;
  merchant: string;
  category: string;
  time: string;
  amount: string;
  statusLabel: string;
  statusVariant: StatusVariant;
  itemVariant: ItemVariant;
  icon: LucideIcon;
}

export interface TransactionGroup {
  id: string;
  dateLabel: string;
  transactions: HistoryTransaction[];
}

export const FILTER_OPTIONS: ReadonlyArray<{
  value: FilterValue;
  label: string;
}> = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expenses', label: 'Gastos' },
  { value: 'investment', label: 'Inversiones' },
];

export const MOCK_GROUPS: readonly TransactionGroup[] = [
  {
    id: 'today',
    dateLabel: 'Hoy, 24 de Octubre',
    transactions: [
      {
        id: 'tx1',
        merchant: 'Apple Store',
        category: 'Electrónica',
        time: '14:32',
        amount: '-$1,299.00',
        statusLabel: 'Completado',
        statusVariant: 'completado',
        itemVariant: 'expense',
        icon: ShoppingCart,
      },
      {
        id: 'tx2',
        merchant: 'Transferencia Recibida',
        category: 'De: Marcos Soler',
        time: '10:15',
        amount: '+$450.00',
        statusLabel: 'Vía SPEI',
        statusVariant: 'info',
        itemVariant: 'income',
        icon: Banknote,
      },
    ],
  },
  {
    id: 'yesterday',
    dateLabel: 'Ayer, 23 de Octubre',
    transactions: [
      {
        id: 'tx3',
        merchant: 'Sushi Zen Master',
        category: 'Restaurantes',
        time: '21:05',
        amount: '-$84.20',
        statusLabel: 'Pendiente',
        statusVariant: 'pendiente',
        itemVariant: 'pending',
        icon: Utensils,
      },
      {
        id: 'tx4',
        merchant: 'Suscripción Netflix',
        category: 'Entretenimiento',
        time: '04:00',
        amount: '-$15.99',
        statusLabel: 'Fallida',
        statusVariant: 'fallida',
        itemVariant: 'failed',
        icon: TriangleAlert,
      },
    ],
  },
];

export const POPULAR_CATEGORIES: readonly CategoryRow[] = [
  { id: 'tech', label: 'Tecnología', percentage: '45%', dotColor: '#00f5ff' },
  { id: 'food', label: 'Alimentación', percentage: '22%', dotColor: '#6c72cb' },
  { id: 'leisure', label: 'Ocio', percentage: '18%', dotColor: '#ffaedd' },
];
