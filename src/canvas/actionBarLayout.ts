/**
 * Shared layout constants for the on-selection HTML action bars (items and
 * boards). Kept in one place so the two bars cannot drift apart on gap, margin,
 * mobile breakpoint, or the reserved bottom-tab height.
 */
export const ACTION_BAR_GAP = 10;
export const ACTION_BAR_MARGIN = 8;
export const ACTION_BAR_MOBILE_MEDIA = "(max-width: 1023px)";
/** Mobile picker bottom tab bar height (px) the bars must clear. */
export const ACTION_BAR_TAB_BAR_HEIGHT = 56;

/** Compact cable-ink trigger + popover breakpoint (distinct from the tab-bar one). */
export const INK_POPOVER_MEDIA = "(max-width: 640px)";
export const INK_POPOVER_WIDTH = 206;
export const INK_POPOVER_HEIGHT = 132;
