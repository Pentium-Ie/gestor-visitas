(function() {
  const formRegistro = document.getElementById('form-registro');
  const activeVisitorsList = document.getElementById('active-visitors-list');

  const modal = document.getElementById('modal-salida');
  const modalVisitorInfo = document.getElementById('modal-visitor-info');
  const exitObs = document.getElementById('exit-obs');
  const modalCancel = document.getElementById('modal-cancel');
  const modalConfirm = document.getElementById('modal-confirm');

  const modalVisitorDetail = document.getElementById('modal-visitor-detail');
  const modalVisitorDetailContent = document.getElementById('modal-visitor-detail-content');
  const modalVisitorDetailClose = document.getElementById('modal-visitor-detail-close');

  let personasEnPlanta = [
    { id: 1, nombre: "Carlos Mendoza", empresa: "Logística Perú", documento: "44910293", anfitrion: "Gerencia TI", obs: "" },
    { id: 2, nombre: "Ana Paula Rios", empresa: "TechSolutions", documento: "72195510", anfitrion: "Área de Innovación", obs: "" }
  ];
  let visitorToCheckoutId = null;

  function renderVisitors() {
    if (!activeVisitorsList) return;
    activeVisitorsList.innerHTML = "";
    if (personasEnPlanta.length === 0) {
      activeVisitorsList.innerHTML = '<p class="empty-state">No hay visitas en planta.</p>';
      return;
    }
    personasEnPlanta.forEach(visitor => {
      const card = document.createElement('div');
      card.className = 'visitor-card';
      card.innerHTML = `
        <div class="visitor-info">
          <p>${escapeHtml(visitor.nombre)}</p>
          <span>${escapeHtml(visitor.empresa)} • Ref: ${escapeHtml(visitor.anfitrion)}</span>
        </div>
        <div class="visitor-actions">
          <button class="btn-detail" data-id="${visitor.id}" type="button">Detalle</button>
          <button class="btn-checkout" data-id="${visitor.id}" type="button">Salida</button>
        </div>`;
      activeVisitorsList.appendChild(card);
    });
  }

  activeVisitorsList.addEventListener('click', (e) => {
    const checkoutBtn = e.target.closest('.btn-checkout');
    if (checkoutBtn) return openCheckoutModal(parseInt(checkoutBtn.getAttribute('data-id')));
    const detailBtn = e.target.closest('.btn-detail');
    if (detailBtn) openVisitorDetail(parseInt(detailBtn.getAttribute('data-id')));
  });

  function openCheckoutModal(id) {
    const visitor = personasEnPlanta.find(p => p.id === id);
    if (!visitor) return;
    visitorToCheckoutId = id;
    modalVisitorInfo.textContent = `¿Confirmar la salida de ${visitor.nombre}?`;
    exitObs.value = "";
    modal.classList.remove('hidden');
    modal.setAttribute('aria-active', 'true');
    focusTrap(modal);
  }

  function openVisitorDetail(id) {
    const visitor = personasEnPlanta.find(p => p.id === id);
    if (!visitor) return;
    modalVisitorDetailContent.innerHTML = `
      <span class="label">Documento</span><span class="value">${escapeHtml(visitor.documento)}</span>
      <span class="label">Nombre</span><span class="value">${escapeHtml(visitor.nombre)}</span>
      <span class="label">Empresa</span><span class="value">${escapeHtml(visitor.empresa)}</span>
      <span class="label">Anfitrión</span><span class="value">${escapeHtml(visitor.anfitrion)}</span>
      <span class="label">Observaciones</span><span class="value">${escapeHtml(visitor.obs) || '—'}</span>`;
    modalVisitorDetail.classList.remove('hidden');
    modalVisitorDetail.setAttribute('aria-active', 'true');
    focusTrap(modalVisitorDetail);
  }

  formRegistro.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validarFormulario(['reg-nombre', 'reg-numdoc', 'reg-anfitrion'])) return;
    const nombre = document.getElementById('reg-nombre').value.trim();
    const empresa = document.getElementById('reg-empresa').value.trim() || 'Particular';
    const numDoc = document.getElementById('reg-numdoc').value.trim();
    const motivo = document.getElementById('reg-motivo').value.trim();
    const anfitrion = document.getElementById('reg-anfitrion').value.trim();
    const obs = document.getElementById('reg-obs').value.trim();
    const tipoDoc = document.getElementById('reg-tipodoc').value;
    if (personasEnPlanta.some(v => v.documento === numDoc)) {
      alert('Esta persona ya se encuentra registrada en planta.');
      return;
    }
    personasEnPlanta.push({ id: Date.now(), nombre, empresa, documento: numDoc, anfitrion, obs });
    window.AppState.historial.agregarHistorial({ fecha: new Date().toISOString(), tipoDoc, numDoc, nombre, empresa, motivo, anfitrion, estado: "Ingreso", obs });
    renderVisitors();
    formRegistro.reset();
    document.querySelectorAll('#form-registro input, #form-registro select, #form-registro textarea').forEach(el => el.style.borderColor = '');
  });

  modalCancel.addEventListener('click', () => { cerrarModal(modal); visitorToCheckoutId = null; });
  modalConfirm.addEventListener('click', () => {
    if (visitorToCheckoutId !== null) {
      const visitor = personasEnPlanta.find(p => p.id === visitorToCheckoutId);
      window.AppState.historial.agregarHistorial({ fecha: new Date().toISOString(), tipoDoc: "DNI", numDoc: visitor.documento, nombre: visitor.nombre, empresa: visitor.empresa, motivo: "", anfitrion: visitor.anfitrion, estado: "Salida", obs: exitObs.value.trim() });
      personasEnPlanta = personasEnPlanta.filter(p => p.id !== visitorToCheckoutId);
      renderVisitors();
      cerrarModal(modal);
      visitorToCheckoutId = null;
    }
  });

  modalVisitorDetailClose.addEventListener('click', () => cerrarModal(modalVisitorDetail));
  modalVisitorDetail.addEventListener('click', (e) => { if (e.target === modalVisitorDetail) cerrarModal(modalVisitorDetail); });

  window.AppState = window.AppState || {};
  window.AppState.registro = { renderVisitors, personasEnPlanta };
})();
