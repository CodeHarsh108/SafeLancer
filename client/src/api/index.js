import axios from 'axios'

export const getAdminStats = () => api.get('/api/admin/stats');
export const getPendingFreelancers = () => api.get('/api/admin/freelancers/pending');
export const verifyFreelancer = (userId, status, adminNote) => 
  api.post(`/api/admin/freelancers/${userId}/verify`, { status, adminNote });
export const getAllUsers = () => api.get('/api/admin/users');

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
    return Promise.reject(err)
  }
)

export default api
