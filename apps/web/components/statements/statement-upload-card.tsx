'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Upload } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { Card } from '@finnit/ui/components/ui/card';
import { Combobox } from '@finnit/ui/components/ui/combobox';
import { FileDropzone } from '@finnit/ui/components/ui/file-dropzone';

import { MAX_UPLOAD_BYTES } from '@/lib/files/routes';
import {
  STATEMENT_ACCEPT,
  StatementUploadError,
  statementUploadErrorKey,
  uploadStatement,
} from '@/lib/statements/upload';

/**
 * "Subir estado de cuenta": a credit card and its PDF. On success it opens
 * the review page, which follows the extraction.
 */
export function StatementUploadCard({
  cards,
  initialAccountId,
}: {
  cards: { value: string; label: string }[];
  /** Preselected card (?account= from the Accounts screen). */
  initialAccountId?: string;
}) {
  const router = useRouter();
  const t = useTranslations('statements');
  const [accountId, setAccountId] = React.useState(
    () =>
      cards.find((c) => c.value === initialAccountId)?.value ??
      (cards.length === 1 ? cards[0]!.value : ''),
  );
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accountId) return setError(t('upload.cardRequired'));
    if (!file) return setError(t('upload.fileRequired'));
    setUploading(true);
    setError(null);
    try {
      const { id } = await uploadStatement(accountId, file);
      router.push(`/statements/${id}`);
    } catch (e) {
      const key =
        e instanceof StatementUploadError
          ? statementUploadErrorKey(e.status, e.apiMessage)
          : 'failed';
      setError(t(`uploadErrors.${key}`));
      setUploading(false);
    }
  }

  return (
    <Card className="gap-4 rounded-[20px] p-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-on-background">
        <Upload aria-hidden className="size-5 text-brand-ink" />
        {t('upload.title')}
      </h2>
      {cards.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-on-surface-variant">
            {t('upload.noCards')}
          </p>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/accounts">{t('upload.addCard')}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Combobox
            label={t('upload.card')}
            options={cards}
            value={accountId || undefined}
            onChange={(value) => {
              setAccountId(value ?? '');
              setError(null);
            }}
            placeholder={t('upload.cardPlaceholder')}
            searchPlaceholder={t('upload.cardPlaceholder')}
            emptyText={t('upload.noCards')}
            disabled={uploading}
          />
          <FileDropzone
            accept={STATEMENT_ACCEPT}
            maxSizeBytes={MAX_UPLOAD_BYTES}
            value={file ? [file] : []}
            onChange={(files) => {
              setFile(files[0] ?? null);
              setError(null);
            }}
            disabled={uploading}
            title={t('upload.dropTitle')}
            description={t('upload.dropHint')}
            dragActiveText={t('upload.dragActive')}
            removeLabel={(name) => t('upload.removeFile', { name })}
            tooLargeText={(name, max) => t('upload.tooLarge', { name, max })}
            wrongTypeText={(name) => t('upload.wrongType', { name })}
            className="[&>button]:min-h-28 [&>button]:py-4"
          />
          {error ? (
            <p role="alert" className="text-sm text-expense">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={uploading}>
            {uploading ? t('upload.uploading') : t('upload.submit')}
          </Button>
        </form>
      )}
    </Card>
  );
}
