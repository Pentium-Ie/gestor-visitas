(function() {
  const formProgramacion = document.getElementById('form-programacion');
  const scheduledVisitorsList = document.getElementById('scheduled-visitors-list');

  const modalDetalle = document.getElementById('modal-detalle');
  const detailContent = document.getElementById('detail-content');
  const detailCancel = document.getElementById('detail-cancel');
  const detailEdit = document.getElementById('detail-edit');
  const detailRegister = document.getElementById('detail-register');
  const detailCancelar = document.getElementById('detail-cancelar');

  const modalConfirmarRegistro = document.getElementById('modal-confirmar-registro');
  const confirmVisitorName = document.getElementById('confirm-visitor-name');
  const confirmObs = document.getElementById('confirm-obs');
  const confirmCancel = document.getElementById('confirm-cancel');
  const confirmOk = document.getElementById('confirm-ok');

  let visitasProgramadas = [
    { id: 101, tipoDoc: "DNI", numDoc: "87654321", nombre: "Roberto Silva", empresa: "Constructora Andes", motivo: "Inspección obra", anfitrion: "Ing. Martínez", fecha: "2026-06-15T10:00" },
    { id: 102, tipoDoc: "CE", numDoc: "12345678", nombre: "Maria González", empresa: "Consultora Global", motivo: "Auditoría", anfitrion: "Contabilidad", fecha: "2026-06-16T14:30" }
  ];
  let selectedProgramacionId = null;
  let programacionToRegister = null;

  function renderProgramadas() {
    if (!scheduledVisitorsList) return;
    scheduledVisitorsList.innerHTML = "";
    if (visitasProgramadas.length === 0) {
      scheduledVisitorsList.innerHTML = '<p class="empty-state">No hay visitas programadas.</p>';
      return;
    }
    visitasProgramadas.forEach(visita => {
      const card = document.createElement('div');
      card.className = 'scheduled-card';
      const fechaLocal = new Date(visita.fecha);
      const fechaStr = fechaLocal.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
      const horaStr = fechaLocal.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      card.innerHTML = `
        <div class="scheduled-info">
          <p>${escapeHtml(visita.nombre)}</p>
          <span>${escapeHtml(visita.empresa)} • Ref: ${escapeHtml(visita.anfitrion)}</span>
        </div>
        <div class="scheduled-meta">${fechaStr} ${horaStr}</div>
        <button class="btn-detail" data-id="${visita.id}" type="button">Detalle</button>`;
      scheduledVisitorsList.appendChild(card);
    });
  }

  scheduledVisitorsList.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-detail');
    if (btn) openDetailModal(parseInt(btn.getAttribute('data-id')));
  });

  function openDetailModal(id) {
    const visita = visitasProgramadas.find(v => v.id === id);
    if (!visita) return;
    selectedProgramacionId = id;
    const fechaLocal = new Date(visita.fecha);
    const fechaStr = fechaLocal.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    const horaStr = fechaLocal.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    detailContent.innerHTML = `
      <span class="label">Documento</span><span class="value">${escapeHtml(visita.tipoDoc)}: ${escapeHtml(visita.numDoc)}</span>
      <span class="label">Nombre</span><span class="value">${escapeHtml(visita.nombre)}</span>
      <span class="label">Empresa</span><span class="value">${escapeHtml(visita.empresa)}</span>
      <span class="label">Motivo</span><span class="value">${escapeHtml(visita.motivo || '—')}</span>
      <span class="label">Anfitrión</span><span class="value">${escapeHtml(visita.anfitrion)}</span>
      <span class="label">Fecha/Hora</span><span class="value">${fechaStr} — ${horaStr}</span>`;
    modalDetalle.classList.remove('hidden');
    modalDetalle.setAttribute('aria-active', 'true');
    focusTrap(modalDetalle);
  }

  formProgramacion.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validarFormulario(['prog-nombre', 'prog-numdoc', 'prog-anfitrion'])) return;
    const fecha = document.getElementById('prog-fecha').value;
    if (!fecha) return;
    const fechaVisita = new Date(fecha);
    if (fechaVisita < new Date()) {
      alert('La fecha debe ser futura.');
      return;
    }
    visitasProgramadas.push({
      id: Date.now(),
      tipoDoc: document.getElementById('prog-tipodoc').value,
      numDoc: document.getElementById('prog-numdoc').value.trim(),
      nombre: document.getElementById('prog-nombre').value.trim(),
      empresa: document.getElementById('prog-empresa').value.trim() || 'Particular',
      motivo: document.getElementById('prog-motivo').value.trim(),
      anfitrion: document.getElementById('prog-anfitrion').value.trim(),
      fecha: fecha
    });
    renderProgramadas();
    formProgramacion.reset();
    document.querySelectorAll('#form-programacion input, #form-programacion select, #form-programacion textarea').forEach(el => el.style.borderColor = '');
  });

  detailCancel.addEventListener('click', () => { cerrarModal(modalDetalle); selectedProgramacionId = null; });
  modalDetalle.addEventListener('click', (e) => { if (e.target === modalDetalle) { cerrarModal(modalDetalle); selectedProgramacionId = null; } });

  detailEdit.addEventListener('click', () => {
    if (!selectedProgramacionId) return;
    const visita = visitasProgramadas.find(v => v.id === selectedProgramacionId);
    if (!visita) return;
    document.getElementById('prog-tipodoc').value = visita.tipoDoc;
    document.getElementById('prog-numdoc').value = visita.numDoc;
    document.getElementById('prog-nombre').value = visita.nombre;
    document.getElementById('prog-empresa').value = visita.empresa;
    document.getElementById('prog-motivo').value = visita.motivo;
    document.getElementById('prog-anfitrion').value = visita.anfitrion;
    document.getElementById('prog-fecha').value = visita.fecha;
    visitasProgramadas = visitasProgramadas.filter(v => v.id !== selectedProgramacionId);
    renderProgramadas();
    cerrarModal(modalDetalle);
    selectedProgramacionId = null;
    const navProgramacion = document.querySelector('.nav-link[data-target="sec-programacion"]');
    if (navProgramacion) navProgramacion.click();
  });

  detailRegister.addEventListener('click', () => {
    if (!selectedProgramacionId) return;
    const visita = visitasProgramadas.find(v => v.id === selectedProgramacionId);
    if (!visita) return;
    programacionToRegister = visita;
    confirmVisitorName.textContent = `¿Registrar ingreso de ${visita.nombre}?`;
    confirmObs.value = "";
    cerrarModal(modalDetalle);
    modalConfirmarRegistro.classList.remove('hidden');
    modalConfirmarRegistro.setAttribute('aria-active', 'true');
    focusTrap(modalConfirmarRegistro);
  });

  detailCancelar.addEventListener('click', () => {
    if (!selectedProgramacionId) return;
    const visita = visitasProgramadas.find(v => v.id === selectedProgramacionId);
    if (!visita) return;
    if (confirm(`¿Cancelar la visita programada de ${visita.nombre}?`)) {
      window.AppState.historial.agregarHistorial({ fecha: new Date().toISOString(), tipoDoc: visita.tipoDoc, numDoc: visita.numDoc, nombre: visita.nombre, empresa: visita.empresa, motivo: visita.motivo, anfitrion: visita.anfitrion, estado: "Cancelada", obs: "" });
      visitasProgramadas = visitasProgramadas.filter(v => v.id !== selectedProgramacionId);
      renderProgramadas();
      cerrarModal(modalDetalle);
      selectedProgramacionId = null;
    }
  });

  confirmCancel.addEventListener('click', () => { cerrarModal(modalConfirmarRegistro); programacionToRegister = null; });
  modalConfirmarRegistro.addEventListener('click', (e) => { if (e.target === modalConfirmarRegistro) { cerrarModal(modalConfirmarRegistro); programacionToRegister = null; } });
  confirmOk.addEventListener('click', () => {
    if (!programacionToRegister) return;
    window.AppState.registro.personasEnPlanta.push({
      id: Date.now(),
      nombre: programacionToRegister.nombre,
      empresa: programacionToRegister.empresa,
      documento: programacionToRegister.numDoc,
      anfitrion: programacionToRegister.anfitrion
    });
    window.AppState.historial.agregarHistorial({ fecha: new Date().toISOString(), tipoDoc: programacionToRegister.tipoDoc, numDoc: programacionToRegister.numDoc, nombre: programacionToRegister.nombre, empresa: programacionToRegister.empresa, motivo: programacionToRegister.motivo, anfitrion: programacionToRegister.anfitrion, estado: "Ingreso (Programado)", obs: confirmObs.value.trim(), fechaProgramada: programacionToRegister.fecha });
    visitasProgramadas = visitasProgramadas.filter(v => v.id !== programacionToRegister.id);
    window.AppState.registro.renderVisitors();
    renderProgramadas();
    cerrarModal(modalConfirmarRegistro);
    programacionToRegister = null;
    alert('Visita registrada correctamente en Planta.');
  });

  window.AppState = window.AppState || {};
  window.AppState.programacion = { renderProgramadas };
})();
