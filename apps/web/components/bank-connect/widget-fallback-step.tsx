'use client';

import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Site } from '@finnit/bank-connect';

import { Button } from '@finnit/ui/components/ui/button';
import { BodyMd, TitleLg } from '@finnit/ui/components/ui/typography';

interface SyncfyWidgetInstance {
  open(): void;
  close(): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
}
declare global {
  interface Window {
    SyncfyWidget?: new (params: {
      token: string;
      element: string;
      config: Record<string, unknown>;
    }) => SyncfyWidgetInstance;
  }
}

/** Only Syncfy's own assets may be loaded. */
const SYNCFY_ASSET = /^https:\/\/(www\.)?syncfy\.com\//;

function loadOnce(tag: 'script' | 'link', url: string): Promise<void> {
  if (!SYNCFY_ASSET.test(url))
    return Promise.reject(new Error('Unexpected widget URL'));
  const selector =
    tag === 'script' ? `script[src="${url}"]` : `link[href="${url}"]`;
  if (document.querySelector(selector)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el =
      tag === 'script'
        ? Object.assign(document.createElement('script'), {
            src: url,
            async: true,
          })
        : Object.assign(document.createElement('link'), {
            href: url,
            rel: 'stylesheet',
          });
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Could not load ${url}`));
    document.head.appendChild(el);
  });
}

/**
 * Banks (or security checks) the native form can't handle open Syncfy's own
 * widget, still inside Finnit. When it succeeds, the flow registers the
 * credential it created.
 */
export function WidgetFallbackStep({
  site,
  idCredential,
  token,
  widgetScriptUrl,
  widgetStylesheetUrl,
  onConnected,
  onBack,
}: {
  site: Site;
  idCredential?: string;
  token: string;
  widgetScriptUrl: string;
  widgetStylesheetUrl: string;
  onConnected: (idCredential: string) => void;
  onBack: () => void;
}) {
  const [failed, setFailed] = React.useState(false);
  const onConnectedRef = React.useRef(onConnected);
  onConnectedRef.current = onConnected;

  React.useEffect(() => {
    let widget: SyncfyWidgetInstance | undefined;
    let cancelled = false;
    Promise.all([
      loadOnce('link', widgetStylesheetUrl),
      loadOnce('script', widgetScriptUrl),
    ])
      .then(() => {
        if (cancelled || !window.SyncfyWidget) return;
        widget = new window.SyncfyWidget({
          token,
          element: '#syncfy-widget',
          config: {
            locale: 'es',
            entrypoint: idCredential
              ? { credential: idCredential }
              : { site: site.id_site },
            navigation: {
              displayBusinessSites: false,
              enableBackNavigation: false,
              oneSiteFlow: true,
            },
          },
        });
        widget.on('success', (credential) => {
          const id = (credential as { id_credential?: string } | undefined)
            ?.id_credential;
          if (id) onConnectedRef.current(id);
        });
        widget.open();
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      widget?.close();
    };
  }, [token, widgetScriptUrl, widgetStylesheetUrl, site.id_site, idCredential]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <TitleLg as="h2">{site.name}</TitleLg>
        <BodyMd className="mt-1 text-[13px] text-on-surface-variant">
          Este banco se conecta con el asistente de Syncfy. Tus datos van
          directo a Syncfy; Finnit no los ve.
        </BodyMd>
      </div>
      {failed ? (
        <BodyMd role="alert" className="text-expense">
          No pudimos abrir el asistente de Syncfy. Intenta de nuevo más tarde.
        </BodyMd>
      ) : null}
      <div id="syncfy-widget" className="min-h-[420px]" />
      <Button variant="ghost" className="self-start" onClick={onBack}>
        <ArrowLeft className="size-4" /> Elegir otro banco
      </Button>
    </div>
  );
}
