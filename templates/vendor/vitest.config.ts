import { nodePreset } from '../../vitest.preset.js'

/*
 * Called, not passed. An earlier version of this template read
 * `export default nodePreset` — the function itself, uncalled — so a package
 * copied from it got no setup files at all and no network stub, and the one
 * hard rule of the test suite silently did not apply to it.
 */
export default nodePreset({
  hint: 'See docs/adr/0004-a-test-that-reaches-the-network-is-a-test-that-lies.md',
})
