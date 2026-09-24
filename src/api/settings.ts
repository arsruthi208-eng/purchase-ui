import { api } from './client'

export interface SignerConfig {
  name: string
  image: string  // base64 data-URL
}

export interface SignatureSettings {
  preparedBy: SignerConfig | null
  checkedBy: SignerConfig | null
  authorisedBy: SignerConfig | null
}

export const settingsApi = {
  getSignatures: () =>
    api.get<SignatureSettings>('/api/v1/settings/signatures').then(r => r.data),

  updateSignatures: (data: Partial<SignatureSettings>) =>
    api.put<SignatureSettings>('/api/v1/settings/signatures', data).then(r => r.data),
}
