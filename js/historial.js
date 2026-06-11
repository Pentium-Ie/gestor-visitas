(function() {
  const historialBody = document.getElementById('historial-body');
  const historialSearch = document.getElementById('historial-search');
  const historialSearchCol = document.getElementById('historial-search-col');
  const historialFechaInicio = document.getElementById('historial-fecha-inicio');
  const historialFechaFin = document.getElementById('historial-fecha-fin');
  const modalHistorialDetail = document.getElementById('modal-historial-detail');
  const modalHistorialDetailContent = document.getElementById('historial-detail-content');
  const historialDetailClose = document.getElementById('historial-detail-close');

  const COL_MAP = { nombre: 'nombre', empresa: 'empresa', motivo: 'motivo', anfitrion: 'anfitrion_nombre' };
  let historialData = [];

  async function loadHistorial() {
    if (!historialBody) return;
    toggleLoading(true);
    try {
      const search = historialSearch.value.trim();
      const searchCol = COL_MAP[historialSearchCol.value] || 'nombre';
      const fechaInicio = historialFechaInicio.value;
      const fechaFin = historialFechaFin.value;

      let query = supabase.from('historial').select('*');

      if (search) query = query.ilike(searchCol, `%${search}%`);
      if (fechaInicio) query = query.gte('fecha', fechaInicio + 'T00:00:00');
      if (fechaFin) query = query.lte('fecha', fechaFin + 'T23:59:59');

      const { data, error } = await query.order('fecha', { ascending: false }).limit(500);
      if (error) throw error;
      historialData = data || [];
      renderTable();
    } catch (err) {
      console.error('Error cargando historial:', err);
      historialBody.innerHTML = '<tr><td colspan="8"><p class="empty-state" style="margin:30px 0;">Error al cargar historial.</p></td></tr>';
    } finally {
      toggleLoading(false);
    }
  }

  function renderTable() {
    historialBody.innerHTML = "";
    if (historialData.length === 0) {
      historialBody.innerHTML = '<tr><td colspan="8"><p class="empty-state" style="margin:30px 0;">No se encontraron registros.</p></td></tr>';
      return;
    }
    historialData.forEach(entry => {
      const d = new Date(entry.fecha);
      const fechaStr = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
      const horaStr = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      const estadoClass = entry.estado.toLowerCase().replace(/[^a-záéíóú]/g, '');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Fecha/Hora">${fechaStr}<br><span class="hora">${horaStr}</span></td>
        <td data-label="Documento">${escapeHtml(entry.tipo_doc)}: ${escapeHtml(entry.num_doc)}</td>
        <td data-label="Nombre">${escapeHtml(entry.nombre)}</td>
        <td data-label="Empresa">${escapeHtml(entry.empresa)}</td>
        <td data-label="Motivo">${escapeHtml(entry.motivo || '—')}</td>
        <td data-label="Anfitrión">${escapeHtml(entry.anfitrion_nombre)}</td>
        <td data-label="Estado"><span class="estado-badge estado-${estadoClass}">${escapeHtml(entry.estado)}</span></td>
        <td data-label="Acción"><button class="btn-historial-detail" data-id="${entry.id}" type="button">Detalle</button></td>`;
      historialBody.appendChild(tr);
    });
  }

  historialBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-historial-detail');
    if (btn) openHistorialDetail(parseInt(btn.getAttribute('data-id')));
  });

  function openHistorialDetail(id) {
    const entry = historialData.find(h => h.id === id);
    if (!entry) return;
    const d = new Date(entry.fecha);
    const fechaStr = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    const horaStr = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    let fechaRows = `<span class="label">Fecha/Hora Ingreso</span><span class="value">${fechaStr} — ${horaStr}</span>`;
    if (entry.fecha_programada) {
      const dp = new Date(entry.fecha_programada);
      const fpStr = dp.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
      const hpStr = dp.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      fechaRows = `
        <span class="label">Fecha/Hora Programado</span><span class="value">${fpStr} — ${hpStr}</span>
        <span class="label">Fecha/Hora Ingreso</span><span class="value">${fechaStr} — ${horaStr}</span>`;
    }
    modalHistorialDetailContent.innerHTML = `
      <span class="label">Documento</span><span class="value">${escapeHtml(entry.tipo_doc)}: ${escapeHtml(entry.num_doc)}</span>
      <span class="label">Nombre</span><span class="value">${escapeHtml(entry.nombre)}</span>
      <span class="label">Empresa</span><span class="value">${escapeHtml(entry.empresa)}</span>
      <span class="label">Motivo</span><span class="value">${escapeHtml(entry.motivo || '—')}</span>
      <span class="label">Anfitrión</span><span class="value">${escapeHtml(entry.anfitrion_nombre)}</span>
      ${fechaRows}
      <span class="label">Estado</span><span class="value">${escapeHtml(entry.estado)}</span>
      <span class="label full-row">Observaciones</span>
      <span class="value full-row observaciones">${escapeHtml(entry.obs || '—')}</span>`;
    modalHistorialDetail.classList.remove('hidden');
    modalHistorialDetail.setAttribute('aria-active', 'true');
    focusTrap(modalHistorialDetail);
  }

  historialDetailClose.addEventListener('click', () => cerrarModal(modalHistorialDetail));
  modalHistorialDetail.addEventListener('click', (e) => { if (e.target === modalHistorialDetail) cerrarModal(modalHistorialDetail); });

  historialSearch.addEventListener('input', loadHistorial);
  historialSearchCol.addEventListener('change', loadHistorial);
  historialFechaInicio.addEventListener('change', loadHistorial);
  historialFechaFin.addEventListener('change', loadHistorial);

  window.AppState = window.AppState || {};
  window.AppState.historial = { loadHistorial };
})();
