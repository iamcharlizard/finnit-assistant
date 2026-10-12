'use client';

import * as React from 'react';

import { cn } from '../../lib/utils';

interface SectionHeadingProps {
  title: string;
  /** Optional trailing action, e.g. a "Ver todo" link or icon button. */
  action?: React.ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}

function SectionHeading({
  title,
  action,
  as: Heading = 'h2',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn('mb-3 flex items-center justify-between px-1', className)}
    >
      <Heading className="text-lg font-bold text-on-background sm:text-xl">
        {title}
      </Heading>
      {action}
    </div>
  );
}

export { SectionHeading, type SectionHeadingProps };
