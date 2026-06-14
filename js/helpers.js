const ICONS = {
  eyeOpen: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeClosed: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  moon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  sun: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  cross: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
};

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, c => map[c]);
}

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function validarFormulario(ids) {
  let valido = true;
  ids.forEach(id => {
    const el = document.getElementById(id);
    const valor = el.value.trim();
    if (!valor) {
      el.style.borderColor = getCSSVar('--danger-color') || '#ff5555';
      valido = false;
    } else {
      el.style.borderColor = '';
    }
  });
  return valido;
}

function toggleLoading(mostrar) {
  const loader = document.getElementById('loader');
  if (loader) loader.classList.toggle('hidden', !mostrar);
}

function disableButton(btn, texto) {
  if (!btn) return;
  btn.dataset.origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = texto || 'Procesando...';
}

function enableButton(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = btn.dataset.origText || btn.textContent;
}

function focusTrap(modalEl) {
  const focusables = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (modalEl._focusHandler) {
    modalEl.removeEventListener('keydown', modalEl._focusHandler);
  }
  modalEl._focusHandler = function handler(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  modalEl.addEventListener('keydown', modalEl._focusHandler);
  if (first) setTimeout(() => first.focus(), 50);
}

function cerrarModal(overlay) {
  overlay.classList.add('hidden');
  overlay.removeAttribute('aria-active');
  if (overlay._focusHandler) {
    overlay.removeEventListener('keydown', overlay._focusHandler);
    delete overlay._focusHandler;
  }
}

function mostrarToast(mensaje, tipo) {
  tipo = tipo || 'success';
  const container = document.getElementById('toast-container');
  if (!container) return;
  const iconMap = { success: ICONS.check, error: ICONS.cross, info: ICONS.info };
  const icon = iconMap[tipo] || ICONS.info;
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `<div class="toast-glow"></div><div class="toast-content"><span class="toast-icon">${icon}</span><span class="toast-msg">${escapeHtml(mensaje)}</span><button class="toast-close icon-btn" type="button" aria-label="Cerrar">${ICONS.cross}</button></div>`;
  toast.querySelector('.toast-close').addEventListener('click', () => cerrarToast(toast));
  container.appendChild(toast);
  setTimeout(() => cerrarToast(toast), 5000);
}
function cerrarToast(toast) {
  if (toast.classList.contains('toast-hiding')) return;
  toast.classList.add('toast-hiding');
  setTimeout(() => toast.remove(), 300);
}

async function buscarVisitantePorDoc(tipoDoc, numDoc) {
  if (!numDoc || numDoc.length < 3) return null;
  const { data } = await supabase
    .from('visitantes')
    .select('nombre, empresa')
    .eq('tipo_doc', tipoDoc)
    .eq('num_doc', numDoc)
    .limit(1);
  return (data && data.length > 0) ? data[0] : null;
}

function initAutocomplete(inputId, supabaseTable, displayField, onSelect) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const list = document.createElement('ul');
  list.className = 'autocomplete-list';
  document.body.appendChild(list);
  let timeout;
  function posicionarLista() {
    const rect = input.getBoundingClientRect();
    list.style.left = `${rect.left}px`;
    list.style.top = `${rect.bottom}px`;
    list.style.width = `${rect.width}px`;
  }
  input.addEventListener('input', () => {
    clearTimeout(timeout);
    const val = input.value.trim();
    if (val.length < 1) { list.innerHTML = ''; list.classList.remove('active'); return; }
    timeout = setTimeout(async () => {
      const { data } = await supabase
        .from(supabaseTable)
        .select(displayField)
        .ilike(displayField, `%${val}%`)
        .limit(3)
        .order(displayField, { ascending: true });
      list.innerHTML = '';
      if (data && data.length > 0) {
        data.forEach(r => {
          const li = document.createElement('li');
          li.textContent = r[displayField];
          li.addEventListener('mousedown', (e) => {
            e.preventDefault();
            input.value = r[displayField];
            list.innerHTML = '';
            list.classList.remove('active');
            if (onSelect) onSelect(r);
          });
          list.appendChild(li);
        });
        posicionarLista();
        list.classList.add('active');
      } else {
        list.classList.remove('active');
      }
    }, 200);
  });
  input.addEventListener('focus', () => { if (list.children.length > 0) { posicionarLista(); list.classList.add('active'); } });
  window.addEventListener('scroll', () => { list.classList.remove('active'); }, true);
  document.addEventListener('click', (e) => {
    if (e.target !== input && !list.contains(e.target)) { list.innerHTML = ''; list.classList.remove('active'); }
  });
}

function generarUUID() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
}

async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

async function buscarOCrearVisitante(tipoDoc, numDoc, nombre, empresa) {
  const { data: existentes } = await supabase
    .from('visitantes')
    .select('id, nombre, empresa')
    .eq('tipo_doc', tipoDoc)
    .eq('num_doc', numDoc)
    .limit(1);
  if (existentes && existentes.length > 0) {
    const v = existentes[0];
    if (v.nombre !== nombre || v.empresa !== (empresa || 'Particular')) {
      await supabase.from('visitantes').update({ nombre, empresa: empresa || 'Particular' }).eq('id', v.id);
    }
    return v.id;
  }
  const { data: nuevo } = await supabase.from('visitantes').insert({
    tipo_doc: tipoDoc, num_doc: numDoc, nombre, empresa: empresa || 'Particular'
  }).select('id').single();
  return nuevo.id;
}

async function buscarAnfitrion(nombre) {
  const { data } = await supabase
    .from('anfitriones')
    .select('id')
    .ilike('nombre', nombre.trim())
    .limit(1);
  return (data && data.length > 0) ? data[0].id : null;
}

function logError(nivel, mensaje, detalle) {
  const logs = JSON.parse(localStorage.getItem('appLogs') || '[]');
  logs.unshift({
    fecha: new Date().toISOString(),
    nivel: nivel || 'error',
    mensaje: String(mensaje),
    detalle: detalle ? String(detalle).substring(0, 500) : ''
  });
  if (logs.length > 200) logs.length = 200;
  localStorage.setItem('appLogs', JSON.stringify(logs));
  console.error(`[${nivel}] ${mensaje}`, detalle || '');
}

function getLimaComponents() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date());
  const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

function getLimaNow() {
  const c = getLimaComponents();
  return new Date(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
}

function getLimaDateStr() {
  const c = getLimaComponents();
  return c.year + '-' + String(c.month).padStart(2, '0') + '-' + String(c.day).padStart(2, '0');
}

document.addEventListener('click', function(e) {
  const btn = e.target.closest('.date-picker-btn');
  if (!btn) return;
  const input = document.getElementById(btn.getAttribute('data-target'));
  if (!input) return;
  if (typeof input.showPicker === 'function') {
    input.showPicker();
  } else {
    input.focus();
  }
});
