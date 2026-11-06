import type * as React from 'react';

import { cn } from '../../lib/utils';
import { TwView } from '../../lib/tw';
import { Text } from './text';

interface SectionHeadingProps {
  title: string;
  action?: React.ReactNode;
  className?: string;
}

function SectionHeading({ title, action, className }: SectionHeadingProps) {
  return (
    <TwView className={cn('mb-3 flex-row items-center justify-between px-1', className)}>
      <Text accessibilityRole="header" weight="bold" className="text-lg text-on-background">
        {title}
      </Text>
      {action}
    </TwView>
  );
}

export { SectionHeading, type SectionHeadingProps };
