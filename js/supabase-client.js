const SUPABASE_URL = 'https://bygwwnaudkxinytgbmrf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5Z3d3bmF1ZGt4aW55dGdibXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTE2ODAsImV4cCI6MjA5NjY4NzY4MH0.wseeLbw7MT5_z1ne6zlv55rcVzoJEihZfOlzj5ZxiMs';

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return str;
}

function getTokenExpiry() {
  const token = localStorage.getItem('sb-access-token');
  if (!token) return 0;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return 0;
    const payload = JSON.parse(atob(base64UrlDecode(parts[1])));
    return (payload.exp || 0) * 1000;
  } catch { return 0; }
}

async function refreshSession() {
  const refresh = localStorage.getItem('sb-refresh-token');
  if (!refresh) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh })
    });
    if (!res.ok) { localStorage.removeItem('sb-access-token'); localStorage.removeItem('sb-refresh-token'); return false; }
    const data = await res.json();
    localStorage.setItem('sb-access-token', data.access_token);
    localStorage.setItem('sb-refresh-token', data.refresh_token);
    return true;
  } catch { return false; }
}

function restHeaders() {
  const h = { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  const token = localStorage.getItem('sb-access-token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function buildQuery(table, q) {
  const p = new URLSearchParams();
  if (q.select && q.select !== '*') p.set('select', q.select);
  [].concat(q.filters || []).forEach(f => p.append(f.col, f.val));
  if (q.limit) p.set('limit', q.limit);
  if (q.orderCol) p.set('order', `${q.orderCol}.${q.orderDir}`);
  const s = p.toString();
  return `${SUPABASE_URL}/rest/v1/${table}${s ? '?' + s : ''}`;
}

function queryBuilder(table, q = { select: '*', filters: [], limit: null, orderCol: null, orderDir: 'asc', method: null, body: null }) {
  const b = {
    select(cols) { q.select = cols || '*'; return b; },
    eq(col, val) { q.filters.push({ col, val: `eq.${val}` }); return b; },
    is(col, val) { q.filters.push({ col, val: 'is.null' }); return b; },
    ilike(col, val) { q.filters.push({ col, val: `ilike.${val}` }); return b; },
    gte(col, val) { q.filters.push({ col, val: `gte.${val}` }); return b; },
    lte(col, val) { q.filters.push({ col, val: `lte.${val}` }); return b; },
    limit(n) { q.limit = n; return b; },
    order(col, opts) { q.orderCol = col; q.orderDir = opts?.ascending === false ? 'desc' : 'asc'; return b; },
    single() { q.limit = 1; return b._exec().then(d => d.data?.[0] ? { data: d.data[0], error: null } : { data: null, error: new Error('Not found') }); },
    then(resolve, reject) { return b._exec().then(resolve, reject); },
    async _exec() {
      try {
        if (getTokenExpiry() - Date.now() < 60000) await refreshSession();
        const opts = { headers: restHeaders() };
        if (q.method === 'POST') { opts.method = 'POST'; opts.body = JSON.stringify(q.body); opts.headers['Prefer'] = 'return=representation'; }
        else if (q.method === 'PATCH') { opts.method = 'PATCH'; opts.body = JSON.stringify(q.body); opts.headers['Prefer'] = 'return=representation'; }
        else if (q.method === 'DELETE') { opts.method = 'DELETE'; }
        const url = q.method === 'POST' ? `${buildQuery(table, q)}` : buildQuery(table, q);
        const res = await fetch(url, opts);
        if (res.status === 401 && await refreshSession()) {
          opts.headers = restHeaders();
          const res2 = await fetch(url, opts);
          if (!res2.ok) { const txt = await res2.text().catch(() => ''); throw new Error(`Supabase ${res2.status}: ${txt}`); }
          const data = res2.status === 204 ? null : await res2.json();
          return { data, error: null };
        }
        if (!res.ok) { const txt = await res.text().catch(() => ''); throw new Error(`Supabase ${res.status}: ${txt}`); }
        const data = res.status === 204 ? null : await res.json();
        return { data, error: null };
      } catch (e) {
        if (typeof logError === 'function') logError('error', `Supabase ${q.method || 'GET'} ${table}`, e.message);
        return { data: null, error: e };
      }
    }
  };
  return b;
}

const supabase = {
  auth: {
    async signInWithPassword({ email, password }) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('sb-access-token', data.access_token);
        localStorage.setItem('sb-refresh-token', data.refresh_token);
        return { data: { user: data.user, session: data }, error: null };
      }
      return { data: null, error: new Error(data.msg || data.error_description || 'Credenciales inválidas') };
    },
    async signOut() {
      const token = localStorage.getItem('sb-access-token');
      const refresh = localStorage.getItem('sb-refresh-token');
      localStorage.removeItem('sb-access-token');
      localStorage.removeItem('sb-refresh-token');
      if (token) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
        }).catch(() => {});
      }
      if (refresh) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh })
        }).catch(() => {});
      }
    },
    async getSession() {
      let token = localStorage.getItem('sb-access-token');
      const refresh = localStorage.getItem('sb-refresh-token');
      if (!token && refresh) {
        const ok = await refreshSession();
        if (!ok) return { data: { session: null } };
        token = localStorage.getItem('sb-access-token');
      }
      if (!token) return { data: { session: null } };
      if (getTokenExpiry() - Date.now() < 60000) await refreshSession();
      const t = localStorage.getItem('sb-access-token');
      if (!t) return { data: { session: null } };
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${t}` }
      });
      if (!res.ok) { localStorage.removeItem('sb-access-token'); localStorage.removeItem('sb-refresh-token'); return { data: { session: null } }; }
      const user = await res.json();
      return { data: { session: { user, access_token: t } } };
    }
  },
  from(table) {
    return {
      select(cols) { return queryBuilder(table, { select: cols || '*', filters: [], limit: null, orderCol: null, orderDir: 'asc' }); },
      insert(obj) {
        return queryBuilder(table, { select: '*', filters: [], limit: null, orderCol: null, orderDir: 'asc', method: 'POST', body: Array.isArray(obj) ? obj : [obj] });
      },
      update(obj) {
        return queryBuilder(table, { select: '*', filters: [], limit: null, orderCol: null, orderDir: 'asc', method: 'PATCH', body: obj });
      },
      delete() {
        return queryBuilder(table, { select: '*', filters: [], limit: null, orderCol: null, orderDir: 'asc', method: 'DELETE' });
      }
    };
  },
  rpc(fn, params) {
    return (async () => {
      if (getTokenExpiry() - Date.now() < 60000) await refreshSession();
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
          method: 'POST',
          headers: restHeaders(),
          body: JSON.stringify(params || {})
        });
        if (res.status === 401 && await refreshSession()) {
          const res2 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
            method: 'POST', headers: restHeaders(), body: JSON.stringify(params || {})
          });
          const data = res2.ok ? await res2.json().catch(() => null) : null;
          return { data, error: res2.ok ? null : new Error(`Supabase ${res2.status}`) };
        }
        const data = res.ok ? await res.json().catch(() => null) : null;
        return { data, error: res.ok ? null : new Error(`Supabase ${res.status}`) };
      } catch (e) {
        if (typeof logError === 'function') logError('error', `Supabase RPC ${fn}`, e.message);
        return { data: null, error: e };
      }
    })();
  }
};
