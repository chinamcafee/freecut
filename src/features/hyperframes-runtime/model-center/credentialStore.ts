export type CredentialScope = 'user-local' | 'team-secret' | 'session-token'

export interface CredentialMetadata {
  ref: string
  scope: CredentialScope
  label?: string
  createdAt: number
  updatedAt?: number
  expiresAt?: number
}

export interface CredentialSecret {
  value: string
  expiresAt?: number
}

export interface CredentialStore {
  put(
    ref: string,
    secret: CredentialSecret,
    metadata: Omit<CredentialMetadata, 'ref' | 'createdAt'> & { createdAt?: number },
  ): Promise<CredentialMetadata>
  get(ref: string): Promise<CredentialSecret | undefined>
  describe(ref: string): Promise<CredentialMetadata | undefined>
  list(): Promise<CredentialMetadata[]>
  delete(ref: string): Promise<boolean>
}

export class InMemoryCredentialStore implements CredentialStore {
  private readonly secrets = new Map<string, CredentialSecret>()
  private readonly metadata = new Map<string, CredentialMetadata>()

  async put(
    ref: string,
    secret: CredentialSecret,
    metadata: Omit<CredentialMetadata, 'ref' | 'createdAt'> & { createdAt?: number },
  ): Promise<CredentialMetadata> {
    const now = metadata.createdAt ?? Date.now()
    const existing = this.metadata.get(ref)
    const next: CredentialMetadata = {
      ref,
      scope: metadata.scope,
      label: metadata.label,
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing ? now : undefined,
      expiresAt: metadata.expiresAt ?? secret.expiresAt,
    }
    this.secrets.set(ref, secret)
    this.metadata.set(ref, next)
    return next
  }

  async get(ref: string): Promise<CredentialSecret | undefined> {
    const secret = this.secrets.get(ref)
    if (!secret) return undefined
    if (secret.expiresAt !== undefined && secret.expiresAt <= Date.now()) return undefined
    return secret
  }

  async describe(ref: string): Promise<CredentialMetadata | undefined> {
    return this.metadata.get(ref)
  }

  async list(): Promise<CredentialMetadata[]> {
    return [...this.metadata.values()]
  }

  async delete(ref: string): Promise<boolean> {
    this.metadata.delete(ref)
    return this.secrets.delete(ref)
  }
}

export function createCredentialResolver(store: CredentialStore) {
  return async (ref: string): Promise<string | undefined> => {
    const secret = await store.get(ref)
    return secret?.value
  }
}
