const SUPABASE_URL = 'https://bygwwnaudkxinytgbmrf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5Z3d3bmF1ZGt4aW55dGdibXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTE2ODAsImV4cCI6MjA5NjY4NzY4MH0.wseeLbw7MT5_z1ne6zlv55rcVzoJEihZfOlzj5ZxiMs';

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
        const opts = { headers: restHeaders() };
        if (q.method === 'POST') { opts.method = 'POST'; opts.body = JSON.stringify(q.body); opts.headers['Prefer'] = 'return=representation'; }
        else if (q.method === 'PATCH') { opts.method = 'PATCH'; opts.body = JSON.stringify(q.body); opts.headers['Prefer'] = 'return=representation'; }
        else if (q.method === 'DELETE') { opts.method = 'DELETE'; }
        const url = q.method === 'POST' ? `${buildQuery(table, q)}` : buildQuery(table, q);
        const res = await fetch(url, opts);
        if (!res.ok) { const txt = await res.text().catch(() => ''); throw new Error(`Supabase ${res.status}: ${txt}`); }
        const data = res.status === 204 ? null : await res.json();
        return { data, error: null };
      } catch (e) { return { data: null, error: e }; }
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
      localStorage.removeItem('sb-access-token');
      localStorage.removeItem('sb-refresh-token');
      if (token) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
        }).catch(() => {});
      }
    },
    async getSession() {
      const token = localStorage.getItem('sb-access-token');
      if (!token) return { data: { session: null } };
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) { localStorage.removeItem('sb-access-token'); localStorage.removeItem('sb-refresh-token'); return { data: { session: null } }; }
      const user = await res.json();
      return { data: { session: { user, access_token: token } } };
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
  }
};
