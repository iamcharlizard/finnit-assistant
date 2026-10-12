'use client';

import * as React from 'react';

import { cn } from '../../lib/utils';

interface ExpenseProjectionCardProps {
  title?: string;
  subtitle?: string;
  months?: string[];
  onDetailsClick?: () => void;
  className?: string;
}

const PATH =
  'M0,105 C35,88 70,98 105,65 C140,32 175,50 210,32 C245,14 280,38 400,5';

function ExpenseProjectionCard({
  title = 'Proyección de Gastos',
  subtitle = 'Estimado basado en IA para los próximos 6 meses',
  months = ['JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV'],
  onDetailsClick,
  className,
}: ExpenseProjectionCardProps) {
  const id = React.useId().replace(/:/g, '');

  return (
    <section
      className={cn(
        'overflow-hidden rounded-[20px] border border-glass-border bg-glass p-[18px] backdrop-blur-md',
        className,
      )}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="mb-1 text-lg font-bold text-on-background">{title}</h3>
          <p className="text-[13px] text-on-surface-variant">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onDetailsClick}
          aria-label="Ver detalles de proyección de gastos"
          className="min-h-11 shrink-0 rounded-[20px] border border-[#6c72cb]/35 bg-[#6c72cb]/10 px-3 py-2 text-[11px] font-bold tracking-[0.15em] text-violet-ink outline-none hover:bg-[#6c72cb]/20 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-[#bfc2ff]"
        >
          DETALLES
        </button>
      </div>

      <svg
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        aria-hidden
        className="h-[110px] w-full"
      >
        <defs>
          <linearGradient id={`l-${id}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--tertiary)" stopOpacity="0.3" />
            <stop offset="1" stopColor="var(--tertiary)" stopOpacity="1" />
          </linearGradient>
          <linearGradient id={`a-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--tertiary)" stopOpacity="0.12" />
            <stop offset="1" stopColor="var(--tertiary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={PATH}
          fill="none"
          stroke={`url(#l-${id})`}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path d={`${PATH} L400,120 L0,120 Z`} fill={`url(#a-${id})`} />
      </svg>

      <div aria-hidden className="mt-2.5 flex justify-between">
        {months.map((m) => (
          <span key={m} className="text-[11px] text-on-surface-variant">
            {m}
          </span>
        ))}
      </div>
    </section>
  );
}

export { ExpenseProjectionCard, type ExpenseProjectionCardProps };
