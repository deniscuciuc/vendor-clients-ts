import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineRule, packageManifests } from '../authoring.mjs'

const SNAPSHOT = 'api.snapshot.json'

/**
 * Names exported from `index.ts`.
 *
 * By parsing the barrel rather than the types: `index.ts` lists its exports
 * explicitly — that is a separate repository rule — so exactly one flat file
 * needs reading, and a full TypeScript parse for this would cost more.
 */
export function exportedNames(source) {
  const names = new Set()

  /*
   * `(?:type\s+)?` is not decorative: without it `export type { X } from …` is
   * invisible to the snapshot, and a publicly exported type could be removed
   * without the check that exists to force a major bump ever noticing. Found
   * exactly that way — `WebsharePlanUsage` was exported and unsnapshotted.
   */
  for (const [, body] of source.matchAll(/export\s*(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of (body ?? '').split(',')) {
      const cleaned = part.trim().replace(/^type\s+/, '')
      if (!cleaned) continue
      // `foo as bar` — the outside sees `bar`.
      const name = cleaned
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (name) names.add(name)
    }
  }

  for (const [, name] of source.matchAll(
    /export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/g,
  )) {
    if (name) names.add(name)
  }

  return [...names].sort()
}

export function compare(previous, current) {
  const errors = []
  for (const [name, before] of Object.entries(previous)) {
    const after = current[name]
    if (!after) {
      errors.push(`package ${name} vanished from the snapshot`)
      continue
    }
    for (const symbol of before) {
      if (!after.includes(symbol)) {
        errors.push(`${name}: export "${symbol}" removed or renamed — that is a major version`)
      }
    }
  }
  return errors
}

function collect(root, packagesDir) {
  const current = {}
  for (const pkg of packageManifests(join(root, packagesDir))) {
    const index = join(pkg.dir, 'src', 'index.ts')
    if (!existsSync(index)) continue
    current[pkg.folder] = exportedNames(readFileSync(index, 'utf8'))
  }
  return current
}

function counted(current) {
  const total = Object.values(current).reduce((sum, list) => sum + list.length, 0)
  return `${total} export(s) across ${Object.keys(current).length} package(s)`
}

/**
 * A snapshot of every package's public surface.
 *
 * These packages are published: someone who is not at the review installs
 * them, and a removed or renamed export breaks their build silently. The
 * snapshot makes such a change visible in the diff and forces it to be named
 * a major.
 *
 * Additive changes pass: a new export breaks nobody.
 */
export const apiRule = defineRule({
  name: 'api',

  check({ root, config }) {
    const packagesDir = config.packagesDir ?? 'packages'
    const current = collect(root, packagesDir)
    const errors = []

    for (const [name, symbols] of Object.entries(current)) {
      const file = join(root, packagesDir, name, SNAPSHOT)
      if (!existsSync(file)) {
        errors.push(`${packagesDir}/${name}: no ${SNAPSHOT}; run pnpm api:snapshot`)
        continue
      }
      const previous = JSON.parse(readFileSync(file, 'utf8'))
      errors.push(...compare({ [name]: previous }, { [name]: symbols }))
    }

    if (errors.length > 0) {
      errors.push('If the removal is deliberate, update the snapshot and raise the major.')
    }

    return { errors, summary: `Public contract intact: ${counted(current)}.` }
  },

  write({ root, config }) {
    const packagesDir = config.packagesDir ?? 'packages'
    const current = collect(root, packagesDir)
    for (const [name, symbols] of Object.entries(current)) {
      writeFileSync(
        join(root, packagesDir, name, SNAPSHOT),
        `${JSON.stringify(symbols, null, 2)}\n`,
      )
    }
    return { errors: [], summary: `Snapshot written: ${counted(current)}.` }
  },
})
