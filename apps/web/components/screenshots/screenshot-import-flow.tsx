'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { toast } from '@finnit/ui/components/ui/toaster';

import { ReceiptCapture } from '@/components/receipts/receipt-capture';
import { ReceiptReadFailed } from '@/components/receipts/receipt-read-failed';
import { ReceiptReading } from '@/components/receipts/receipt-reading';
import { useImportReader } from '@/hooks/use-import-reader';
import { gql } from '@/lib/graphql/client';
import type { EntryAccount, EntryCategory } from '@/lib/new-entry/graphql';
import { leftoverReceiptId } from '@/lib/receipts/reader';
import { uploadImage } from '@/lib/receipts/upload';
import {
  CONFIRM_SCREENSHOT_MUTATION,
  DISCARD_SCREENSHOT_MUTATION,
  SCREENSHOT_IMPORT_QUERY,
  SET_SCREENSHOT_ACCOUNT_MUTATION,
  UPDATE_SCREENSHOT_LINE_MUTATION,
  type ScreenshotImport,
  type ScreenshotLineChange,
} from '@/lib/screenshots/graphql';
import { ScreenshotReview } from './screenshot-review';

export type ScreenshotPhase = 'capture' | 'reading' | 'failed' | 'review';

async function fetchScreenshot(id: string): Promise<ScreenshotImport> {
  const { screenshotImport } = await gql<{
    screenshotImport: ScreenshotImport;
  }>(SCREENSHOT_IMPORT_QUERY, { id });
  return screenshotImport;
}

const uploadScreenshot = (file: File, onProgress: (p: number) => void) =>
  uploadImage('/api/files/screenshots', file, onProgress);

/** Fire and forget: a screenshot nobody will review (left, failed). */
function discardQuietly(id: string) {
  void gql(DISCARD_SCREENSHOT_MUTATION, { id }).catch(() => undefined);
}

/**
 * "Importar captura" inside Nuevo movimiento: pick a screenshot of the
 * bank's movement list, the server reads it, the user reviews the account
 * and the movements, and saves them all at once.
 */
export function ScreenshotImportFlow({
  accounts,
  categories,
  onPhaseChange,
  onBusyChange,
  onManual,
  onDone,
}: {
  accounts: EntryAccount[];
  categories: EntryCategory[];
  onPhaseChange: (phase: ScreenshotPhase) => void;
  onBusyChange: (busy: boolean) => void;
  /** "Capturar a mano": the expense form. */
  onManual: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('screenshots');
  const [file, setFile] = React.useState<File | null>(null);
  const [shot, setShot] = React.useState<ScreenshotImport | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const reader = useImportReader<ScreenshotImport>({
    upload: uploadScreenshot,
    fetchImport: fetchScreenshot,
    onReady: setShot,
  });

  const phase: ScreenshotPhase = shot
    ? 'review'
    : reader.state.phase === 'reading' || reader.state.phase === 'ready'
      ? 'reading'
      : reader.state.phase === 'failed' && reader.state.receiptId !== null
        ? 'failed'
        : 'capture';
  React.useEffect(() => onPhaseChange(phase), [phase, onPhaseChange]);
  React.useEffect(
    () => onBusyChange(busy || reader.state.phase === 'uploading'),
    [busy, reader.state.phase, onBusyChange],
  );

  function pick(next: File) {
    setFile(next);
    setShot(null);
    void reader.read(next);
  }

  function startOver() {
    const leftover = leftoverReceiptId(reader.state);
    if (leftover && !shot) discardQuietly(leftover);
    setShot(null);
    setFile(null);
    setError(null);
    reader.reset();
  }

  function byHand() {
    const leftover = leftoverReceiptId(reader.state);
    if (leftover) discardQuietly(leftover);
    onManual();
  }

  async function run<T>(
    action: () => Promise<T>,
    failure: string,
  ): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      return await action();
    } catch {
      setError(failure);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function chooseAccount(accountId: string) {
    if (!shot || shot.account?.id === accountId) return;
    const next = await run(
      async () =>
        (
          await gql<{ setScreenshotAccount: ScreenshotImport }>(
            SET_SCREENSHOT_ACCOUNT_MUTATION,
            { id: shot.id, accountId },
          )
        ).setScreenshotAccount,
      t('errors.accountFailed'),
    );
    if (next) setShot(next);
  }

  async function changeLine(lineId: string, change: ScreenshotLineChange) {
    const next = await run(
      async () =>
        (
          await gql<{ updateScreenshotLine: ScreenshotImport }>(
            UPDATE_SCREENSHOT_LINE_MUTATION,
            { lineId, input: change },
          )
        ).updateScreenshotLine,
      t('errors.lineFailed'),
    );
    if (next) setShot(next);
    return next !== null;
  }

  async function save() {
    if (!shot) return;
    const count = shot.lines.filter((l) => l.status === 'pending').length;
    const saved = await run(
      () => gql(CONFIRM_SCREENSHOT_MUTATION, { id: shot.id }),
      t('errors.saveFailed'),
    );
    if (saved === null) return;
    toast.success(
      count > 0 ? t('toasts.saved', { count }) : t('toasts.savedNone'),
    );
    onDone();
  }

  async function discard() {
    if (!shot) return;
    const done = await run(
      () => gql(DISCARD_SCREENSHOT_MUTATION, { id: shot.id }),
      t('errors.discardFailed'),
    );
    if (done === null) return;
    toast.success(t('toasts.discarded'));
    startOver();
  }

  if (shot) {
    return (
      <ScreenshotReview
        shot={shot}
        accounts={accounts}
        categories={categories}
        busy={busy}
        error={error}
        onAccount={(id) => void chooseAccount(id)}
        onLine={changeLine}
        onSave={() => void save()}
        onDiscard={() => void discard()}
      />
    );
  }
  const state = reader.state;
  if (phase === 'reading') {
    return <ReceiptReading namespace="screenshots" onCancel={startOver} />;
  }
  if (state.phase === 'failed' && state.receiptId !== null) {
    return (
      <ReceiptReadFailed
        namespace="screenshots"
        reason={
          state.reason as
            | 'readFailed'
            | 'timeout'
            | 'discarded'
            | 'alreadyConfirmed'
        }
        onManual={byHand}
        onOtherPhoto={startOver}
        onKeepWaiting={reader.keepWaiting}
        onClose={onDone}
      />
    );
  }
  return (
    <ReceiptCapture
      namespace="screenshots"
      state={state}
      file={file}
      onPick={pick}
      onManual={byHand}
    />
  );
}
