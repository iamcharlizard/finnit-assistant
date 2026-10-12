import { BalanceCardChart } from './balance-card-chart';
import { BalanceCardFooter } from './balance-card-footer';
import { BalanceCardHeader } from './balance-card-header';
import { BalanceCardRoot } from './balance-card-root';

/** Compound API matching mobile: <BalanceCard.Root><BalanceCard.Header/>… */
export const BalanceCard = {
  Root: BalanceCardRoot,
  Header: BalanceCardHeader,
  Chart: BalanceCardChart,
  Footer: BalanceCardFooter,
};
