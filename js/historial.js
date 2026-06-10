(function() {
  const historialBody = document.getElementById('historial-body');
  const historialSearch = document.getElementById('historial-search');
  const historialSearchCol = document.getElementById('historial-search-col');
  const historialFechaInicio = document.getElementById('historial-fecha-inicio');
  const historialFechaFin = document.getElementById('historial-fecha-fin');
  const modalHistorialDetail = document.getElementById('modal-historial-detail');
  const modalHistorialDetailContent = document.getElementById('historial-detail-content');
  const historialDetailClose = document.getElementById('historial-detail-close');

  const historial = [];
  let historialSelectedId = null;

  function agregarHistorial(entry) {
    historial.unshift({ id: Date.now(), ...entry });
    renderHistorial();
  }

  function renderHistorial() {
    if (!historialBody) return;
    const search = historialSearch.value.toLowerCase().trim();
    const searchCol = historialSearchCol.value;
    const fechaInicio = historialFechaInicio.value;
    const fechaFin = historialFechaFin.value;

    const filtered = historial.filter(entry => {
      if (search) {
        const val = (entry[searchCol] || '').toLowerCase();
        if (!val.includes(search)) return false;
      }
      if (fechaInicio || fechaFin) {
        const d = new Date(entry.fecha);
        if (fechaInicio && d < new Date(fechaInicio + 'T00:00:00')) return false;
        if (fechaFin) {
          const fin = new Date(fechaFin + 'T23:59:59');
          if (d > fin) return false;
        }
      }
      return true;
    });

    historialBody.innerHTML = "";
    if (filtered.length === 0) {
      historialBody.innerHTML = '<tr><td colspan="8"><p class="empty-state" style="margin:30px 0;">No se encontraron registros.</p></td></tr>';
      return;
    }
    filtered.forEach(entry => {
      const d = new Date(entry.fecha);
      const fechaStr = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
      const horaStr = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Fecha/Hora">${fechaStr}<br><span class="hora">${horaStr}</span></td>
        <td data-label="Documento">${escapeHtml(entry.tipoDoc || 'DNI')}: ${escapeHtml(entry.numDoc)}</td>
        <td data-label="Nombre">${escapeHtml(entry.nombre)}</td>
        <td data-label="Empresa">${escapeHtml(entry.empresa)}</td>
        <td data-label="Motivo">${escapeHtml(entry.motivo || '—')}</td>
        <td data-label="Anfitrión">${escapeHtml(entry.anfitrion)}</td>
        <td data-label="Estado"><span class="estado-badge estado-${entry.estado.toLowerCase().replace(/[^a-záéíóú]/g, '')}">${escapeHtml(entry.estado)}</span></td>
        <td data-label="Acción"><button class="btn-historial-detail" data-id="${entry.id}" type="button">Detalle</button></td>`;
      historialBody.appendChild(tr);
    });
  }

  historialBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-historial-detail');
    if (btn) openHistorialDetail(parseInt(btn.getAttribute('data-id')));
  });

  function openHistorialDetail(id) {
    const entry = historial.find(h => h.id === id);
    if (!entry) return;
    historialSelectedId = id;
    const d = new Date(entry.fecha);
    const fechaStr = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    const horaStr = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    let fechaRows = `<span class="label">Fecha/Hora Ingreso</span><span class="value">${fechaStr} — ${horaStr}</span>`;
    if (entry.fechaProgramada) {
      const dp = new Date(entry.fechaProgramada);
      const fpStr = dp.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
      const hpStr = dp.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      fechaRows = `
        <span class="label">Fecha/Hora Programado</span><span class="value">${fpStr} — ${hpStr}</span>
        <span class="label">Fecha/Hora Ingreso</span><span class="value">${fechaStr} — ${horaStr}</span>`;
    }
    modalHistorialDetailContent.innerHTML = `
      <span class="label">Documento</span><span class="value">${escapeHtml(entry.tipoDoc || 'DNI')}: ${escapeHtml(entry.numDoc)}</span>
      <span class="label">Nombre</span><span class="value">${escapeHtml(entry.nombre)}</span>
      <span class="label">Empresa</span><span class="value">${escapeHtml(entry.empresa)}</span>
      <span class="label">Motivo</span><span class="value">${escapeHtml(entry.motivo || '—')}</span>
      <span class="label">Anfitrión</span><span class="value">${escapeHtml(entry.anfitrion)}</span>
      ${fechaRows}
      <span class="label">Estado</span><span class="value">${escapeHtml(entry.estado)}</span>
      <span class="label full-row">Observaciones</span>
      <span class="value full-row observaciones">${escapeHtml(entry.obs) || '—'}</span>`;
    modalHistorialDetail.classList.remove('hidden');
    modalHistorialDetail.setAttribute('aria-active', 'true');
    focusTrap(modalHistorialDetail);
  }

  historialDetailClose.addEventListener('click', () => cerrarModal(modalHistorialDetail));
  modalHistorialDetail.addEventListener('click', (e) => { if (e.target === modalHistorialDetail) cerrarModal(modalHistorialDetail); });

  historialSearch.addEventListener('input', renderHistorial);
  historialSearchCol.addEventListener('change', renderHistorial);
  historialFechaInicio.addEventListener('change', renderHistorial);
  historialFechaFin.addEventListener('change', renderHistorial);

  agregarHistorial({ fecha: "2026-06-10T08:30", tipoDoc: "DNI", numDoc: "44910293", nombre: "Carlos Mendoza", empresa: "Logística Perú", motivo: "Reunión de trabajo", anfitrion: "Gerencia TI", estado: "Ingreso", obs: "" });
  agregarHistorial({ fecha: "2026-06-10T09:00", tipoDoc: "DNI", numDoc: "72195510", nombre: "Ana Paula Rios", empresa: "TechSolutions", motivo: "Soporte técnico", anfitrion: "Área de Innovación", estado: "Ingreso", obs: "" });

  window.AppState = window.AppState || {};
  window.AppState.historial = { agregarHistorial };
})();
