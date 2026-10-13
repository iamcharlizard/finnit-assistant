import type { Metadata } from 'next';

import { ConnectBankFlow } from '@/components/bank-connect/connect-bank-flow';

export const metadata: Metadata = { title: 'Conectar banco' };

export default function ConnectBankPage() {
  return <ConnectBankFlow />;
}
