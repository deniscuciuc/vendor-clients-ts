/**
 * Repository rules. The logic lives in `scripts/repo-check.mjs`; this file is
 * only the lists.
 *
 * The required-documents list is exactly the field on which two copies of a
 * hand-rolled doc validator once drifted fifteen lines apart: "publishing" and
 * "how to add a vendor" mean everything here and nothing to a generic engine.
 * The list is obliged to differ per repository; the checking logic is not.
 */
export default {
  scope: '@deniscuciuc/',

  docs: {
    required: [
      'architecture/overview.md',
      'operations/publishing.md',
      'operations/adding-a-vendor.md',
      'qa/test-strategy.md',
      'vendors/README.md',
    ],
  },

  invariants: {
    strategy: 'docs/qa/test-strategy.md',
    searchRoots: ['packages', 'scripts'],
  },

  /*
   * There are deliberately no layers here: the vendor packages do not depend on
   * one another at all, and that rule is stricter than any ordering — it is
   * held by `vendors`.
   */
  rules: ['./scripts/rules/vendors.mjs'],
}
