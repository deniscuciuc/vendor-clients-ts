import { defineConfig } from 'vitest/config'

/**
 * The workspace root, and the only place coverage is configured: Vitest merges
 * the projects into one run and ignores `test.coverage` inside a project, so a
 * threshold written next to a package would silently do nothing.
 */
export default defineConfig({
  test: {
    projects: ['./packages/*/vitest.config.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '.turbo/**'],
    maxWorkers: 4,

    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      all: true,
      include: ['packages/*/src/**'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        // A barrel of re-exports: there is nothing in it to cover, and counting
        // it rewards splitting code into new barrels.
        '**/src/index.ts',
      ],
    },
  },
})
