/**
 * Motion tokens — the only place durations/springs/eases live. Import these
 * everywhere; never hardcode timing inline. (UI polish §1)
 */

/** Durations in seconds (motion/react convention). */
export const DUR = {
  /** hovers, presses, toggles */
  fast: 0.15,
  /** reveals, fades, chips */
  base: 0.25,
  /** drawers, sidebar, page-level */
  slow: 0.4,
} as const;

/** Spring for anything that moves position/size — snappy, no wobble. */
export const SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;

/** Easing for fades. */
export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade transition preset. */
export const fadeTransition = (duration: number = DUR.base) => ({ duration, ease: EASE });

/** CSS equivalents for places styled without motion/react. */
export const CSS_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
export const CSS_DUR = { fast: "150ms", base: "250ms", slow: "400ms" } as const;
