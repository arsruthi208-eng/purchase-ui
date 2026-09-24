import { api } from './client'

export interface LoginResponse {
  token: string
  role: string
  fullName: string
  expiresInHours: number
  profilePicture?: string | null
}

export interface MeResponse {
  username: string
  fullName: string
  role: string
  email: string
  profilePicture?: string | null
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/api/v1/auth/login', { username, password }).then(r => r.data),

  me: () =>
    api.get<MeResponse>('/api/v1/auth/me').then(r => r.data),

  forgotPassword: (email: string) =>
    api.post('/api/v1/auth/forgot-password', { email }).then(() => {}),

  verifyOtp: (email: string, otp: string): Promise<string> =>
    api.post<{ resetToken: string }>('/api/v1/auth/verify-otp', { email, otp }).then(r => r.data.resetToken),

  resetPassword: (resetToken: string, newPassword: string) =>
    api.post('/api/v1/auth/reset-password', { resetToken, newPassword }).then(() => {}),

  updateOwnPicture: (profilePicture: string | null) =>
    api.put('/api/v1/auth/me/picture', { profilePicture }).then(() => {}),
}

/** Compress + resize an image File to a base64 data URI (max 200×200, quality 0.82) */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const MAX = 200
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
          else { width = Math.round((width * MAX) / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = e.target!.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
