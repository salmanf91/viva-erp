import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api'
});

// Toast notification helper for background server/network failures
function showServerToast(title, detail) {
  if (typeof document === 'undefined') return;
  let container = document.getElementById('erp-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'erp-toast-container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;max-width:400px;pointer-events:none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = 'background:#1e1b4b;color:#fff;border-left:4px solid #ef4444;border-radius:8px;padding:12px 16px;box-shadow:0 8px 24px rgba(0,0,0,0.25);font-family:sans-serif;font-size:12px;pointer-events:auto;transition:all 0.3s ease;opacity:0;transform:translateY(10px);';
  toast.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <div style="font-weight:700;color:#fca5a5;font-size:13px;">⚠️ ${title}</div>
      <button style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:0;line-height:1;">✕</button>
    </div>
    <div style="margin-top:4px;color:#cbd5e1;line-height:1.4;word-break:break-word;">${detail}</div>
  `;

  const closeBtn = toast.querySelector('button');
  const removeToast = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  };
  closeBtn.onclick = removeToast;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(removeToast, 7000);
}

api.interceptors.request.use(config => {
  const stored = localStorage.getItem('erp_user');
  if (stored) {
    try {
      const { token } = JSON.parse(stored);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch {}
  }
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('erp_user');
      window.location.href = '/login';
    } else if (err.response?.status >= 500) {
      const url = err.config?.url || 'API';
      const msg = err.response?.data?.message || err.response?.data?.error || 'Internal server error';
      showServerToast(`Server Error (${err.response.status})`, `${url}: ${msg}`);
    } else if (!err.response && err.message === 'Network Error') {
      showServerToast('Network Disconnected', 'Could not reach server. Verify backend is running on port 5001.');
    }
    return Promise.reject(err);
  }
);

export default api;
