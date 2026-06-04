import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
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
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login: (email, password) =>
    api.post('/auth/login', new URLSearchParams({ username: email, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
}

export const documentsApi = {
  list: (params) => api.get('/documents/', { params }),
  get: (id) => api.get(`/documents/${id}`),
  upload: (file, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total)),
    })
  },
  delete: (id) => api.delete(`/documents/${id}`),
}

export const transactionsApi = {
  list: (params) => api.get('/transactions/', { params }),
  stats: () => api.get('/transactions/stats'),
  update: (id, data) => api.patch(`/transactions/${id}`, data),
}

export const quickbooksApi = {
  connect: () => api.get('/quickbooks/connect'),
  status: () => api.get('/quickbooks/status'),
  accounts: () => api.get('/quickbooks/accounts'),
  sync: (ids) => api.post('/quickbooks/sync', { transaction_ids: ids }),
  disconnect: () => api.delete('/quickbooks/disconnect'),
}

export const reportsApi = {
  pdf: (docId) => api.get(`/reports/${docId}/pdf`, { responseType: 'blob' }),
  excel: (docId) => api.get(`/reports/${docId}/excel`, { responseType: 'blob' }),
}

export const searchApi = {
  transactions: (q) => api.get('/search/transactions', { params: { q } }),
  ask: (question, document_id) => api.post('/search/ask', null, { params: { question, document_id } }),
}

export default api
