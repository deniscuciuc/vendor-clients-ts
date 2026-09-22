/**
 * The repository rule engine, vendored in.
 *
 * This logic used to live in a private package pulled from GitHub Packages. A
 * public repository cannot carry a dependency nobody outside the organization
 * can install, so the engine moved here whole. The repository's own rule stayed
 * where it was: `scripts/rules/vendors.mjs`.
 */
export {
  defineRule,
  IGNORED_DIRECTORIES,
  packageManifests,
  readPackageManifest,
  relativePath,
  sourceFiles,
  walk,
  withoutComments,
} from './authoring.mjs'
export { run } from './cli.mjs'
export { CONFIG_FILE, loadConfig, resolveRules } from './config.mjs'
export { apiRule, compare, exportedNames } from './rules/api.mjs'
export { auditAdr, auditLinks, docsRule } from './rules/docs.mjs'
export {
  auditInvariants,
  collectTags,
  invariantsRule,
  numbersIn,
  parseInvariants,
} from './rules/invariants.mjs'
