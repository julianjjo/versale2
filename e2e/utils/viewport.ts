import type { ViewportSize } from "@playwright/test";

export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const satisfies Record<string, ViewportSize>;

export type ViewportName = keyof typeof VIEWPORTS;
