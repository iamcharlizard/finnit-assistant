'use client';

import { CloudOff } from 'lucide-react';

import { Button } from '@finnit/ui/components/ui/button';

/** A screen whose data could not load (API down or an error answer). */
export default function AppError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center"
    >
      <CloudOff aria-hidden className="size-10 text-on-surface-variant/60" />
      <p className="text-base font-medium text-on-background">
        No pudimos cargar tus datos
      </p>
      <p className="text-sm text-on-surface-variant">
        Revisa tu conexión e intenta de nuevo en un momento.
      </p>
      <Button variant="outline" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
