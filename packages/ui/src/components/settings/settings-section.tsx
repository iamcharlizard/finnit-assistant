import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/utils';

interface SettingsSectionProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  children: React.ReactNode;
  className?: string;
}

function SettingsSection({
  title,
  icon: Icon,
  iconColor,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-card border border-glass-border bg-glass p-4 shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-md dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        className,
      )}
    >
      <h2 className="mb-1 flex items-center gap-3 text-base font-bold text-on-background">
        <Icon aria-hidden className="size-5" style={{ color: iconColor }} />
        {title}
      </h2>
      {children}
    </section>
  );
}

export { SettingsSection, type SettingsSectionProps };
