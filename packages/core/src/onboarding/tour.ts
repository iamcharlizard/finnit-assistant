/**
 * The guided tour's geometry: where the spotlight hole goes around a
 * highlighted element and where the explanation card fits. Pure, so the
 * mobile overlay only animates what this returns.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  bottom: number;
}

/** Room between the element and the hole's edge. */
export const SPOTLIGHT_PADDING = 8;
/** Space between the hole and the card. */
export const CARD_GAP = 12;
/** Side margin of the card. */
export const CARD_MARGIN = 16;

/** The hole around `target`, padded and kept inside the screen. */
export function spotlightRect(
  target: Rect,
  screen: { width: number; height: number },
  padding = SPOTLIGHT_PADDING,
): Rect & { radius: number } {
  const x = Math.max(0, target.x - padding);
  const y = Math.max(0, target.y - padding);
  const right = Math.min(screen.width, target.x + target.width + padding);
  const bottom = Math.min(screen.height, target.y + target.height + padding);
  const width = Math.max(0, right - x);
  const height = Math.max(0, bottom - y);
  // Round elements (tabs, the "+", the avatar) get a round hole.
  const square = Math.abs(target.width - target.height) < 2;
  const radius = square ? Math.min(width, height) / 2 : 16;
  return { x, y, width, height, radius };
}

export type CardSide = 'above' | 'below' | 'center';

/**
 * Below the hole when it fits, otherwise above; with no target (or when
 * neither fits) the card sits in the middle of the screen. `top` is the
 * card's top edge.
 */
export function cardPlacement({
  hole,
  cardHeight,
  screenHeight,
  insets,
  gap = CARD_GAP,
}: {
  hole: Rect | null;
  cardHeight: number;
  screenHeight: number;
  insets: Insets;
  gap?: number;
}): { side: CardSide; top: number } {
  const minTop = insets.top + gap;
  const maxBottom = screenHeight - insets.bottom - gap;
  const centered = {
    side: 'center' as const,
    top: Math.max(minTop, (screenHeight - cardHeight) / 2),
  };
  if (!hole) return centered;
  const below = hole.y + hole.height + gap;
  if (below + cardHeight <= maxBottom) return { side: 'below', top: below };
  const above = hole.y - gap - cardHeight;
  if (above >= minTop) return { side: 'above', top: above };
  return centered;
}

/** Whether a point (a tap) falls inside the hole. */
export function inside(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}
