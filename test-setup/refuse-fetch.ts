import { refuse } from './refuse.js'

globalThis.fetch = refuse('fetch') as unknown as typeof fetch
