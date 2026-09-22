import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineRule, relativePath, walk } from '../authoring.mjs'

/**
 * A file that can hold an invariant: a test or a validator.
 *
 * Some invariants are held by the repository's own linter rather than a test.
 * That is an executable check in exactly the sense that matters here, so the
 * tag is looked for in validators too: otherwise the rule would force a second,
 * weaker test to be written purely to satisfy itself.
 */
const HOLDER = /(\.(test|spec)\.[cm]?[jt]sx?|validate-[a-z-]+\.mjs)$/

/** `@invariant 6`, `@invariant 6, 7`, `@invariant 41-43`. */
const TAG = /@invariant\s+([0-9]+(?:\s*[-,]\s*[0-9]+)*)/g

/**
 * Reads the numbered list. Returns number -> first line of text.
 *
 * The heading match is what scopes this to the right list: the strategy
 * document contains other numbered lists, and without the scope they would all
 * be read as invariants.
 */
export function parseInvariants(markdown) {
  const invariants = new Map()
  let inside = false

  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) {
      inside = line.includes('Invariants')
      continue
    }
    if (!inside) continue
    const numbered = /^(\d+)\.\s+(.*)$/.exec(line)
    if (numbered?.[1]) {
      invariants.set(Number(numbered[1]), (numbered[2] ?? '').trim())
    }
  }
  return invariants
}

/** Expands `41-43` and `6, 7` into numbers. */
export function numbersIn(expression) {
  const found = new Set()
  for (const part of expression.split(',')) {
    const range = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(part)
    if (range?.[1] && range[2]) {
      const from = Number(range[1])
      const to = Number(range[2])
      // An inverted range is a typo, not an empty set.
      if (to >= from) {
        for (let n = from; n <= to; n += 1) found.add(n)
      }
      continue
    }
    const single = Number(part.trim())
    if (Number.isInteger(single)) found.add(single)
  }
  return found
}

/** Every tag in the repository: number -> the files claiming to hold it. */
export function collectTags(files, read = (file) => readFileSync(file, 'utf8')) {
  const claims = new Map()
  for (const file of files) {
    for (const match of read(file).matchAll(TAG)) {
      for (const number of numbersIn(match[1] ?? '')) {
        const holders = claims.get(number) ?? []
        holders.push(file)
        claims.set(number, holders)
      }
    }
  }
  return claims
}

/**
 * Checked in **both** directions, because both failures are silent.
 *
 * An invariant with no tag is a promise nobody keeps. A tag pointing at a
 * number that does not exist is worse: it means the list was renumbered under
 * the tags, so every tag after the edit points at someone else's promise while
 * the map still reads as complete.
 */
export function auditInvariants(invariants, claims, unheld, describe = (file) => file) {
  const errors = []

  for (const number of invariants.keys()) {
    if (claims.has(number)) continue
    if (unheld.has(number)) continue
    const text = invariants.get(number) ?? ''
    errors.push(
      `invariant ${number} names no test — "${text.slice(0, 70)}…". ` +
        `Tag a test with \`@invariant ${number}\` or record why nothing holds it`,
    )
  }

  for (const [number, holders] of claims) {
    if (invariants.has(number)) continue
    const where = holders.map(describe).slice(0, 3).join(', ')
    errors.push(
      `@invariant ${number} is claimed in ${where}, but no such invariant exists — ` +
        'the list was renumbered under the tags, and every tag after the edit ' +
        "points at someone else's promise",
    )
  }

  for (const number of unheld.keys()) {
    if (!invariants.has(number)) {
      errors.push(`the exemption list names invariant ${number}, which does not exist`)
    } else if (claims.has(number)) {
      errors.push(
        `invariant ${number} is both exempt and tagged — drop the exemption; ` +
          'a stale one hides the next gap',
      )
    }
  }

  return errors
}

/**
 * Every invariant names the test that holds it.
 *
 * The numbered list in the test strategy is the set of ways to lose money or
 * trust. Without this check the list stays prose: nobody can say which of them
 * are actually verified, and nothing will say so when one stops being.
 */
export const invariantsRule = defineRule({
  name: 'invariants',

  check({ root, config }) {
    const settings = config.invariants
    if (!settings) {
      return {
        errors: ['the invariants rule is enabled but there is no invariants configuration'],
        summary: '',
      }
    }

    const strategy = join(root, settings.strategy)
    if (!existsSync(strategy)) {
      return { errors: [`${settings.strategy} does not exist`], summary: '' }
    }

    const invariants = parseInvariants(readFileSync(strategy, 'utf8'))
    if (invariants.size === 0) {
      return {
        errors: [`${settings.strategy} has no numbered invariants under an "Invariants" heading`],
        summary: '',
      }
    }

    const files = settings.searchRoots.flatMap((base) =>
      walk(join(root, base), (entry) => HOLDER.test(entry)),
    )
    const claims = collectTags(files)
    const unheld = new Map(
      Object.entries(settings.unheld ?? {}).map(([number, why]) => [Number(number), why]),
    )
    const errors = auditInvariants(invariants, claims, unheld, (file) => relativePath(root, file))

    const exempt = unheld.size
    return {
      errors,
      summary:
        `Invariants are in order: ${invariants.size}, each named by a test or linter ` +
        `among ${files.length} file(s)${exempt > 0 ? `, ${exempt} recorded as unheld` : ''}.`,
    }
  },
})
