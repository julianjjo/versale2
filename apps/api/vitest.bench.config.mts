import { defineConfig } from 'vitest/config';
import codspeedPlugin from '@codspeed/vitest-plugin';

// The API test suite runs on jest; vitest is only used to drive the
// CodSpeed benchmarks, so it gets its own config and never touches
// `npm test`.
export default defineConfig({
  plugins: [codspeedPlugin()],
  test: {
    environment: 'node',
    include: [],
    benchmark: {
      include: ['bench/**/*.bench.ts'],
    },
  },
});
