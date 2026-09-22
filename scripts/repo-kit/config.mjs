import { existsSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { apiRule } from './rules/api.mjs'
import { docsRule } from './rules/docs.mjs'
import { invariantsRule } from './rules/invariants.mjs'

export const CONFIG_FILE = 'repo-check.config.mjs'

export async function loadConfig(root) {
  const file = join(root, CONFIG_FILE)
  if (!existsSync(file)) {
    throw new Error(`no ${CONFIG_FILE} in ${root}`)
  }
  const module = await import(pathToFileURL(file).href)
  if (!module.default) {
    throw new Error(`${CONFIG_FILE} has no default export`)
  }
  return module.default
}

/**
 * Which rules are enabled.
 *
 * A built-in rule is enabled by the presence of its own settings — otherwise
 * the list of enabled rules would have to be kept separately from their
 * settings, and the two would drift apart. `api` is always on: every
 * repository here has packages.
 */
export async function resolveRules(root, config) {
  const rules = [apiRule]
  if (config.docs) rules.push(docsRule)
  if (config.invariants) rules.push(invariantsRule)

  for (const path of config.rules ?? []) {
    const file = isAbsolute(path) ? path : resolve(root, path)
    const module = await import(pathToFileURL(file).href)
    if (!module.default) {
      throw new Error(`${path} has no default rule export`)
    }
    rules.push(module.default)
  }

  return rules
}
