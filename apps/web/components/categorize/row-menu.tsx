'use client';

import { useTranslations } from 'next-intl';
import { MoreVertical, PencilLine } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@finnit/ui/components/ui/dropdown-menu';

/** The "⋮" menu of a categorize row. */
export function RowMenu({
  name,
  onRename,
}: {
  name: string;
  onRename: () => void;
}) {
  const t = useTranslations('categorize');
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('rowMenu', { name })}
          className="shrink-0 text-on-surface-variant"
        >
          <MoreVertical aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onRename}>
          <PencilLine /> {t('rename')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
