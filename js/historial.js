(function() {
  const historialBody = document.getElementById('historial-body');
  const historialSearch = document.getElementById('historial-search');
  const historialSearchCol = document.getElementById('historial-search-col');
  const historialFechaInicio = document.getElementById('historial-fecha-inicio');
  const historialFechaFin = document.getElementById('historial-fecha-fin');
  const modalHistorialDetail = document.getElementById('modal-historial-detail');
  const modalHistorialDetailContent = document.getElementById('historial-detail-content');
  const historialDetailClose = document.getElementById('historial-detail-close');

  const COL_MAP = { nombre: 'visitantes.nombre', empresa: 'visitantes.empresa', motivo: 'motivo', anfitrion: 'anfitriones.nombre' };
  let visitasData = [];

  async function loadHistorial() {
    if (!historialBody) return;
    toggleLoading(true);
    try {
      const search = historialSearch.value.trim();
      const searchCol = COL_MAP[historialSearchCol.value] || 'visitantes.nombre';
      const fechaInicio = historialFechaInicio.value;
      const fechaFin = historialFechaFin.value;

      let query = supabase.from('visitas').select('*, visitantes!inner(*), anfitriones!left(*)');
      if (search) query = query.ilike(searchCol, `%${search}%`);
      if (fechaInicio) query = query.gte('fecha_ingreso', fechaInicio + 'T00:00:00');
      if (fechaFin) query = query.lte('fecha_ingreso', fechaFin + 'T23:59:59');

      const { data, error } = await query.order('fecha_ingreso', { ascending: false, nullsLast: true }).limit(1000);
      if (error) throw error;
      visitasData = data || [];
      renderTable();
    } catch (err) {
      console.error('Error cargando historial:', err);
      historialBody.innerHTML = '<tr><td colspan="8"><p class="empty-state" style="margin:30px 0;">Error al cargar historial.</p></td></tr>';
      mostrarToast('Error al cargar historial: ' + err.message, 'error');
    } finally {
      toggleLoading(false);
    }
  }

  function formatDate(isoStr) {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    return { fecha: d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }), hora: d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) };
  }

  function renderTable() {
    if (visitasData.length === 0) {
      historialBody.innerHTML = '<tr><td colspan="8"><p class="empty-state" style="margin:30px 0;">No se encontraron registros.</p></td></tr>';
      return;
    }
    const fragment = document.createDocumentFragment();
    visitasData.forEach(entry => {
      const dt = formatDate(entry.fecha_ingreso || entry.fecha_programada || entry.created_at);
      const fechaStr = dt ? dt.fecha : '—';
      const horaStr = dt ? dt.hora : '';
      const estado = entry.estado === 'programado' ? 'Programado' : entry.estado === 'ingresado' ? 'Ingresado' : entry.estado === 'retirado' ? 'Retirado' : entry.estado === 'cancelado' ? 'Cancelado' : entry.estado || '—';
      const estadoClass = (entry.estado || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const anfitrion = entry.anfitriones ? entry.anfitriones.nombre : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Fecha/Hora">${fechaStr}${horaStr ? '<br><span class="hora">' + horaStr + '</span>' : ''}</td>
        <td data-label="Documento">${escapeHtml(entry.visitantes.tipo_doc)}: ${escapeHtml(entry.visitantes.num_doc)}</td>
        <td data-label="Nombre">${escapeHtml(entry.visitantes.nombre)}</td>
        <td data-label="Empresa">${escapeHtml(entry.visitantes.empresa)}</td>
        <td data-label="Motivo">${escapeHtml(entry.motivo || '—')}</td>
        <td data-label="Anfitrión">${escapeHtml(anfitrion)}</td>
        <td data-label="Estado"><span class="estado-badge estado-${estadoClass}">${escapeHtml(estado)}</span></td>
        <td data-label="Acción"><button class="btn-historial-detail" data-id="${escapeHtml(entry.id)}" type="button">Detalle</button></td>`;
      fragment.appendChild(tr);
    });
    historialBody.innerHTML = "";
    historialBody.appendChild(fragment);
  }

  historialBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-historial-detail');
    if (btn) openHistorialDetail(btn.getAttribute('data-id'));
  });

  function openHistorialDetail(id) {
    const entry = visitasData.find(v => v.id === id);
    if (!entry) return;
    const dp = entry.fecha_programada ? formatDate(entry.fecha_programada) : null;
    const di = entry.fecha_ingreso ? formatDate(entry.fecha_ingreso) : null;
    const ds = entry.fecha_salida ? formatDate(entry.fecha_salida) : null;
    const anfitrion = entry.anfitriones ? entry.anfitriones.nombre : '—';
    const obs = [entry.obs_ingreso, entry.obs_salida].filter(Boolean).join(' / ');
    modalHistorialDetailContent.innerHTML = `
      <span class="label">Documento</span><span class="value">${escapeHtml(entry.visitantes.tipo_doc)}: ${escapeHtml(entry.visitantes.num_doc)}</span>
      <span class="label">Nombre</span><span class="value">${escapeHtml(entry.visitantes.nombre)}</span>
      <span class="label">Empresa</span><span class="value">${escapeHtml(entry.visitantes.empresa)}</span>
      <span class="label">Motivo</span><span class="value">${escapeHtml(entry.motivo || '—')}</span>
      <span class="label">Anfitrión</span><span class="value">${escapeHtml(anfitrion)}</span>
      ${dp ? `<span class="label">Fecha Programada</span><span class="value">${dp.fecha} — ${dp.hora}</span>` : ''}
      ${di ? `<span class="label">Fecha Ingreso</span><span class="value">${di.fecha} — ${di.hora}</span>` : ''}
      ${ds ? `<span class="label">Fecha Salida</span><span class="value">${ds.fecha} — ${ds.hora}</span>` : ''}
      <span class="label">Estado</span><span class="value">${escapeHtml(entry.estado || '—')}</span>
      <span class="label full-row">Observaciones</span>
      <span class="value full-row observaciones">${escapeHtml(obs || '—')}</span>`;
    modalHistorialDetail.classList.remove('hidden');
    modalHistorialDetail.setAttribute('aria-active', 'true');
    focusTrap(modalHistorialDetail);
  }

  historialDetailClose.addEventListener('click', () => cerrarModal(modalHistorialDetail));
  modalHistorialDetail.addEventListener('click', (e) => { if (e.target === modalHistorialDetail) cerrarModal(modalHistorialDetail); });

  let historialTimeout;
  historialSearch.addEventListener('input', () => {
    clearTimeout(historialTimeout);
    historialTimeout = setTimeout(loadHistorial, 300);
  });
  historialSearchCol.addEventListener('change', loadHistorial);
  historialFechaInicio.addEventListener('change', loadHistorial);
  historialFechaFin.addEventListener('change', loadHistorial);

  window.AppState = window.AppState || {};
  window.AppState.historial = { loadHistorial };
})();
