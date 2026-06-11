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

async function buscarOCrearAnfitrion(nombre) {
  const { data: existentes } = await supabase
    .from('anfitriones')
    .select('id')
    .ilike('nombre', nombre.trim())
    .limit(1);
  if (existentes && existentes.length > 0) return existentes[0].id;
  const userId = await getCurrentUserId();
  const { data: nuevo } = await supabase.from('anfitriones').insert({
    nombre: nombre.trim(), creado_por: userId
  }).select('id').single();
  return nuevo.id;
}
