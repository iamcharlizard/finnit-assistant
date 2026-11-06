'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ArrowLeftRight,
  CircleArrowDown,
  CircleArrowUp,
  Ellipsis,
  Plus,
  ScanLine,
  Settings,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@finnit/ui/components/ui/sheet';
import { cn } from '@finnit/ui/lib/utils';

import type { NewEntryAction } from '@/components/new-entry/new-entry-flow';
import {
  BOTTOM_NAV_KEYS,
  SETTINGS_HREF,
  isBottomNavKey,
  type BottomNavKey,
  type NavEntry,
} from '@/lib/nav/sections';
import type { NavSection } from '@/lib/nav/sections';

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]';

/**
 * A round tab. On phones, icon only (the name is for screen readers); on
 * tablets in portrait (md), a larger circle with the name under the icon.
 */
const TAB =
  'relative z-10 flex size-14 shrink-0 flex-col items-center justify-center gap-1 rounded-full outline-none transition-[color,transform] duration-200 active:scale-90 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none motion-reduce:active:scale-100 md:size-[76px]';

const TAB_ICON = 'size-7 md:size-6';
const TAB_LABEL =
  'sr-only text-[10px] leading-none font-medium whitespace-nowrap md:not-sr-only';

/*
 * Bar geometry, phones and tablets (md): tab circles, the slot under the
 * "+" and the gaps; 8px padding and a 1px border around them. Must match
 * the classes on the bar (`gap-2 md:gap-4`, tab and slot sizes).
 *
 * The "+" is as big as the tabs and its center sits 2px below the bar's top
 * (so it sticks out). The cut-out around it: a hole 6px wider than the "+",
 * centered there, with 8px fillets where it meets the
 * top edge so those corners are round. Drawn as an SVG mask, 40px larger
 * than the bar on every side so its shadow isn't cut off.
 */
/** Space between the "+" and the bar. */
const NOTCH_GAP = 6;
const HOLE_CY = 2;
const FILLET = 8;
const MASK_PAD = 40;

function barGeometry(tab: number, slot: number, gap: number) {
  const widths = [tab, tab, slot, tab, tab];
  // Where each of the five slots starts, for the sliding highlight.
  const left = widths.map(
    (_, i) => widths.slice(0, i).reduce((sum, w) => sum + w, 0) + i * gap,
  );
  const width = widths.reduce((sum, w) => sum + w, 0) + 4 * gap + 2 * 8 + 2;
  const height = tab + 2 * 8 + 2;
  const holeR = tab / 2 + NOTCH_GAP;
  return { left, width, height, mask: notchMask(width, height, holeR) };
}

