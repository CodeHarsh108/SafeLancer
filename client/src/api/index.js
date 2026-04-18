import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.clear()
      window.location.href = '/'
    }
    if (err.response?.status === 403 && err.response?.data?.banned) {
      localStorage.setItem('banInfo', JSON.stringify({
        reason: err.response.data.reason,
        penaltyDue: err.response.data.penaltyDue
      }))
      window.location.href = '/banned'
    }
    return Promise.reject(err)
  }
)

export default api
