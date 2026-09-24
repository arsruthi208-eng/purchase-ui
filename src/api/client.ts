import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// REQUEST — attach JWT from localStorage on every request
api.interceptors.request.use(config => {
  try {
    const stored = localStorage.getItem('au_auth')
    if (stored) {
      const { token } = JSON.parse(stored) as { token: string }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
  } catch {
    // ignore parse errors
  }
  return config
})

// RESPONSE — unwrap ApiResponse envelope; handle 401 only for authenticated sessions
api.interceptors.response.use(
  (response) => {
    if (response.data && 'data' in response.data) {
      return { ...response, data: response.data.data }
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      const stored = localStorage.getItem('au_auth')
      // Only force-logout if the user HAD a valid session (token in storage).
      // Do NOT redirect on login-page 401s — those are just wrong credentials.
      if (stored) {
        localStorage.removeItem('au_auth')
        window.location.href = '/login'
        return new Promise(() => {}) // halt promise chain while redirecting
      }
    }
    const message = error.response?.data?.message ?? 'An unexpected error occurred'
    const err = new Error(message)
    ;(err as any).httpStatus = error.response?.status
    return Promise.reject(err)
  }
)
