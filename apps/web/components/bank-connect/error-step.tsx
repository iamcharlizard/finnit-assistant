import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

export function ErrorStep({
  message,
  canRetry,
  onRetry,
}: {
  message: string;
  canRetry: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 py-6 text-center"
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-expense/10 text-expense">
        <TriangleAlert aria-hidden className="size-7" />
      </span>
      <TitleLg as="h2">No pudimos conectar tu banco</TitleLg>
      <BodyMd className="max-w-md text-on-surface-variant">{message}</BodyMd>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" asChild>
          <Link href="/settings/banks">Cerrar</Link>
        </Button>
        {canRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Intentar de nuevo
          </Button>
        ) : null}
      </div>
    </div>
  );
}
