'use client';

import * as React from 'react';
import { ChevronRight, Landmark, Search } from 'lucide-react';
import { isNativeSupported, type Site } from '@finnit/bank-connect';

import { InputWithIcon } from '@finnit/ui/components/ui/input-with-icon';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

export function BankPickerStep({
  search,
  onSelect,
}: {
  search: (query: string) => Site[];
  onSelect: (site: Site) => void;
}) {
  const [query, setQuery] = React.useState('');
  const banks = search(query);

  return (
    <div className="flex flex-col gap-5">
      <TitleLg as="h2">Elige tu banco</TitleLg>
      <InputWithIcon
        label="Buscar banco"
        iconLeft={Search}
        placeholder="Ej. BancaNet, BBVA, Banorte"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />

      {banks.length === 0 ? (
        <BodyMd className="py-6 text-center text-on-surface-variant">
          No encontramos bancos con “{query}”.
        </BodyMd>
      ) : (
        <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
          {banks.map((site) => (
            <li key={site.id_site}>
              <button
                type="button"
                onClick={() => onSelect(site)}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-track px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Landmark
                  aria-hidden
                  className="size-5 shrink-0 text-brand-ink"
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-on-background">
                    {site.name}
                  </span>
                  {!isNativeSupported(site) ? (
                    <span className="block text-xs text-on-surface-variant">
                      Se conecta con el asistente de Syncfy
                    </span>
                  ) : null}
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-4 text-on-surface-variant"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
