import { useTranslations } from 'next-intl';

/** The chart's numbers as a table, folded by default. */
export function BalanceTable({
  rows,
}: {
  rows: {
    key: number;
    month: string;
    baseline: string;
    scenario: string;
    difference: string;
  }[];
}) {
  const t = useTranslations('simulator.table');
  return (
    <details className="group rounded-input border border-outline/70">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-brand-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <span className="group-open:hidden">{t('show')}</span>
        <span className="hidden group-open:inline">{t('hide')}</span>
      </summary>
      <div className="max-h-80 overflow-auto border-t border-outline/70">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">{t('caption')}</caption>
          <thead className="sticky top-0 bg-surface">
            <tr className="text-on-surface-variant">
              <th scope="col" className="px-3 py-2 font-medium">
                {t('month')}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t('baseline')}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t('scenario')}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {t('difference')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-outline/40">
                <th
                  scope="row"
                  className="px-3 py-1.5 font-medium text-on-background"
                >
                  {row.month}
                </th>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {row.baseline}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {row.scenario}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {row.difference}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
