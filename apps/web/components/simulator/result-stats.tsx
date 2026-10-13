import { useTranslations } from 'next-intl';

import type { ResultView } from '@/lib/simulator/view';
import { StatTile } from './stat-tile';

/** Key numbers: end balances, the difference and when the balance goes negative. */
export function ResultStats({ result }: { result: ResultView }) {
  const t = useTranslations('simulator.results');
  return (
    <dl className="grid grid-cols-2 gap-3">
      <StatTile
        label={t('endScenario')}
        value={result.endScenario}
        note={t('endNote', { month: result.endMonth })}
      />
      <StatTile
        label={t('endBaseline')}
        value={result.endBaseline}
        note={t('endNote', { month: result.endMonth })}
      />
      <StatTile
        label={t('difference')}
        value={result.difference}
        tone={
          result.tone === 'up'
            ? 'good'
            : result.tone === 'down'
              ? 'bad'
              : 'neutral'
        }
        note={t(`differenceNote.${result.tone}`)}
      />
      <StatTile
        label={t('negative')}
        value={result.scenarioNegative}
        tone={result.scenarioWarning ? 'bad' : 'neutral'}
        note={t('negativeBaseline', { value: result.baselineNegative })}
      />
    </dl>
  );
}
