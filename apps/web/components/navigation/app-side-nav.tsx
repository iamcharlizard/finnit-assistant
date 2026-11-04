'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@finnit/ui/components/ui/tooltip';
import { cn } from '@finnit/ui/lib/utils';

import { BrandMark, BrandWordmark } from '@/components/brand/finnit-brand';
import { withLayoutTransition } from '@/components/navigation/layout-transition';
import { isEditable } from '@/components/navigation/use-sidebar-state';
import type { NavEntry, NavSection } from '@/lib/nav/sections';

export const SIDEBAR_ID = 'app-sidebar';

/*
 * Collapsed or expanded is drawn by CSS (the `rail-collapsed:` variant in
 * app/globals.css, from `data-pref`), so the server renders it right. The
 * sidebar shows from lg; below, the bottom bar takes over.
 *
 * Every row keeps the same left padding in both states, so while the width
 * animates the icons stay put and only the labels fade. Collapsed, the inner
 * width is 50px and a 20px icon with 15px of padding sits centered.
 */
const ROW =
  'flex min-h-11 items-center gap-3 rounded-chip pr-3 pl-[15px] text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50';

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none';

/** Fades in after the width opens; fades out at once when it closes. */
const FADE =
  'transition-[opacity,transform] duration-200 delay-100 rail-collapsed:delay-0 rail-collapsed:opacity-0';

/** A label that fades and slides out when the menu collapses. */
function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'truncate whitespace-nowrap',
        FADE,
        EASE,
        'rail-collapsed:pointer-events-none rail-collapsed:-translate-x-1',
      )}
    >
      {children}
    </span>
  );
}

