#!/usr/bin/env node
/**
 * This repository's house rules for a vendor package, as a linter.
 *
 * The rules are written down in AGENTS.md too, but a written rule is obeyed
 * right up until the first rush. Here they are checked mechanically, and that
 * is the only thing keeping a fifth package from drifting away from the four —
 * and it would drift not out of malice but because the template gets copied
 * while the document gets read once.
 *
 * Every rule answers "what breaks if you don't do this"; the answer sits next
 * to the rule rather than in the commit history.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineRule, packageManifests, sourceFiles } from '../repo-kit/index.mjs'

const SCOPE = '@deniscuciuc/'

/** The one file allowed to reach the network. */
const TRANSPORT = 'transport.ts'

/** The fixtures directory exists and has something in it. */
function hasRecordedFixtures(dir) {
  return existsSync(dir) && readdirSync(dir).some((entry) => !entry.startsWith('.'))
}

/**
 * The checks for one package.
 *
 * Lifted out of `main` so that every rule can have a failing test: a rule that
 * has never been made to fail is a rule nobody knows works at all.
 */
export function auditPackage(
  name,
  { manifest, files, read, hasVendorDoc, hasReadme, hasFixtures },
) {
  const errors = []
  const at = (rule) => `packages/${name}: ${rule}`

  if (manifest.name !== `${SCOPE}${name}`) {
    errors.push(at(`package name "${manifest.name}" does not match the folder`))
  }

  // A package has to be installable on its own: one dependency on something of
  // ours and version coordination appears, the absence of which was the whole
  // point (ADR-0001).
  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    if (dependency.startsWith(SCOPE)) {
      errors.push(at(`depends on ${dependency}; a vendor package depends on nothing of ours`))
    }
  }
  /*
   * No exception for tooling any more. The shared tsconfig and the Vitest
   * preset used to be published packages in this scope; they are now files in
   * this repository, reached by a relative path. So there is no longer any
   * `@deniscuciuc/*` a vendor package may legitimately hold, and the rule is
   * strictly stronger than the version that carried an allowlist.
   */
  for (const dependency of Object.keys(manifest.devDependencies ?? {})) {
    if (dependency.startsWith(SCOPE)) {
      errors.push(
        at(`holds ${dependency} in devDependencies; the tooling lives in this repository as files`),
      )
    }
  }

  // Publishing: without these fields the tarball goes nowhere useful.
  if (manifest.publishConfig?.access !== 'public') {
    errors.push(at('no publishConfig.access: "public"; the first scoped publish fails with 402'))
  }
  if (manifest.license !== 'MIT') {
    errors.push(at(`license is "${manifest.license}" but the repository is MIT`))
  }
  if (manifest.repository?.directory !== `packages/${name}`) {
    errors.push(at('no repository.directory; npm will not link the package to its source'))
  }
  if (!Array.isArray(manifest.files) || !manifest.files.includes('dist')) {
    errors.push(at('no files: ["dist"]'))
  }
  if (!manifest.exports?.['.']) errors.push(at('no exports["."]'))
  if (!manifest.description) errors.push(at('no description; it is what npm search shows'))
  if (manifest.private) errors.push(at('marked private and will never publish'))

  if (!hasReadme) errors.push(at('no README.md'))
  if (!hasVendorDoc) {
    errors.push(at(`no docs/vendors/${name}.md describing the source, its quotas and its quirks`))
  }
  /*
    Fixtures are recorded vendor responses, the only source of network-shaped
    data in the tests (ADR-0004). Non-emptiness is checked rather than the
    directory's existence: git does not track empty directories, so a "the
    directory is there" rule would pass locally and fail in CI — which is
    exactly how it failed on the first run after it was added.
  */
  if (!hasFixtures) errors.push(at('no recorded responses in test/fixtures/'))

  let sawSpecVersion = false

  for (const file of files) {
    const relative = file.replace(/\\/g, '/').split(`/packages/${name}/`)[1] ?? file
    const contents = read(file)

    /*
     * Tests are skipped here and not only at the entry point: `sourceFiles`
     * does not hand them over anyway, but `auditPackage` is a pure function of
     * a file list, and relying on the caller having filtered already would
     * break the rule on the first new caller.
     */
    if (file.endsWith('.test.ts')) continue

    // Credentials arrive as arguments. A package that reads the environment
    // knows where it is deployed — and stops being usable anywhere else
    // (ADR-0003).
    if (/\bprocess\.env\b/.test(contents)) {
      errors.push(at(`${relative}: reads process.env; credentials arrive as arguments`))
    }

    // The network lives in one file. Otherwise "pass a fake transport" stops
    // being true, and a test starts depending on the vendor being alive
    // (ADR-0002).
    if (/\bfetch\s*\(/.test(contents) && !relative.endsWith(TRANSPORT)) {
      errors.push(at(`${relative}: calls fetch outside ${TRANSPORT}`))
    }

    if (relative.endsWith('index.ts') && /^\s*export\s+\*/m.test(contents)) {
      // The surface has to be explicit, or the API snapshot has nothing to
      // compare and a breaking change rides out in a minor version.
      errors.push(at('index.ts uses export *; list the exports explicitly'))
    }

    // Either a version in the base URL or a date the spec was checked against.
    // maib has `/v1`; the banks have no version at all — and then the date is
    // required, or the format changes one day and nobody remembers what we
    // were ever looking at.
    if (relative.endsWith('endpoints.ts')) {
      if (/_BASE_URL\s*=\s*'[^']*\/v\d+/.test(contents)) sawSpecVersion = true
      if (/_SPEC_CHECKED\s*=\s*'\d{4}-\d{2}-\d{2}'/.test(contents)) sawSpecVersion = true
    }
  }

  if (files.some((file) => file.replace(/\\/g, '/').endsWith('/endpoints.ts')) && !sawSpecVersion) {
    errors.push(
      at('endpoints.ts declares neither an API version in the URL nor a dated _SPEC_CHECKED'),
    )
  }

  return errors
}

/**
 * The house rules stay here; walking and reporting live in the engine.
 *
 * The rule returns a list of problems and prints nothing: otherwise it could
 * not be checked without starting a process.
 */
export default defineRule({
  name: 'vendors',

  check({ root, config }) {
    const packagesDir = join(root, config.packagesDir ?? 'packages')
    const docsVendors = join(root, 'docs', 'vendors')
    const found = packageManifests(packagesDir)
    const errors = []

    for (const pkg of found) {
      errors.push(
        ...auditPackage(pkg.folder, {
          manifest: pkg.manifest,
          files: sourceFiles(join(pkg.dir, 'src')),
          read: (file) => readFileSync(file, 'utf8'),
          hasVendorDoc: existsSync(join(docsVendors, `${pkg.folder}.md`)),
          hasReadme: existsSync(join(pkg.dir, 'README.md')),
          hasFixtures: hasRecordedFixtures(join(pkg.dir, 'test', 'fixtures')),
        }),
      )
    }

    const names = found.map((pkg) => pkg.folder)
    return {
      errors,
      summary: `Vendor packages are in order: ${names.length} (${names.join(', ')}).`,
    }
  },
})
