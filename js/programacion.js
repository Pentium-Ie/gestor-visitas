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

  let visitasProgramadas = [];
  let selectedProgramacionId = null;
  let programacionToRegister = null;

  async function renderProgramadas() {
    if (!scheduledVisitorsList) return;
    toggleLoading(true);
    try {
      const { data, error } = await supabase
        .from('programadas')
        .select('id, motivo, fecha, estado, visitantes!inner(id, tipo_doc, num_doc, nombre, empresa), anfitriones!left(nombre)')
        .eq('estado', 'pendiente')
        .order('fecha', { ascending: true });
      if (error) throw error;
      visitasProgramadas = data || [];
      renderList();
    } catch (err) {
      console.error('Error cargando programadas:', err);
      scheduledVisitorsList.innerHTML = '<p class="empty-state">Error al cargar datos.</p>';
    } finally {
      toggleLoading(false);
    }
  }

  function renderList() {
    scheduledVisitorsList.innerHTML = "";
    if (visitasProgramadas.length === 0) {
      scheduledVisitorsList.innerHTML = '<p class="empty-state">No hay visitas programadas.</p>';
      return;
    }
    visitasProgramadas.forEach(visita => {
      const v = visita.visitantes;
      const anfitrionNombre = visita.anfitriones?.nombre || '—';
      const card = document.createElement('div');
      card.className = 'scheduled-card';
      const fechaLocal = new Date(visita.fecha);
      const fechaStr = fechaLocal.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
      const horaStr = fechaLocal.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      card.innerHTML = `
        <div class="scheduled-info">
          <p>${escapeHtml(v.nombre)}</p>
          <span>${escapeHtml(v.empresa)} • Ref: ${escapeHtml(anfitrionNombre)}</span>
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
    const v = visita.visitantes;
    const anfitrionNombre = visita.anfitriones?.nombre || '—';
    const fechaLocal = new Date(visita.fecha);
    const fechaStr = fechaLocal.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    const horaStr = fechaLocal.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    detailContent.innerHTML = `
      <span class="label">Documento</span><span class="value">${escapeHtml(v.tipo_doc)}: ${escapeHtml(v.num_doc)}</span>
      <span class="label">Nombre</span><span class="value">${escapeHtml(v.nombre)}</span>
      <span class="label">Empresa</span><span class="value">${escapeHtml(v.empresa)}</span>
      <span class="label">Motivo</span><span class="value">${escapeHtml(visita.motivo || '—')}</span>
      <span class="label">Anfitrión</span><span class="value">${escapeHtml(anfitrionNombre)}</span>
      <span class="label">Fecha/Hora</span><span class="value">${fechaStr} — ${horaStr}</span>`;
    modalDetalle.classList.remove('hidden');
    modalDetalle.setAttribute('aria-active', 'true');
    focusTrap(modalDetalle);
  }

  formProgramacion.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validarFormulario(['prog-nombre', 'prog-numdoc', 'prog-anfitrion'])) return;
    const fecha = document.getElementById('prog-fecha').value;
    if (!fecha) return;
    const fechaVisita = new Date(fecha);
    if (fechaVisita < new Date()) { alert('La fecha debe ser futura.'); return; }

    const tipoDoc = document.getElementById('prog-tipodoc').value;
    const numDoc = document.getElementById('prog-numdoc').value.trim();
    const nombre = document.getElementById('prog-nombre').value.trim();
    const empresa = document.getElementById('prog-empresa').value.trim() || 'Particular';
    const motivo = document.getElementById('prog-motivo').value.trim();
    const anfitrionInput = document.getElementById('prog-anfitrion').value.trim();

    toggleLoading(true);
    try {
      const visitanteId = await buscarOCrearVisitante(tipoDoc, numDoc, nombre, empresa);
      const anfitrionId = await buscarOCrearAnfitrion(anfitrionInput);
      const userId = await getCurrentUserId();

      const { error } = await supabase.from('programadas').insert({
        visitante_id: visitanteId, motivo: motivo || null,
        anfitrion_id: anfitrionId, fecha: new Date(fecha).toISOString(),
        creado_por: userId
      });
      if (error) throw error;

      formProgramacion.reset();
      document.querySelectorAll('#form-programacion input, #form-programacion select, #form-programacion textarea').forEach(el => el.style.borderColor = '');
      await renderProgramadas();
    } catch (err) {
      console.error('Error agendando visita:', err);
      alert('Error al agendar visita.');
    } finally {
      toggleLoading(false);
    }
  });

  detailCancel.addEventListener('click', () => { cerrarModal(modalDetalle); selectedProgramacionId = null; });
  modalDetalle.addEventListener('click', (e) => { if (e.target === modalDetalle) { cerrarModal(modalDetalle); selectedProgramacionId = null; } });

  detailEdit.addEventListener('click', () => {
    if (!selectedProgramacionId) return;
    const visita = visitasProgramadas.find(v => v.id === selectedProgramacionId);
    if (!visita) return;
    const v = visita.visitantes;
    document.getElementById('prog-tipodoc').value = v.tipo_doc;
    document.getElementById('prog-numdoc').value = v.num_doc;
    document.getElementById('prog-nombre').value = v.nombre;
    document.getElementById('prog-empresa').value = v.empresa;
    document.getElementById('prog-motivo').value = visita.motivo || '';
    document.getElementById('prog-anfitrion').value = visita.anfitriones?.nombre || '';
    document.getElementById('prog-fecha').value = visita.fecha.slice(0, 16);
    cerrarModal(modalDetalle);
    selectedProgramacionId = null;
    const navProgramacion = document.querySelector('.nav-link[data-target="sec-programacion"]');
    if (navProgramacion) navProgramacion.click();
    setTimeout(async () => {
      await supabase.from('programadas').delete().eq('id', visita.id);
      await renderProgramadas();
    }, 100);
  });

  detailRegister.addEventListener('click', () => {
    if (!selectedProgramacionId) return;
    const visita = visitasProgramadas.find(v => v.id === selectedProgramacionId);
    if (!visita) return;
    programacionToRegister = visita;
    confirmVisitorName.textContent = `¿Registrar ingreso de ${visita.visitantes.nombre}?`;
    confirmObs.value = "";
    cerrarModal(modalDetalle);
    modalConfirmarRegistro.classList.remove('hidden');
    modalConfirmarRegistro.setAttribute('aria-active', 'true');
    focusTrap(modalConfirmarRegistro);
  });

  detailCancelar.addEventListener('click', async () => {
    if (!selectedProgramacionId) return;
    const visita = visitasProgramadas.find(v => v.id === selectedProgramacionId);
    if (!visita) return;
    if (!confirm(`¿Cancelar la visita programada de ${visita.visitantes.nombre}?`)) return;

    toggleLoading(true);
    try {
      const v = visita.visitantes;
      const userId = await getCurrentUserId();

      const { error: upErr } = await supabase.from('programadas').update({ estado: 'cancelado' }).eq('id', selectedProgramacionId);
      if (upErr) throw upErr;

      const { error: histErr } = await supabase.from('historial').insert({
        visitante_id: v.id, tipo_doc: v.tipo_doc, num_doc: v.num_doc,
        nombre: v.nombre, empresa: v.empresa, motivo: visita.motivo || null,
        anfitrion_id: visita.anfitrion_id,
        anfitrion_nombre: visita.anfitriones?.nombre || '—',
        estado: 'cancelada', obs: '', fecha: new Date().toISOString(),
        fecha_programada: visita.fecha, programada_id: visita.id, creado_por: userId
      });
      if (histErr) throw histErr;

      cerrarModal(modalDetalle);
      selectedProgramacionId = null;
      await renderProgramadas();
    } catch (err) {
      console.error('Error cancelando visita:', err);
      alert('Error al cancelar.');
    } finally {
      toggleLoading(false);
    }
  });

  confirmCancel.addEventListener('click', () => { cerrarModal(modalConfirmarRegistro); programacionToRegister = null; });
  modalConfirmarRegistro.addEventListener('click', (e) => { if (e.target === modalConfirmarRegistro) { cerrarModal(modalConfirmarRegistro); programacionToRegister = null; } });
  confirmOk.addEventListener('click', async () => {
    if (!programacionToRegister) return;
    const obs = confirmObs.value.trim();

    toggleLoading(true);
    try {
      const visita = programacionToRegister;
      const v = visita.visitantes;
      const userId = await getCurrentUserId();

      const { error: upErr } = await supabase.from('programadas').update({ estado: 'completado' }).eq('id', visita.id);
      if (upErr) throw upErr;

      const { data: ep, error: epErr } = await supabase.from('en_planta').insert({
        visitante_id: v.id, motivo: visita.motivo || null,
        anfitrion_id: visita.anfitrion_id, obs_ingreso: obs,
        programada_id: visita.id, creado_por: userId
      }).select('id, ingreso_en').single();
      if (epErr) throw epErr;

      const { error: histErr } = await supabase.from('historial').insert({
        visitante_id: v.id, tipo_doc: v.tipo_doc, num_doc: v.num_doc,
        nombre: v.nombre, empresa: v.empresa, motivo: visita.motivo || null,
        anfitrion_id: visita.anfitrion_id,
        anfitrion_nombre: visita.anfitriones?.nombre || '—',
        estado: 'ingreso_programado', obs, fecha: ep.ingreso_en,
        fecha_programada: visita.fecha, programada_id: visita.id, creado_por: userId
      });
      if (histErr) throw histErr;

      cerrarModal(modalConfirmarRegistro);
      programacionToRegister = null;
      await renderProgramadas();
      await window.AppState.registro.renderVisitors();
      alert('Visita registrada correctamente en Planta.');
    } catch (err) {
      console.error('Error registrando ingreso desde programada:', err);
      alert('Error al registrar ingreso.');
    } finally {
      toggleLoading(false);
    }
  });

  window.AppState = window.AppState || {};
  window.AppState.programacion = { renderProgramadas };
})();
