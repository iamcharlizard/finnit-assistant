'use client';

import * as React from 'react';

import { cn } from '@finnit/ui/lib/utils';

export interface HeroSlide {
  key: string;
  title: string;
  lead: string;
}

/** How long each slide stays, counting its fade in. */
const INTERVAL_MS = 5500;

/**
 * The hero's headline and lead, cycling through the ways to get movements
 * into Finnit (photo, screenshot, bank, AI) while the second line stays.
 * Every slide sits in the same grid cell, so the block is as tall as the
 * longest one and nothing below jumps. Screen readers and search engines
 * get `srTitle` (all of them at once) instead of the moving text.
 *
 * Pauses while hovered or focused; picking a slide stops it for good
 * (WCAG 2.2.2), and it never moves on its own with reduced motion.
 */
export function HeroRotator({
  slides,
  accent,
  srTitle,
  label,
  showLabel,
}: {
  slides: HeroSlide[];
  accent: string;
  srTitle: string;
  label: string;
  /** "Show: {title}" per dot, already translated. */
  showLabel: string[];
}) {
  const [active, setActive] = React.useState(0);
  const [hovered, setHovered] = React.useState(false);
  const [stopped, setStopped] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(true);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const playing = !hovered && !stopped && !reducedMotion;
  React.useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(
      () => setActive((i) => (i + 1) % slides.length),
      INTERVAL_MS,
    );
    return () => window.clearTimeout(id);
  }, [playing, active, slides.length]);

  // A relay, not a crossfade: the old text fades out first (600 ms), then
  // the new one fades in slowly (800 ms) once the old one is gone (600 ms
  // wait), with only a 4px drift: the two are never on screen together.
  const layer = (index: number) =>
    cn(
      '[grid-area:1/1] transition-[opacity,transform] motion-reduce:transition-none',
      index === active
        ? 'translate-y-0 opacity-100 delay-600 duration-800 ease-out'
        : 'pointer-events-none translate-y-1 opacity-0 delay-0 duration-600 ease-in',
    );

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <h1 className="mt-6 text-[38px] leading-[1.04] font-bold tracking-[-0.035em] text-on-background @lg:text-[56px] @4xl:text-[68px]">
        <span className="sr-only">{srTitle}</span>
        <span aria-hidden className="grid">
          {slides.map((slide, index) => (
            <span key={slide.key} className={layer(index)}>
              {slide.title}
            </span>
          ))}
        </span>
        <span
          aria-hidden
          className="block bg-gradient-to-r from-facet-3 via-facet-2 to-ai-ink bg-clip-text text-transparent [-webkit-box-decoration-break:clone]"
        >
          {accent}
        </span>
      </h1>

      <div className="mt-6 grid max-w-[34rem] text-lg leading-relaxed text-on-surface-variant">
        {slides.map((slide, index) => (
          <p
            key={slide.key}
            className={layer(index)}
            aria-hidden={index !== active}
          >
            {slide.lead}
          </p>
        ))}
      </div>

      <div
        role="group"
        aria-label={label}
        className="mt-5 flex items-center gap-2"
      >
        {slides.map((slide, index) => {
          const current = index === active;
          return (
            <button
              key={slide.key}
              type="button"
              aria-label={showLabel[index]}
              aria-pressed={current}
              onClick={() => {
                setActive(index);
                setStopped(true);
              }}
              className="group flex h-6 items-center outline-none"
            >
              <span
                className={cn(
                  'relative block h-1.5 overflow-hidden rounded-full transition-all duration-300 group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50',
                  current
                    ? 'w-10 bg-facet-2/25'
                    : 'w-1.5 bg-on-surface-variant/40 group-hover:bg-facet-2/60',
                )}
              >
                {current ? (
                  <span
                    // Restarts on every slide; full at once when not moving.
                    key={`${active}-${playing}`}
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full bg-facet-2',
                      playing ? 'landing-progress' : 'w-full',
                    )}
                    style={{ animationDuration: `${INTERVAL_MS}ms` }}
                  />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