function notchMask(barW: number, barH: number, holeR: number): string {
  const cx = barW / 2 + MASK_PAD;
  const top = MASK_PAD;
  // Fillet centers sit FILLET below the edge, FILLET outside the hole.
  const reach = holeR + FILLET;
  const dx = Math.sqrt(reach ** 2 - (FILLET - HOLE_CY) ** 2);
  // Where each fillet touches the hole.
  const hx = (dx * holeR) / reach;
  const hy = top + HOLE_CY + ((FILLET - HOLE_CY) * holeR) / reach;
  const n = (v: number) => v.toFixed(3);
  const w = barW + 2 * MASK_PAD;
  const h = barH + 2 * MASK_PAD;
  const bite = [
    `M${n(cx - dx)} ${top}`,
    `A${FILLET} ${FILLET} 0 0 1 ${n(cx - hx)} ${n(hy)}`,
    `A${holeR} ${holeR} 0 0 0 ${n(cx + hx)} ${n(hy)}`,
    `A${FILLET} ${FILLET} 0 0 1 ${n(cx + dx)} ${top}`,
    `V0H${n(cx - dx)}Z`,
  ].join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path fill-rule="evenodd" d="M0 0H${w}V${h}H0Z${bite}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Phones: 56px tabs, 72px slot, 8px gaps (346 × 74: fits a 360px phone). */
const PHONE = barGeometry(56, 72, 8);
/** Tablets in portrait: 76px tabs with their names, 84px slot, 16px gaps (470 × 94). */
const TABLET = barGeometry(76, 84, 16);

/** The mask for each size, picked by CSS (`md:`), so the server renders it. */
const BAR_STYLE = {
  '--notch-phone': PHONE.mask,
  '--notch-tablet': TABLET.mask,
  '--notch-size-phone': `${PHONE.width + 2 * MASK_PAD}px ${PHONE.height + 2 * MASK_PAD}px`,
  '--notch-size-tablet': `${TABLET.width + 2 * MASK_PAD}px ${TABLET.height + 2 * MASK_PAD}px`,
  maskPosition: `-${MASK_PAD}px -${MASK_PAD}px`,
  maskRepeat: 'no-repeat',
  maskClip: 'no-clip',
} as React.CSSProperties;
const BAR_MASK =
  '[mask-image:var(--notch-phone)] [mask-size:var(--notch-size-phone)] md:[mask-image:var(--notch-tablet)] md:[mask-size:var(--notch-size-tablet)]';
const TAB_POP = 'animate-in zoom-in-75 duration-300 motion-reduce:animate-none';

/**
 * The "+" menu: five shortcuts spread over the screen's width in a wide,
 * flat arc above the button. `k` is the horizontal position in steps of
 * `--dial-step` (a share of the screen, capped), `y` the height in px above
 * the button's center; the outer ones sit lower.
 */
const ACTIONS: ReadonlyArray<{
  action: NewEntryAction;
  icon: LucideIcon;
  tone: string;
  k: number;
  y: number;
}> = [
  {
    action: 'expense',
    icon: CircleArrowUp,
    tone: 'text-expense',
    k: -2,
    y: -76,
  },
  {
    action: 'income',
    icon: CircleArrowDown,
    tone: 'text-income',
    k: -1,
    y: -124,
  },
  {
    action: 'transfer',
    icon: ArrowLeftRight,
    tone: 'text-violet-ink',
    k: 0,
    y: -144,
  },
  { action: 'receipt', icon: ScanLine, tone: 'text-brand-ink', k: 1, y: -124 },
  {
    action: 'screenshot',
    icon: Smartphone,
    tone: 'text-brand-ink',
    k: 2,
    y: -76,
  },
];

/**
 * Bottom bar on phones and tablets in portrait (< lg): a floating glass pill
 * with Inicio, Movimientos, Cuentas and "Más" (a sheet with every other
 * section), and a round "+" that sticks out of its middle. A highlight
 * slides under the active tab. The "+" turns into an × and fans out the
 * shortcuts (gasto, ingreso, transferencia, escanear ticket, importar
 * captura), each opening
 * "Nuevo movimiento" on that step.
 */
export function AppBottomNav({
  sections,
  activeHref,
  onAdd,
  className,
}: {
  sections: ReadonlyArray<NavSection>;
  activeHref: string | null;
  onAdd: (action: NewEntryAction) => void;
  className?: string;
}) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const tn = useTranslations('newEntry');
  const tr = useTranslations('receipts');
  const ts = useTranslations('screenshots');
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [dialOpen, setDialOpen] = React.useState(false);
  const fabRef = React.useRef<HTMLButtonElement>(null);
  const firstActionRef = React.useRef<HTMLButtonElement>(null);
  // Opened with the keyboard: move focus into the menu (not on a tap, where
  // it would only draw a focus ring on the first shortcut).
  const openedByKeyboard = React.useRef(false);
  const menuId = React.useId();

  const entries = sections.flatMap((s) =>
    s.items.map((entry) => ({ entry, section: s })),
  );
  const tabs = BOTTOM_NAV_KEYS.flatMap((key) => {
    const entry = entries.find((e) => e.entry.key === key)?.entry;
    return entry ? [{ ...entry, key }] : [];
  });
  const rest = entries.filter((e) => !isBottomNavKey(e.entry.key));
  const moreActive = rest.some((e) => e.entry.href === activeHref);

  // Five equal slots: two tabs, the "+" (no highlight), a tab and "Más".
  const slots = [tabs[0], tabs[1], null, tabs[2]];
  const tabSlot = slots.findIndex((tab) => tab?.href === activeHref);
  const activeSlot = tabSlot >= 0 ? tabSlot : moreActive ? 4 : -1;

  const closeDial = React.useCallback((refocus: boolean) => {
    setDialOpen(false);
    if (refocus) fabRef.current?.focus();
  }, []);

  // Open: focus the first shortcut (keyboard only); Escape closes and
  // returns to the "+".
  React.useEffect(() => {
    if (!dialOpen) return;
    if (openedByKeyboard.current) {
      firstActionRef.current?.focus({ preventScroll: true });
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDial(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dialOpen, closeDial]);

  const tab = (entry: NavEntry & { key: BottomNavKey }) => {
    const isActive = entry.href === activeHref;
    const Icon = entry.icon;
    return (
      <Link
        key={entry.href}
        href={entry.href}
        onClick={() => setDialOpen(false)}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          TAB,
          isActive ? 'text-brand-ink' : 'text-on-surface-variant',
        )}
      >
        {/* Remounts when it becomes active, so the "pop" plays each time. */}
        <Icon
          key={isActive ? 'on' : 'off'}
          aria-hidden
          className={cn(TAB_ICON, isActive && TAB_POP)}
        />
        <span className={TAB_LABEL}>{t(`short.${entry.key}`)}</span>
      </Link>
    );
  };

  return (
    <>
      {/* Behind the bar and the shortcuts: dims the page; a tap closes. */}
      <div
        aria-hidden
        onClick={() => closeDial(false)}
        className={cn(
          'fixed inset-0 z-30 bg-black/35 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none',
          dialOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          className,
        )}
      />

      <nav
        aria-label={t('mainNavigation')}
        className={cn(
          'fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto w-fit',
          className,
        )}
      >
        {/*
          As wide as its buttons, with the same 8px padding all round. A
          transparent circle is cut out around the "+" (CSS mask), so a
          curved gap shows the page between them. The mask is drawn 40px
          past the box (`no-clip`) so the bar's shadow isn't cut off.
        */}
        <div
          className={cn(
            'glass relative flex items-center gap-2 rounded-full border border-glass-border bg-glass p-2 shadow-elevation md:gap-4',
            BAR_MASK,
          )}
          style={BAR_STYLE}
        >
          {/* Sliding circle under the active tab. */}
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute top-2 left-2 size-14 translate-x-(--slot-phone) rounded-full bg-primary/15 transition-[translate,opacity] duration-300 motion-reduce:transition-none md:size-[76px] md:translate-x-(--slot-tablet) dark:bg-primary/20',
              EASE,
              activeSlot < 0 && 'opacity-0',
            )}
            style={
              {
                '--slot-phone': `${PHONE.left[Math.max(0, activeSlot)]}px`,
                '--slot-tablet': `${TABLET.left[Math.max(0, activeSlot)]}px`,
              } as React.CSSProperties
            }
          />

          {tabs.slice(0, 2).map(tab)}
          {/* The "+" sits over this slot. */}
          <span aria-hidden className="w-[72px] shrink-0 md:w-[84px]" />
          {tabs.slice(2).map(tab)}
          <button
            type="button"
            onClick={() => {
              setDialOpen(false);
              setMoreOpen(true);
            }}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              TAB,
              moreActive ? 'text-brand-ink' : 'text-on-surface-variant',
            )}
          >
            <Ellipsis
              key={moreActive ? 'on' : 'off'}
              aria-hidden
              className={cn(TAB_ICON, moreActive && TAB_POP)}
            />
            <span className={TAB_LABEL}>{t('more')}</span>
          </button>
        </div>

        {/* The "+" and its shortcuts, centered on the bar's top edge. */}
        <div className="absolute top-0 left-1/2">
          <div
            id={menuId}
            role="group"
            aria-label={t('addTransaction')}
            inert={!dialOpen}
            // A quarter of the screen per shortcut (less margins), at most
            // 112px: the arc spans the width on phones, stays compact on
            // tablets.
            style={{ '--dial-step': 'min(18vw, 104px)' } as React.CSSProperties}
          >
            {ACTIONS.map(({ action, icon: Icon, tone, k, y }, index) => {
              const label =
                action === 'receipt'
                  ? tr('scan')
                  : action === 'screenshot'
                    ? ts('import')
                    : tn(action);
              // Out one after another; back in the reverse order.
              const delay = dialOpen
                ? index * 40
                : (ACTIONS.length - 1 - index) * 25;
              return (
                <button
                  key={action}
                  ref={index === 0 ? firstActionRef : undefined}
                  type="button"
                  onClick={() => {
                    setDialOpen(false);
                    onAdd(action);
                  }}
                  className={cn(
                    'group absolute -mt-7 -ml-14 flex w-28 flex-col items-center gap-1.5 outline-none transition-[transform,opacity] duration-300 motion-reduce:transition-none',
                    EASE,
                    dialOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
                  )}
                  style={{
                    transform: dialOpen
                      ? `translate(calc(var(--dial-step) * ${k}), ${y}px) scale(1)`
                      : 'translate(0, 0) scale(0.3)',
                    transitionDelay: `${delay}ms`,
                  }}
                >
                  <span className="flex size-14 items-center justify-center rounded-full bg-surface shadow-elevation ring-1 ring-glass-border transition-transform duration-200 group-active:scale-90 group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50">
                    <Icon aria-hidden className={cn('size-7', tone)} />
                  </span>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-on-background shadow-sm">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            ref={fabRef}
            type="button"
            onClick={(event) => {
              // Keyboard presses report detail 0.
              openedByKeyboard.current = event.detail === 0;
              setDialOpen((open) => !open);
            }}
            aria-expanded={dialOpen}
            aria-controls={menuId}
            aria-label={dialOpen ? tc('close') : t('addTransaction')}
            className={cn(
              // Tab-sized: 56px (top = 2 − 28), 76px on tablets (2 − 38).
              'absolute -top-[26px] -left-7 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.16)] outline-none transition-transform duration-200 active:scale-90 focus-visible:ring-[3px] focus-visible:ring-ring/60 motion-reduce:transition-none md:-top-9 md:-left-[38px] md:size-[76px]',
            )}
          >
            <Plus
              aria-hidden
              className={cn(
                'size-7 transition-transform duration-300 motion-reduce:transition-none md:size-8',
                EASE,
                dialOpen && 'rotate-[135deg]',
              )}
            />
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          closeLabel={tc('close')}
          className="px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <div className="pr-12">
            <SheetTitle>{t('moreTitle')}</SheetTitle>
            <SheetDescription>{t('moreDescription')}</SheetDescription>
          </div>
          <ul className="flex flex-col gap-1">
            {rest.map(({ entry, section }) => {
              const isActive = entry.href === activeHref;
              const Icon = entry.icon;
              const label =
                section.items.length === 1
                  ? t(`sections.${section.key}`)
                  : t(`items.${entry.key}`);
              return (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex min-h-12 items-center gap-3 rounded-chip px-3 text-base font-medium outline-none transition-[background-color,color,transform] duration-200 active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      isActive
                        ? 'bg-primary/15 text-on-background'
                        : 'text-on-surface-variant hover:bg-accent hover:text-on-background',
                    )}
                  >
                    <Icon
                      aria-hidden
                      className={cn('size-5', isActive && 'text-brand-ink')}
                    />
                    {label}
                  </Link>
                </li>
              );
            })}
            {/* Settings also opens from the header's profile menu. */}
            <li className="mt-1 border-t border-outline/60 pt-2">
              <Link
                href={SETTINGS_HREF}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-12 items-center gap-3 rounded-chip px-3 text-base font-medium text-on-surface-variant outline-none transition-[background-color,color,transform] duration-200 hover:bg-accent hover:text-on-background focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98]"
              >
                <Settings aria-hidden className="size-5" />
                {t('settings')}
              </Link>
            </li>
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
