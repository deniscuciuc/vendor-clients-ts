import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { defineRule, packageManifests, relativePath, walk } from '../authoring.mjs'

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

const DEFAULT_ROOT_DOCUMENTS = ['README.md', 'AGENTS.md', 'CLAUDE.md']

export function auditLinks(file, contents, exists, root) {
  const errors = []
  const base = dirname(file)

  for (const [, target] of contents.matchAll(MARKDOWN_LINK)) {
    if (!target) continue
    if (/^(https?:|mailto:|#)/.test(target)) continue
    const [path] = target.split('#')
    if (!path) continue
    if (!exists(resolve(base, path))) {
      errors.push(`${relativePath(root, file)}: broken link -> ${target}`)
    }
  }
  return errors
}

/** An ADR that never reached a decision is a draft pretending to be a record. */
export function auditAdr(name, contents) {
  const errors = []
  for (const heading of ['## Status', '## Context', '## Decision', '## Consequences']) {
    if (!contents.includes(heading)) errors.push(`${name}: no "${heading}" section`)
  }
  const status = /## Status\s*\n+\s*(\S+)/.exec(contents)?.[1]
  const allowed = ['Proposed', 'Accepted', 'Superseded', 'Deprecated']
  if (status && !allowed.includes(status)) {
    errors.push(`${name}: status "${status}" is not one of ${allowed.join(', ')}`)
  }
  return errors
}

/** Every markdown the rule reads: `docs/`, the root documents, package READMEs. */
function collectMarkdown(root, settings, packagesDir) {
  const files = walk(join(root, 'docs'), (entry) => entry.endsWith('.md'))
  const missing = []

  for (const name of settings.rootDocuments ?? DEFAULT_ROOT_DOCUMENTS) {
    const full = join(root, name)
    if (existsSync(full)) files.push(full)
    else missing.push(`${name} is missing`)
  }

  for (const pkg of packageManifests(packagesDir)) {
    const readme = join(pkg.dir, 'README.md')
    if (existsSync(readme)) files.push(readme)
  }

  return { files, missing }
}

/**
 * Keeps `docs/` honest: this repository does not use a wiki, and all of its
 * documentation lives in files.
 *
 * Checks that the required documents are present, that internal links lead
 * somewhere, and that an ADR reached a decision. The required list is
 * configuration: it has to differ between repositories.
 *
 * Package READMEs are link-checked too: they point out of the package into the
 * shared `docs/`, and they break first when a file moves.
 */
export const docsRule = defineRule({
  name: 'docs',

  check({ root, config }) {
    const settings = config.docs
    if (!settings) {
      return {
        errors: ['the docs rule is enabled but there is no docs configuration'],
        summary: '',
      }
    }

    const docs = join(root, 'docs')
    const errors = []

    for (const required of settings.required) {
      if (!existsSync(join(docs, required))) errors.push(`docs/${required} is missing`)
    }

    const { files, missing } = collectMarkdown(
      root,
      settings,
      join(root, config.packagesDir ?? 'packages'),
    )
    errors.push(...missing)

    for (const file of files) {
      const contents = readFileSync(file, 'utf8')
      errors.push(...auditLinks(file, contents, existsSync, root))

      const rel = relative(docs, file).split(sep).join('/')
      if (rel.startsWith('adr/') && /\d{4}-/.test(rel)) {
        errors.push(...auditAdr(`docs/${rel}`, contents))
      }
    }

    return {
      errors,
      summary: `Documentation is in order: ${files.length} file(s), links resolve, ADRs complete.`,
    }
  },
})
