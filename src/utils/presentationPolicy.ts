import type { RuntimePlatform } from './platform';

export const DESKTOP_TO_MOBILE_BREAKPOINT = 720;
export const MOBILE_TO_DESKTOP_BREAKPOINT = 760;

export type Presentation = 'desktop' | 'mobile';
export type PresentationMode = 'auto' | 'force-desktop' | 'force-mobile';
export type MobileLayout = 'compact' | 'medium' | 'expanded';

export function isMobileRuntimePlatform(platform: RuntimePlatform): boolean {
  return platform === 'android' || platform === 'ios';
}

export function resolveInitialPresentation(
  mode: PresentationMode,
  runtime: RuntimePlatform,
  width: number,
): Presentation {
  if (isMobileRuntimePlatform(runtime)) return 'mobile';
  if (mode === 'force-mobile') return 'mobile';
  if (mode === 'force-desktop') return 'desktop';
  return width <= DESKTOP_TO_MOBILE_BREAKPOINT ? 'mobile' : 'desktop';
}

/** Apply the single hysteresis rule used by the root Presentation host. */
export function resolvePresentationForWidth(
  current: Presentation,
  mode: PresentationMode,
  runtime: RuntimePlatform,
  width: number,
): Presentation {
  if (isMobileRuntimePlatform(runtime)) return 'mobile';
  if (mode === 'force-mobile') return 'mobile';
  if (mode === 'force-desktop') return 'desktop';

  if (current === 'desktop' && width <= DESKTOP_TO_MOBILE_BREAKPOINT) return 'mobile';
  if (current === 'mobile' && width >= MOBILE_TO_DESKTOP_BREAKPOINT) return 'desktop';
  return current;
}

export function getMobileLayoutForWidth(width: number): MobileLayout {
  if (width <= 600) return 'compact';
  if (width < 960) return 'medium';
  return 'expanded';
}