/** Shows the row's name beside it while the menu is collapsed. */
function RowTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: React.ReactElement;
}) {
  /*
   * Controlled: Radix keeps a trigger's "open" state even while there is no
   * content (menu expanded), so on collapsing every row hovered or focused
   * meanwhile would pop up at once. It only opens while collapsed, and any
   * open state resets when the menu changes.
   */
  const [state, setState] = React.useState({ open: false, collapsed });
  if (state.collapsed !== collapsed) setState({ open: false, collapsed });
  const open = collapsed && state.collapsed === collapsed && state.open;

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) =>
        setState((s) => ({ ...s, open: collapsed && next }))
      }
    >
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {collapsed ? (
        <TooltipContent side="right" sideOffset={12}>
          {label}
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}

/**
 * Sidebar from lg up: a floating glass rail grouped by sections. A one-screen
 * section is a plain link named after the section; a bigger one gets a
 * heading above its links (a short divider when collapsed). Collapsed it
 * shows icons with tooltips; ⌘B / Ctrl+B toggles it.
 */
export function AppSideNav({
  sections,
  activeHref,
  onAddClick,
  collapsed: preferCollapsed,
  onToggle,
  className,
}: {
  sections: ReadonlyArray<NavSection>;
  activeHref: string | null;
  onAddClick: () => void;
  /** The user's choice from lg up. */
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const t = useTranslations('nav');
  const collapsed = preferCollapsed;

  // Animated reflow (e.g. the dashboard gains a column).
  const toggle = React.useCallback(
    () => withLayoutTransition(onToggle),
    [onToggle],
  );

  // ⌘B / Ctrl+B, only while the sidebar is shown (lg and up).
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== 'b' ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.shiftKey ||
        isEditable(event.target) ||
        !window.matchMedia('(min-width: 64rem)').matches
      ) {
        return;
      }
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  /*
   * The toggle lives in the brand row. Expanded, it sits after the title;
   * collapsed there is only room for the logo, so a button over the logo
   * expands the menu (it shows the "open" icon on hover/focus). With the
   * keyboard, focus moves to whichever button replaces the one pressed.
   */
  const expandRef = React.useRef<HTMLButtonElement>(null);
  const collapseRef = React.useRef<HTMLButtonElement>(null);
  const toggleFocus = React.useRef(false);
  React.useEffect(() => {
    if (!toggleFocus.current) return;
    toggleFocus.current = false;
    (collapsed ? expandRef : collapseRef).current?.focus();
  }, [collapsed]);
  const handleToggle = (event: React.MouseEvent) => {
    // Keyboard presses report detail 0; a mouse click keeps focus where it
    // lands, so the new button's tooltip doesn't pop up under the pointer.
    toggleFocus.current = event.detail === 0;
    toggle();
  };
  const toggleProps = {
    type: 'button' as const,
    onClick: handleToggle,
    'aria-expanded': !collapsed,
    'aria-controls': SIDEBAR_ID,
    'aria-keyshortcuts': 'Meta+B Control+B',
  };

  const link = (entry: NavEntry, label: string) => {
    const isActive = entry.href === activeHref;
    const Icon = entry.icon;
    return (
      <RowTooltip key={entry.href} collapsed={collapsed} label={label}>
        <Link
          href={entry.href}
          aria-current={isActive ? 'page' : undefined}
          className={cn(
            ROW,
            isActive
              ? 'bg-primary/15 text-on-background dark:bg-primary/20'
              : 'text-on-surface-variant hover:bg-accent hover:text-on-background',
          )}
        >
          <Icon
            aria-hidden
            className={cn('size-5 shrink-0', isActive && 'text-brand-ink')}
          />
          <RowLabel>{label}</RowLabel>
        </Link>
      </RowTooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={100}>
      {/* Takes the rail's width in the page. */}
      <div
        data-pref={preferCollapsed ? 'collapsed' : 'expanded'}
        className={cn(
          'relative w-64 transition-[width] duration-300 rail-collapsed:w-[76px]',
          EASE,
          className,
        )}
      >
        <aside
          id={SIDEBAR_ID}
          className={cn(
            '[view-transition-name:app-sidebar]',
            // Collapsed, a 38px radius makes both ends fully round (76px wide),
            // like the header and the bottom bar; the logo sits centered in
            // the top curve. A number, not rounded-full, so it animates.
            'glass absolute inset-y-0 left-0 z-40 flex w-64 flex-col gap-5 overflow-hidden rounded-card border border-glass-border bg-glass px-3 py-4 shadow-elevation transition-[width,border-radius] duration-300 rail-collapsed:w-[76px] rail-collapsed:rounded-[38px]',
            EASE,
          )}
        >
          <div className="group/brand relative flex items-center gap-3 px-[5px]">
            {/* Hidden while the expand button shows over it (hover or focus). */}
            <span className="flex size-10 shrink-0 items-center justify-center transition-opacity duration-150 group-has-[[data-expand]:hover]/brand:opacity-0 group-has-[[data-expand]:focus-visible]/brand:opacity-0">
              <BrandMark className="h-[35px] w-10" priority />
            </span>
            {/* Collapsed: the logo expands the menu. */}
            <RowTooltip collapsed={collapsed} label={t('expand')}>
              <button
                ref={expandRef}
                {...toggleProps}
                aria-label={t('expand')}
                data-expand
                className="invisible absolute -top-1 left-px flex size-12 items-center justify-center rounded-full bg-accent text-on-background opacity-0 outline-none transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 rail-collapsed:visible"
              >
                <PanelLeftOpen aria-hidden className="size-6" />
              </button>
            </RowTooltip>
            <span className={cn('flex shrink-0 items-center', FADE, EASE)}>
              <BrandWordmark className="h-6 w-auto" priority />
            </span>
            <button
              ref={collapseRef}
              {...toggleProps}
              aria-label={t('collapse')}
              title={t('collapse')}
              className={cn(
                'ml-auto flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant outline-none hover:bg-accent hover:text-on-background focus-visible:ring-[3px] focus-visible:ring-ring/50 rail-collapsed:invisible',
                FADE,
                EASE,
              )}
            >
              <PanelLeftClose aria-hidden className="size-5" />
            </button>
          </div>

          <RowTooltip collapsed={collapsed} label={t('newTransaction')}>
            <button
              type="button"
              onClick={onAddClick}
              className={cn(
                // A 44px circle collapsed, a pill expanded. The 3px margin and
                // 12px padding keep the icon where the other rows have theirs.
                'ml-[3px] flex h-11 w-[calc(100%-3px)] shrink-0 items-center gap-2 overflow-hidden rounded-full bg-primary pr-4 pl-3 text-sm font-medium text-primary-foreground outline-none transition-[width,opacity] duration-300 hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50 rail-collapsed:w-11 rail-collapsed:pr-0',
                EASE,
              )}
            >
              <Plus aria-hidden className="size-5 shrink-0" />
              <RowLabel>{t('newTransaction')}</RowLabel>
            </button>
          </RowTooltip>

          <nav
            aria-label={t('mainNavigation')}
            className="-mx-3 flex flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto px-3 [scrollbar-width:none]"
          >
            {sections.map((section) => {
              const [only] = section.items;
              if (section.items.length === 1 && only) {
                return link(only, t(`sections.${section.key}`));
              }
              const headingId = `nav-section-${section.key}`;
              return (
                <div
                  key={section.key}
                  role="group"
                  aria-labelledby={headingId}
                  className="mt-3 flex flex-col gap-1"
                >
                  {/* Heading (expanded) or a short divider (collapsed). */}
                  <div
                    className={cn(
                      'grid grid-rows-[1fr] transition-[grid-template-rows,opacity] duration-300 rail-collapsed:grid-rows-[0fr] rail-collapsed:opacity-0',
                      EASE,
                    )}
                  >
                    <span
                      id={headingId}
                      className="overflow-hidden px-3 pb-1 text-[11px] font-medium tracking-[0.15em] whitespace-nowrap text-on-surface-variant uppercase"
                    >
                      {t(`sections.${section.key}`)}
                    </span>
                  </div>
                  <span
                    aria-hidden
                    className={cn(
                      'ml-[15px] h-px w-0 bg-outline opacity-0 transition-[width,opacity] duration-300 rail-collapsed:mb-1 rail-collapsed:w-5 rail-collapsed:opacity-100',
                      EASE,
                    )}
                  />
                  {section.items.map((entry) =>
                    link(entry, t(`items.${entry.key}`)),
                  )}
                </div>
              );
            })}
          </nav>
        </aside>
      </div>
    </TooltipProvider>
  );
}
