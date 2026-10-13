import type { LucideIcon } from 'lucide-react';

/** One group of scenario controls: icon, title, short help and the fields. */
export function ControlSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-glass-border bg-glass p-4 backdrop-blur-md">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <Icon aria-hidden className="size-4 text-tertiary" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm font-bold text-on-background">{title}</h2>
          {description ? (
            <p className="text-xs text-on-surface-variant">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}
