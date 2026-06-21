const API_BASE = window.location.origin;

function getToken() { return localStorage.getItem('tabibak_jwt'); }
function setToken(t) { localStorage.setItem('tabibak_jwt', t); }
function clearToken() { localStorage.removeItem('tabibak_jwt'); }

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  const token = getToken();
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
