import { Fraunces, Inter } from "next/font/google";

// The two families DESIGN.md commits to. Both are loaded as variable fonts and
// applied on <html> by the root layout, so every route gets them.
//
// Inter deliberately has no `weight` array. Passing one makes next/font fetch a
// separate static instance per weight (~47 KB each for the latin subset); the
// variable file is ~47 KB total and covers the whole 100-900 axis. Adding
// `weight` back would multiply the body-font payload by the number of cuts.
export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  axes: ["opsz"],
});
