'use client';

import { useTranslations } from 'next-intl';
import { Download, FileIcon, Trash2 } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

import type { AttachmentView } from '@/lib/transaction-detail/view';

/** One attached file: download (through /api/files) and delete. */
export function AttachmentItem({
  attachment,
  busy,
  onRemove,
}: {
  attachment: AttachmentView;
  busy: boolean;
  onRemove: () => void;
}) {
  const t = useTranslations('transaction.attachments');
  return (
    <li className="flex items-center gap-3 rounded-xl border border-outline bg-surface p-3">
      <FileIcon
        aria-hidden
        className="size-5 shrink-0 text-on-surface-variant"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-on-background">
          {attachment.name}
        </p>
        <p className="text-xs text-on-surface-variant">{attachment.meta}</p>
      </div>
      {attachment.href ? (
        <Button variant="ghost" size="icon" asChild>
          <a
            href={attachment.href}
            download
            aria-label={t('download', { name: attachment.name })}
          >
            <Download aria-hidden />
          </a>
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        disabled={busy}
        onClick={onRemove}
        aria-label={t('remove', { name: attachment.name })}
        className="text-expense"
      >
        <Trash2 aria-hidden />
      </Button>
    </li>
  );
}
