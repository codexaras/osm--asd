// Thin fetch wrapper around the ResourceHub REST API.
const BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const request = async (path, { method = 'GET', body, query } = {}) => {
  const token = localStorage.getItem('rh_token');
  const qs = query
    ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '' && v !== null))}`
    : '';
  const res = await fetch(`${BASE}${path}${qs}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token && !path.startsWith('/auth/login')) {
    localStorage.removeItem('rh_token');
    window.dispatchEvent(new Event('rh:logout'));
  }
  if (!res.ok) throw new ApiError(data.message || `Request failed (${res.status})`, res.status);
  return data.data;
};

const get = (p, query) => request(p, { query });
const post = (p, body) => request(p, { method: 'POST', body });
const put = (p, body) => request(p, { method: 'PUT', body });
const patch = (p, body) => request(p, { method: 'PATCH', body });
const del = (p) => request(p, { method: 'DELETE' });

export const api = {
  // auth
  login: (b) => post('/auth/login', b),
  signup: (b) => post('/auth/signup', b),
  me: () => get('/auth/me'),
  updateProfile: (b) => put('/auth/me', b),
  // dashboard / misc
  dashboard: () => get('/dashboard'),
  health: () => get('/health'),
  notifications: () => get('/notifications'),
  readAll: () => patch('/notifications/read-all'),
  activity: (q) => get('/activity', q),
  // users
  users: (q) => get('/users', q),
  createUser: (b) => post('/users', b),
  updateUser: (id, b) => put(`/users/${id}`, b),
  setUserStatus: (id, isActive) => patch(`/users/${id}/status`, { isActive }),
  // resources
  resources: (q) => get('/resources', q),
  resourceMeta: () => get('/resources/meta'),
  createResource: (b) => post('/resources', b),
  updateResource: (id, b) => put(`/resources/${id}`, b),
  setResourceStatus: (id, status) => patch(`/resources/${id}/status`, { status }),
  deleteResource: (id) => del(`/resources/${id}`),
  // requests
  requests: (q) => get('/requests', q),
  createRequest: (b) => post('/requests', b),
  approveRequest: (id, b) => patch(`/requests/${id}/approve`, b),
  rejectRequest: (id, b) => patch(`/requests/${id}/reject`, b),
  cancelRequest: (id) => patch(`/requests/${id}/cancel`),
  // allocations
  allocations: (q) => get('/allocations', q),
  allocate: (b) => post('/allocations', b),
  requestReturn: (id, b) => patch(`/allocations/${id}/return-request`, b),
  confirmReturn: (id, b) => patch(`/allocations/${id}/confirm-return`, b),
  // bookings
  bookings: (q) => get('/bookings', q),
  createBooking: (b) => post('/bookings', b),
  cancelBooking: (id) => patch(`/bookings/${id}/cancel`),
  // maintenance
  tickets: (q) => get('/maintenance', q),
  reportIssue: (b) => post('/maintenance', b),
  updateTicket: (id, b) => patch(`/maintenance/${id}`, b)
};
