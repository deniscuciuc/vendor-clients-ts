import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'

/**
 * Directories no rule descends into.
 *
 * `node_modules` is someone else's code; `dist` is generated. A rule reading
 * either finds its own examples quoted back at it.
 */
export const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '.turbo',
  '.git',
  'coverage',
  'generated',
])

/** Path from the repository root, always with `/`. */
export function relativePath(root, file) {
  return relative(root, file).split(sep).join('/')
}

/** Walk a tree, selecting by file name. */
export function walk(target, accept, files = []) {
  if (!existsSync(target)) return files
  for (const entry of readdirSync(target)) {
    if (IGNORED_DIRECTORIES.has(entry)) continue
    const path = join(target, entry)
    if (statSync(path).isDirectory()) walk(path, accept, files)
    else if (accept(entry)) files.push(path)
  }
  return files
}

/** A package's sources: `.ts` and `.tsx`, tests excluded. */
export function sourceFiles(dir) {
  return walk(
    dir,
    (entry) =>
      /\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry) && !entry.endsWith('.d.ts'),
  )
}

/**
 * Text with comments removed.
 *
 * A rule searching for a word in identifiers has to drop comments first:
 * otherwise it catches the word in the explanation of why the word is not
 * there, and the only way to pass the check is to stop explaining.
 */
export function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** One package's manifest. `null` if the folder is not a package. */
export function readPackageManifest(dir) {
  const manifestPath = join(dir, 'package.json')
  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) return null

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const folder = basename(dir)

  return {
    folder,
    dir,
    name: typeof manifest.name === 'string' ? manifest.name : folder,
    manifest,
    dependencies: {
      ...(manifest.dependencies ?? {}),
      ...(manifest.peerDependencies ?? {}),
    },
    allDependencies: {
      ...(manifest.dependencies ?? {}),
      ...(manifest.peerDependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    },
  }
}

/** Package manifests under a directory. A folder without `package.json` is skipped. */
export function packageManifests(dir) {
  if (!existsSync(dir)) return []
  const found = []

  for (const folder of readdirSync(dir)) {
    const manifest = readPackageManifest(join(dir, folder))
    if (manifest) found.push(manifest)
  }

  return found
}

/**
 * Declare a rule.
 *
 * A rule is a function from the repository tree to a list of problems. No rule
 * calls `process.exit` and none of them print: otherwise it could not be
 * checked by a test without starting a process — and a rule that has never
 * been made to fail is a rule nobody knows works at all.
 */
export function defineRule(rule) {
  return rule
}
