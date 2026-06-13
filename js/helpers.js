function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, c => map[c]);
}

function validarFormulario(ids) {
  let valido = true;
  ids.forEach(id => {
    const el = document.getElementById(id);
    const valor = el.value.trim();
    if (!valor) {
      el.style.borderColor = '#ff5555';
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

function focusTrap(modalEl) {
  const focusables = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  modalEl.addEventListener('keydown', function handler(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  if (first) setTimeout(() => first.focus(), 50);
}

function cerrarModal(overlay) {
  overlay.classList.add('hidden');
  overlay.removeAttribute('aria-active');
}

function mostrarToast(mensaje, tipo) {
  tipo = tipo || 'success';
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icon = tipo === 'success' ? '✓' : '✕';
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `<div class="toast-glow"></div><div class="toast-content"><span class="toast-icon">${icon}</span><span class="toast-msg">${escapeHtml(mensaje)}</span><button class="toast-close" type="button" aria-label="Cerrar">&times;</button></div>`;
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
