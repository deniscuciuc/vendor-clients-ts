import { loadConfig, resolveRules } from './config.mjs'

function select(rules, names) {
  if (names.length === 0) return [...rules]

  const byName = new Map(rules.map((rule) => [rule.name, rule]))
  return names.map((name) => {
    const rule = byName.get(name)
    if (!rule) {
      throw new Error(`no rule "${name}". Enabled: ${[...byName.keys()].join(', ')}`)
    }
    return rule
  })
}

function report(outcomes) {
  let failed = 0

  for (const outcome of outcomes) {
    if (outcome.errors.length === 0) {
      console.log(`  ${outcome.rule}: ${outcome.summary}`)
      continue
    }
    failed += 1
    console.error(`  ${outcome.rule}: failed, ${outcome.errors.length} problem(s):`)
    for (const error of outcome.errors) console.error(`    ${error}`)
  }

  return failed
}

export async function run(argv, root) {
  const [command, ...names] = argv

  if (command !== 'check' && command !== 'snapshot') {
    console.error('Usage: repo-check check [rule...] | repo-check snapshot <rule>')
    return 2
  }

  const config = await loadConfig(root)
  const rules = select(await resolveRules(root, config), names)
  const context = { root, config }

  if (command === 'snapshot') {
    const outcomes = []
    for (const rule of rules) {
      if (!rule.write) {
        console.error(`  ${rule.name}: no snapshot written — the rule has no write`)
        return 1
      }
      outcomes.push({ rule: rule.name, ...rule.write(context) })
    }
    return report(outcomes) > 0 ? 1 : 0
  }

  const outcomes = rules.map((rule) => ({ rule: rule.name, ...rule.check(context) }))
  const failed = report(outcomes)

  if (failed > 0) {
    console.error(`\nRepository check failed: ${failed} of ${rules.length} rule(s).`)
    return 1
  }
  return 0
}
