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
