import { LoaderCircle } from 'lucide-react';

import { BodyMd } from '@finnit/ui/components/ui/typography';

/** Waiting state (loading banks, logging in to the bank, saving…). */
export function ProgressStep({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-4 py-10 text-center"
    >
      <LoaderCircle
        aria-hidden
        className="size-10 animate-spin text-accent-neon"
      />
      <BodyMd className="font-medium text-on-background">{message}</BodyMd>
      {hint ? (
        <BodyMd className="max-w-sm text-[13px] text-on-surface-variant">
          {hint}
        </BodyMd>
      ) : null}
    </div>
  );
}
