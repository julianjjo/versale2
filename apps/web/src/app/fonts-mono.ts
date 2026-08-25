import { IBM_Plex_Mono } from "next/font/google";

// Kept in its own module, out of `fonts.ts` and out of the root layout, on
// purpose: next/font emits a <link rel="preload"> for a font on every route
// whose module graph references it. Declaring mono on <html> forced an eager
// ~28 KB download on all ~32 routes to serve the four that render a truncated
// order ID in it.
//
// Only those four pages import this, and each spreads `plexMono.variable` on
// its own root element. Routes that don't import it fall back to the system
// monospace stack via the `--font-mono` token in globals.css.
//
// IBM Plex Mono has no variable cut on Google Fonts, so the two weights the UI
// actually uses (400 and 500) stay listed explicitly.
export const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});
