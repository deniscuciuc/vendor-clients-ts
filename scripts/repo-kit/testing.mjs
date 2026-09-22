import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * A tree in a temporary directory.
 *
 * The rules read a real filesystem, and faking it here would mean testing the
 * fake: walking, `existsSync` and path resolution are half the work of every
 * rule, and they are exactly where a mistake goes unnoticed.
 */
export function makeTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'repo-check-'))
  for (const [path, contents] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, contents)
  }
  return root
}
