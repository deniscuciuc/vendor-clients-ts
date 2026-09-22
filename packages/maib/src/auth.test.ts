import { describe, expect, it } from 'vitest'
import { MaibTokens } from './auth.js'
import type { MaibTransport } from './transport.js'

const CREDENTIALS = { projectId: 'project', projectSecret: 'secret' }

function transportOf(answers: Record<string, unknown>) {
  const calls: { path: string; body?: unknown }[] = []
  const transport: MaibTransport = {
    async post(path, body) {
      calls.push({ path, body })
      return answers[path] ?? {}
    },
    async get(path) {
      calls.push({ path })
      return answers[path] ?? {}
    },
  }
  return { transport, calls }
}

const TOKEN_ANSWER = {
  '/generate-token': {
    result: {
      accessToken: 'access-1',
      expiresIn: 3600,
      refreshToken: 'refresh-1',
      refreshExpiresIn: 86_400,
    },
  },
}

describe('the token', () => {
  it('is fetched once and reused while it is valid', async () => {
    const { transport, calls } = transportOf(TOKEN_ANSWER)
    const tokens = new MaibTokens(transport, CREDENTIALS, () => 1_757_000_000_000)

    expect(await tokens.access()).toBe('access-1')
    expect(await tokens.access()).toBe('access-1')
    expect(calls.filter((call) => call.path === '/generate-token')).toHaveLength(1)
  })

  it('sends the project credentials the first time and the refresh token after', async () => {
    let clock = 1_757_000_000_000
    const { transport, calls } = transportOf({
      '/generate-token': {
        result: {
          accessToken: 'access-2',
          expiresIn: 60,
          refreshToken: 'refresh-2',
          refreshExpiresIn: 86_400,
        },
      },
    })
    const tokens = new MaibTokens(transport, CREDENTIALS, () => clock)

    await tokens.access()
    expect(calls[0]?.body).toMatchObject({ projectId: 'project', projectSecret: 'secret' })

    // Past the thirty-second early-refresh boundary, which exists because a
    // token that expires between our check and their read is a failed payment
    // that looks like an outage.
    clock += 40_000
    await tokens.access()
    expect(calls[1]?.body).toEqual({ refreshToken: 'refresh-2' })
  })

  it('does not keep a half-parsed answer, which would poison every later call', async () => {
    const { transport, calls } = transportOf({
      '/generate-token': { result: { expiresIn: 3600 } },
    })
    const tokens = new MaibTokens(transport, CREDENTIALS, () => 1_757_000_000_000)

    expect(await tokens.access()).toBeNull()
    expect(await tokens.access()).toBeNull()
    // The second call goes with credentials rather than a refresh token we do
    // not have: otherwise the only fix would be restarting the process.
    expect(calls[1]?.body).toMatchObject({ projectId: 'project' })
  })

  it('accepts an answer in the root as well as under result', async () => {
    // Both shapes appear in their documentation.
    const { transport } = transportOf({
      '/generate-token': {
        accessToken: 'access-3',
        expiresIn: 3600,
        refreshToken: 'refresh-3',
        refreshExpiresIn: 86_400,
      },
    })
    const tokens = new MaibTokens(transport, CREDENTIALS, () => 1_757_000_000_000)

    expect(await tokens.access()).toBe('access-3')
  })
})
