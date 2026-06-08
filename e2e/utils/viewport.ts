import type { ViewportSize } from "@playwright/test";

export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  mobileL: { width: 414, height: 896 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  desktopL: { width: 1440, height: 900 },
} as const satisfies Record<string, ViewportSize>;

export type ViewportName = keyof typeof VIEWPORTS;

export const TAILWIND_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;
