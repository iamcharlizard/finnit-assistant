import {
  CircleArrowDown,
  Ellipsis,
  Film,
  Heart,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

// TODO: replace with GraphQL (reports + transactions modules).
// Copied from apps/finnit-app/screens/dashboard.tsx.

export interface FinancialSummaryData {
  balance: string;
  trend: string;
  trendPositive: boolean;
  monthlyIncome: string;
  monthlyExpenses: string;
}

export interface TransactionData {
  id: string;
  merchant: string;
  category: string;
  time: string;
  amount: string;
  type: 'income' | 'expense';
  icon: LucideIcon;
}

export const MOCK_FINANCIAL_DATA: FinancialSummaryData = {
  balance: '$45,280.00',
  trend: '+2.4%',
  trendPositive: true,
  monthlyIncome: '$8,240.00',
  monthlyExpenses: '$3,960.00',
};

export const RECENT_TRANSACTIONS: TransactionData[] = [
  {
    id: '1',
    merchant: 'Amazon Store',
    category: 'Compras',
    time: 'Hoy, 14:20',
    amount: '-$142.50',
    type: 'expense',
    icon: ShoppingCart,
  },
  {
    id: '2',
    merchant: 'La Parrilla Gourmet',
    category: 'Comida',
    time: 'Ayer, 21:05',
    amount: '-$85.00',
    type: 'expense',
    icon: Utensils,
  },
  {
    id: '3',
    merchant: 'Depósito de Nómina',
    category: 'Ingresos',
    time: '15 Oct, 09:00',
    amount: '+$3,200.00',
    type: 'income',
    icon: CircleArrowDown,
  },
  {
    id: '4',
    merchant: 'Iberia Airlines',
    category: 'Viajes',
    time: '12 Oct, 11:45',
    amount: '-$540.20',
    type: 'expense',
    icon: Plane,
  },
];

export const QUICK_CATEGORIES: Array<{ label: string; icon: LucideIcon }> = [
  { label: 'Compras', icon: ShoppingBag },
  { label: 'Comida', icon: Utensils },
  { label: 'Viajes', icon: Plane },
  { label: 'Ocio', icon: Film },
  { label: 'Salud', icon: Heart },
  { label: 'Más', icon: Ellipsis },
];
