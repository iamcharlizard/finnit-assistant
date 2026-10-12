import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';

interface ProjectionCardProps {
  label: string;
  amount: string;
  icon: LucideIcon;
  accentColor: string;
  /** Rendered under the amount (progress bar, trend line…). */
  children?: React.ReactNode;
  className?: string;
}

function ProjectionCard({
  label,
  amount,
  icon: Icon,
  accentColor,
  children,
  className,
}: ProjectionCardProps) {
  return (
    <section
      className={cn('flex-1 rounded-[20px] border p-3.5', className)}
      style={{
        backgroundColor: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
        borderColor: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
      }}
    >
      <div className="mb-2.5 flex items-start justify-between">
        <span className="flex size-[34px] items-center justify-center rounded-[10px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <Icon aria-hidden className="size-4" style={{ color: accentColor }} />
        </span>
        <h3
          className="ml-1 max-w-24 text-right text-[8px] font-bold uppercase tracking-[0.08em]"
          // Blend toward the foreground so any accent stays readable in both themes.
          style={{
            color: `color-mix(in srgb, ${accentColor} 60%, var(--on-background))`,
          }}
        >
          {label}
        </h3>
      </div>
      <p className="mb-2.5 text-xl font-bold text-on-background">{amount}</p>
      {children}
    </section>
  );
}

export { ProjectionCard, type ProjectionCardProps };
