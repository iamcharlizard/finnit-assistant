import * as React from 'react';
import { AccessibilityInfo, View, type HostInstance } from 'react-native';

import type { Rect } from '@finnit/core/onboarding/tour';

import {
  TourControlsContext,
  TourRegistryContext,
  type TourControls,
  type TourEndReason,
  type TourLabels,
  type TourRegistry,
  type TourStep,
} from './tour-context';
import { TourOverlay } from './tour-overlay';

/** How long a step waits for its element to appear (after opening its screen). */
const TARGET_TIMEOUT = 1500;
const RETRY_EVERY = 80;

interface TourProviderProps {
  steps: TourStep[];
  labels: TourLabels;
  /** Opens a step's `route` (the app's router: ui-native doesn't know it). */
  onNavigate?: (route: string) => void;
  /** Each time a step shows (e.g. a light haptic). */
  onStepChange?: (step: TourStep, index: number) => void;
  onEnd?: (reason: TourEndReason) => void;
  children: React.ReactNode;
}

function measure(
  ref: React.RefObject<HostInstance | null>,
): Promise<Rect | null> {
  return new Promise((resolve) => {
    const view = ref.current;
    if (!view) return resolve(null);
    view.measureInWindow((x, y, width, height) =>
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null),
    );
  });
}

const sameRect = (a: Rect, b: Rect) =>
  a === b ||
  (Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1);

/**
 * A guided tour over the real screens: each step opens its screen (if it
 * has a `route`), waits for its `TourTarget` to be laid out and highlights
 * it with a card. Wrap the screens and the bottom bar with it, so the
 * overlay covers them all; start it with `useTour().start()`.
 */
export function TourProvider({
  steps,
  labels,
  onNavigate,
  onStepChange,
  onEnd,
  children,
}: TourProviderProps) {
  const [index, setIndex] = React.useState<number | null>(null);
  // undefined: still looking for the step's element; null: none (card centered).
  const [target, setTarget] = React.useState<Rect | null | undefined>(null);
  const targets = React.useRef(
    new Map<string, React.RefObject<HostInstance | null>>(),
  );
  const currentTarget = React.useRef<string | undefined>(undefined);

  // Latest callbacks without re-creating the contexts.
  const latest = React.useRef({ onNavigate, onStepChange, onEnd, steps });
  React.useEffect(() => {
    latest.current = { onNavigate, onStepChange, onEnd, steps };
  });

  const remeasure = React.useCallback(async (id: string) => {
    const ref = targets.current.get(id);
    if (!ref || currentTarget.current !== id) return;
    const rect = await measure(ref);
    if (currentTarget.current !== id || !rect) return;
    setTarget((previous) =>
      previous && sameRect(previous, rect) ? previous : rect,
    );
  }, []);

  const registry = React.useMemo<TourRegistry>(
    () => ({
      register(id, ref) {
        targets.current.set(id, ref);
        if (currentTarget.current === id) void remeasure(id);
        return () => {
          if (targets.current.get(id) === ref) targets.current.delete(id);
        };
      },
      relayout(id) {
        void remeasure(id);
      },
    }),
    [remeasure],
  );

  // Show step `index`: open its screen, then wait for its element. Keyed by
  // the step's id, so new `steps` arrays (re-renders) don't restart it.
  const step = index === null ? null : steps[index];
  const stepId = step?.id;
  React.useEffect(() => {
    const step = index === null ? undefined : latest.current.steps[index];
    if (!step || index === null) return;
    let cancelled = false;
    currentTarget.current = step.target;
    setTarget(step.target ? undefined : null);
    if (step.route) latest.current.onNavigate?.(step.route);
    latest.current.onStepChange?.(step, index);
    AccessibilityInfo.announceForAccessibility(`${step.title}. ${step.body}`);
    if (!step.target) return;

    const id = step.target;
    const started = Date.now();
    const attempt = async () => {
      if (cancelled) return;
      const ref = targets.current.get(id);
      const rect = ref ? await measure(ref) : null;
      if (cancelled) return;
      if (rect) {
        setTarget(rect);
        // Screens settle after a push (headers, lists): look once more.
        setTimeout(() => void remeasure(id), 350);
        return;
      }
      if (Date.now() - started < TARGET_TIMEOUT) {
        setTimeout(() => void attempt(), RETRY_EVERY);
      } else {
        // Not on screen: explain it without the highlight.
        setTarget(null);
      }
    };
    // Give a new screen a frame to mount before looking.
    const frame = requestAnimationFrame(() => void attempt());
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [stepId, index, remeasure]);

  const stop = React.useCallback((reason: TourEndReason = 'skipped') => {
    currentTarget.current = undefined;
    setIndex(null);
    setTarget(null);
    latest.current.onEnd?.(reason);
  }, []);

  const controls = React.useMemo<TourControls>(
    () => ({
      active: index !== null,
      start: () => {
        if (latest.current.steps.length > 0) setIndex(0);
      },
      stop,
    }),
    [index, stop],
  );

  const next = () => {
    if (index === null) return;
    if (index >= steps.length - 1) stop('done');
    else setIndex(index + 1);
  };
  const back = () => {
    if (index !== null && index > 0) setIndex(index - 1);
  };

  return (
    <TourRegistryContext.Provider value={registry}>
      <TourControlsContext.Provider value={controls}>
        <View style={{ flex: 1 }}>
          {children}
          {step && index !== null ? (
            <TourOverlay
              step={step}
              index={index}
              total={steps.length}
              target={target}
              labels={labels}
              onNext={next}
              onBack={back}
              onSkip={() => stop('skipped')}
            />
          ) : null}
        </View>
      </TourControlsContext.Provider>
    </TourRegistryContext.Provider>
  );
}
