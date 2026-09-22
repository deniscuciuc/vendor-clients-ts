import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/*
 * Absolute so it resolves the same from every package directory: Vitest
 * resolves `setupFiles` against the project root, and each package is its own
 * project.
 */
const REFUSE_FETCH = fileURLToPath(new URL('./test-setup/refuse-fetch.ts', import.meta.url))

/**
 * The shared package preset.
 *
 * `unstubGlobals` is mandatory: the stub is installed once per file, and a test
 * that deliberately substitutes `fetch` does so through `vi.stubGlobal`.
 * Without restoring, that substitution would leak into the next test and the
 * stub would stop guaranteeing anything.
 *
 * `*.integration.test.ts` is excluded. These are not "slow tests" but tests
 * needing something an ordinary run does not have. Keeping them in the common
 * set would mean requiring that on every commit — and finding out not on your
 * own machine, where it has long been installed, but on a clean runner.
 *
 * @param hint appended to the network-escape message: the repository knows the
 *   link to its own ADR, a shared preset does not.
 */
export function nodePreset(options: { hint?: string } = {}) {
  const { hint } = options

  return defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
      setupFiles: [REFUSE_FETCH],
      unstubGlobals: true,
      passWithNoTests: true,
      ...(hint ? { env: { VENDOR_CLIENTS_NETWORK_HINT: hint } } : {}),
    },
  })
}
