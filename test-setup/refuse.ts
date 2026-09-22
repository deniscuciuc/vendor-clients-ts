/**
 * The network is unreachable from a test.
 *
 * A test that reaches outside is green right up until the day the other side
 * has planned maintenance or the runner has no internet — and then it fails
 * without saying anything about our code.
 *
 * The message is generic and the pointer to the fix comes from
 * `VENDOR_CLIENTS_NETWORK_HINT`, so the wording lives in one place while the
 * ADR reference stays with the repository that owns it.
 */
export function refuse(via: string): () => never {
  return () => {
    const hint = process.env.VENDOR_CLIENTS_NETWORK_HINT
    throw new Error(
      `A test reached the network via ${via}. Pass a fake instead; to exercise the transport itself use vi.stubGlobal or vi.mock.${
        hint ? ` ${hint}` : ''
      }`,
    )
  }
}
