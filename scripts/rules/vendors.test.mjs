import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { auditPackage } from './vendors.mjs'

/**
 * A rule that has never been made to fail is a rule nobody knows works at all.
 * One failing case per clause, here.
 */

const manifest = (over = {}) => ({
  name: '@deniscuciuc/example',
  description: "A client for someone else's API",
  license: 'MIT',
  files: ['dist'],
  exports: { '.': { default: './dist/index.js' } },
  repository: { directory: 'packages/example' },
  publishConfig: { access: 'public' },
  ...over,
})

const input = (over = {}) => ({
  manifest: manifest(),
  files: [],
  read: () => '',
  hasVendorDoc: true,
  hasReadme: true,
  hasFixtures: true,
  ...over,
})

const audit = (over) => auditPackage('example', input(over))
const has = (errors, fragment) => errors.some((error) => error.includes(fragment))

describe('a well-formed package', () => {
  it('passes', () => {
    assert.deepEqual(audit(), [])
  })
})

// @invariant 11
describe('dependencies', () => {
  it('refuses a runtime dependency on anything of ours', () => {
    const errors = audit({ manifest: manifest({ dependencies: { '@deniscuciuc/bnm': '^1.0.0' } }) })
    assert.ok(has(errors, 'depends on nothing of ours'))
  })

  /*
   * No tooling exemption any more: the shared tsconfig and the Vitest preset
   * are files in this repository, reached by a relative path, so there is no
   * longer any package in this scope a vendor package may legitimately hold.
   */
  it('refuses anything of ours in devDependencies, tooling included', () => {
    const errors = audit({
      manifest: manifest({ devDependencies: { '@deniscuciuc/tsconfig': 'workspace:*' } }),
    })
    assert.ok(has(errors, 'the tooling lives in this repository as files'))
  })

  it('allows third-party dependencies, which are the whole point', () => {
    const errors = audit({ manifest: manifest({ dependencies: { zod: '^3.23.8' } }) })
    assert.deepEqual(errors, [])
  })
})

describe('the manifest', () => {
  it('refuses a name that does not match the folder', () => {
    const errors = audit({ manifest: manifest({ name: '@deniscuciuc/other' }) })
    assert.ok(has(errors, 'does not match the folder'))
  })

  it('refuses a missing publishConfig.access, which fails the first scoped publish', () => {
    const errors = audit({ manifest: manifest({ publishConfig: undefined }) })
    assert.ok(has(errors, 'publishConfig.access'))
  })

  it('refuses a licence that is not MIT, which would mislicense a public tarball', () => {
    assert.ok(has(audit({ manifest: manifest({ license: 'UNLICENSED' }) }), 'repository is MIT'))
    assert.ok(has(audit({ manifest: manifest({ license: undefined }) }), 'repository is MIT'))
  })

  it('refuses a missing repository.directory, which unlinks the package from the repo', () => {
    const errors = audit({ manifest: manifest({ repository: undefined }) })
    assert.ok(has(errors, 'repository.directory'))
  })

  it('refuses files without dist, which would ship the wrong thing', () => {
    assert.ok(has(audit({ manifest: manifest({ files: ['src'] }) }), 'files: ["dist"]'))
    assert.ok(has(audit({ manifest: manifest({ files: undefined }) }), 'files: ["dist"]'))
  })

  it('refuses a package marked private, which would never publish', () => {
    assert.ok(has(audit({ manifest: manifest({ private: true }) }), 'private'))
  })

  it('refuses a package with no description', () => {
    assert.ok(has(audit({ manifest: manifest({ description: undefined }) }), 'description'))
  })
})

describe('the documents', () => {
  it('refuses a package with no README', () => {
    assert.ok(has(audit({ hasReadme: false }), 'no README.md'))
  })

  it('refuses a package with no page under docs/vendors', () => {
    assert.ok(has(audit({ hasVendorDoc: false }), 'docs/vendors/example.md'))
  })

  it('refuses a package with no fixtures', () => {
    assert.ok(has(audit({ hasFixtures: false }), 'no recorded responses'))
  })
})

// @invariant 12
describe('the source rules', () => {
  const withSource = (files) =>
    audit({
      files: Object.keys(files).map((name) => `/repo/packages/example/${name}`),
      read: (file) => files[file.split('/packages/example/')[1]] ?? '',
    })

  it('refuses process.env, because the package must not know where it runs', () => {
    const errors = withSource({
      'src/client.ts': 'const key = process.env.API_KEY',
      'src/endpoints.ts': "export const X_BASE_URL = 'https://api.test/v1'",
    })
    assert.ok(has(errors, 'process.env'))
  })

  it('allows process.env in a test, which is not shipped', () => {
    const errors = withSource({
      'src/client.test.ts': 'const key = process.env.API_KEY',
      'src/endpoints.ts': "export const X_BASE_URL = 'https://api.test/v1'",
    })
    assert.deepEqual(errors, [])
  })

  it('refuses fetch outside transport.ts, which breaks every fake', () => {
    const errors = withSource({
      'src/client.ts': 'await fetch(url)',
      'src/endpoints.ts': "export const X_BASE_URL = 'https://api.test/v1'",
    })
    assert.ok(has(errors, 'calls fetch outside transport.ts'))
  })

  it('allows fetch inside transport.ts', () => {
    const errors = withSource({
      'src/transport.ts': 'await fetch(url)',
      'src/endpoints.ts': "export const X_BASE_URL = 'https://api.test/v1'",
    })
    assert.deepEqual(errors, [])
  })

  it('refuses export * in index.ts, which makes the API snapshot meaningless', () => {
    const errors = withSource({
      'src/index.ts': "export * from './client.js'",
      'src/endpoints.ts': "export const X_BASE_URL = 'https://api.test/v1'",
    })
    assert.ok(has(errors, 'export *'))
  })
})

describe('the API version rule', () => {
  const withEndpoints = (contents) =>
    audit({
      files: ['/repo/packages/example/src/endpoints.ts'],
      read: () => contents,
    })

  it('accepts a version segment in the base URL', () => {
    assert.deepEqual(withEndpoints("export const X_BASE_URL = 'https://api.test/v2'"), [])
  })

  it('accepts a dated spec check, for vendors that publish no version at all', () => {
    assert.deepEqual(withEndpoints("export const X_SPEC_CHECKED = '2026-09-09'"), [])
  })

  it('refuses silence about which version we looked at', () => {
    const errors = withEndpoints("export const X_BASE_URL = 'https://api.test'")
    assert.ok(has(errors, 'neither an API version in the URL nor a dated _SPEC_CHECKED'))
  })

  it('refuses a spec check that is not a date', () => {
    const errors = withEndpoints("export const X_SPEC_CHECKED = 'recently'")
    assert.ok(has(errors, '_SPEC_CHECKED'))
  })

  it('says nothing when the package has no endpoints.ts to check', () => {
    assert.deepEqual(audit({ files: ['/repo/packages/example/src/client.ts'], read: () => '' }), [])
  })
})
