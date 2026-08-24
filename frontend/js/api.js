const API_BASE_URL = window.LA_API_BASE_URL || 'http://localhost:3000';

async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem('la_token');
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || 'Não foi possível concluir a solicitação.');
    error.status = response.status;
    error.details = payload.details;
    throw error;
  }

  return payload;
}

async function login(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

async function getCurrentUser() {
  return apiRequest('/auth/me');
}
