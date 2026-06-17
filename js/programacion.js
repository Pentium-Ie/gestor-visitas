(function() {
  const formProgramacion = document.getElementById('form-programacion');
  const progSubmitBtn = formProgramacion?.querySelector('.btn-submit');
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
  let editandoId = null;

  async function renderProgramadas() {
    if (!scheduledVisitorsList) return;
    toggleLoading(true);
    try {
      const { data, error } = await supabase
        .from('visitas')
        .select('*, visitantes!inner(*), anfitriones!left(*)')
        .eq('estado', 'programado')
        .order('fecha_programada', { ascending: true });
      if (error) throw error;
      visitasProgramadas = data || [];
      renderList();
    } catch (err) {
      console.error('Error cargando programadas:', err);
      logError('error', 'Error cargando programadas', err.message);
      scheduledVisitorsList.innerHTML = '<p class="empty-state">Error al cargar datos.</p>';
    } finally {
      toggleLoading(false);
    }
  }

  function renderList() {
    if (visitasProgramadas.length === 0) {
      scheduledVisitorsList.innerHTML = '<p class="empty-state">No hay visitas programadas.</p>';
      return;
    }
    const fragment = document.createDocumentFragment();
    visitasProgramadas.forEach(visita => {
      const v = visita.visitantes;
      const anfitrionNombre = visita.anfitriones?.nombre || '—';
      const card = document.createElement('div');
      card.className = 'scheduled-card';
      const fechaLocal = new Date(visita.fecha_programada);
      const fechaStr = fechaLocal.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
      const horaStr = fechaLocal.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      card.innerHTML = `
        <div class="scheduled-info">
          <p>${escapeHtml(v.nombre)}</p>
          <span>${escapeHtml(v.empresa)} • Ref: ${escapeHtml(anfitrionNombre)}</span>
        </div>
        <div class="scheduled-meta">${fechaStr} ${horaStr}</div>
        <button class="btn-detail" data-id="${visita.id}" type="button">Detalle</button>`;
      fragment.appendChild(card);
    });
    scheduledVisitorsList.innerHTML = "";
    scheduledVisitorsList.appendChild(fragment);
  }

  scheduledVisitorsList.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-detail');
    if (btn) openDetailModal(btn.getAttribute('data-id'));
  });

  function openDetailModal(id) {
    const visita = visitasProgramadas.find(v => v.id === id);
    if (!visita) return;
    selectedProgramacionId = id;
    const v = visita.visitantes;
    const anfitrionNombre = visita.anfitriones?.nombre || '—';
    const fechaLocal = new Date(visita.fecha_programada);
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
    if (!validarFormulario(['prog-nombre', 'prog-numdoc', 'prog-motivo', 'prog-anfitrion'])) return;
    const tipoDoc = document.getElementById('prog-tipodoc').value;
    const numDoc = document.getElementById('prog-numdoc').value.trim();
    if (tipoDoc === 'DNI' && !/^\d{8}$/.test(numDoc)) { mostrarToast('El DNI debe tener exactamente 8 dígitos.', 'error'); return; }
    const fecha = document.getElementById('prog-fecha').value;
    if (!fecha) return;
    const fechaVisita = new Date(fecha);
    if (fechaVisita < new Date()) { mostrarToast('La fecha debe ser futura.', 'error'); return; }
    if (fechaVisita.getHours() < 7 || fechaVisita.getHours() >= 19) { mostrarToast('La hora debe estar entre 07:00 y 19:00.', 'error'); return; }
    const nombre = document.getElementById('prog-nombre').value.trim();
    const empresa = document.getElementById('prog-empresa').value.trim() || 'Particular';
    const motivo = document.getElementById('prog-motivo').value.trim();
    const anfitrionInput = document.getElementById('prog-anfitrion').value.trim();

    toggleLoading(true);
    disableButton(progSubmitBtn, editandoId ? 'Reprogramando...' : 'Agendando...');
    try {
      const visitanteId = await buscarOCrearVisitante(tipoDoc, numDoc, nombre, empresa);
      const anfitrionId = await buscarAnfitrion(anfitrionInput);
      if (!anfitrionId) { mostrarToast('Seleccione un anfitrión válido de la lista.', 'error'); toggleLoading(false); enableButton(progSubmitBtn); return; }
      const userId = await getCurrentUserId();

      if (editandoId) {
        const { error: upErr } = await supabase.from('visitas').update({
          fecha_programada: new Date(fecha).toISOString(),
          motivo: motivo || null,
          anfitrion_id: anfitrionId
        }).eq('id', editandoId);
        if (upErr) throw upErr;

        const { error: histErr } = await supabase.from('historial').insert({
          visita_id: editandoId,
          visitante_id: visitanteId,
          tipo_doc: tipoDoc,
          num_doc: numDoc,
          nombre: nombre,
          empresa: empresa,
          motivo: motivo || null,
          anfitrion_id: anfitrionId,
          anfitrion_nombre: anfitrionInput,
          estado: 'reprogramado',
          obs: '',
          fecha: new Date().toISOString(),
          fecha_programada: new Date(fecha).toISOString(),
          creado_por: userId,
          grupo_id: generarUUID()
        });
        if (histErr) throw histErr;

        editandoId = null;
        mostrarToast('Visita reprogramada correctamente.');
      } else {
        const { data: nuevaVisita, error: insErr } = await supabase.from('visitas').insert({
          visitante_id: visitanteId,
          anfitrion_id: anfitrionId,
          motivo: motivo || null,
          fecha_programada: new Date(fecha).toISOString(),
          estado: 'programado',
          creado_por: userId
        }).select('id').single();
        if (insErr) throw insErr;

        const grupoId = generarUUID();
        const { error: histErr } = await supabase.from('historial').insert({
          visita_id: nuevaVisita.id,
          visitante_id: visitanteId,
          tipo_doc: tipoDoc,
          num_doc: numDoc,
          nombre: nombre,
          empresa: empresa,
          motivo: motivo || null,
          anfitrion_id: anfitrionId,
          anfitrion_nombre: anfitrionInput,
          estado: 'programado',
          obs: '',
          fecha: new Date().toISOString(),
          fecha_programada: new Date(fecha).toISOString(),
          creado_por: userId,
          grupo_id: grupoId
        });
        if (histErr) throw histErr;

        mostrarToast('Visita programada correctamente.');
      }

      formProgramacion.reset();
      document.querySelectorAll('#form-programacion input, #form-programacion select, #form-programacion textarea').forEach(el => el.style.borderColor = '');
      await renderProgramadas();
    } catch (err) {
      console.error('Error agendando visita:', err);
      logError('error', 'Error agendando visita', err.message);
      mostrarToast('Error al agendar visita.', 'error');
    } finally {
      toggleLoading(false);
      enableButton(progSubmitBtn);
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
    document.getElementById('prog-fecha').value = visita.fecha_programada.slice(0, 16);
    editandoId = visita.id;
    cerrarModal(modalDetalle);
    selectedProgramacionId = null;
    if (window.AppState.showSection) window.AppState.showSection('sec-programacion');
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

  const modalCancelar = document.getElementById('modal-confirmar-cancelacion');
  const cancelVisitorName = document.getElementById('cancel-visitor-name');
  const cancelObs = document.getElementById('cancel-obs');
  const cancelNo = document.getElementById('cancel-no');
  const cancelYes = document.getElementById('cancel-yes');

  detailCancelar.addEventListener('click', () => {
    if (!selectedProgramacionId) return;
    const visita = visitasProgramadas.find(v => v.id === selectedProgramacionId);
    if (!visita) return;
    cancelVisitorName.textContent = '¿Cancelar la visita programada de ' + visita.visitantes.nombre + '?';
    cancelObs.value = '';
    cerrarModal(modalDetalle);
    modalCancelar.classList.remove('hidden');
    modalCancelar.setAttribute('aria-active', 'true');
    focusTrap(modalCancelar);
  });

  cancelNo.addEventListener('click', () => { cerrarModal(modalCancelar); });
  modalCancelar.addEventListener('click', (e) => { if (e.target === modalCancelar) cerrarModal(modalCancelar); });

  cancelYes.addEventListener('click', async () => {
    if (!selectedProgramacionId) return;
    const visita = visitasProgramadas.find(v => v.id === selectedProgramacionId);
    if (!visita) return;
    const obs = cancelObs.value.trim();

    toggleLoading(true);
    disableButton(cancelYes, 'Cancelando...');
    try {
      const v = visita.visitantes;
      const userId = await getCurrentUserId();

      const { error: upErr } = await supabase.from('visitas').update({ estado: 'cancelado' }).eq('id', selectedProgramacionId);
      if (upErr) throw upErr;

      const { error: histErr } = await supabase.from('historial').insert({
        visita_id: selectedProgramacionId,
        visitante_id: v.id,
        tipo_doc: v.tipo_doc,
        num_doc: v.num_doc,
        nombre: v.nombre,
        empresa: v.empresa,
        motivo: visita.motivo || null,
        anfitrion_id: visita.anfitrion_id,
        anfitrion_nombre: visita.anfitriones?.nombre || '—',
        estado: 'cancelada',
        obs,
        fecha: new Date().toISOString(),
        fecha_programada: visita.fecha_programada,
        creado_por: userId,
        grupo_id: generarUUID()
      });
      if (histErr) throw histErr;

      cerrarModal(modalCancelar);
      selectedProgramacionId = null;
      await renderProgramadas();
      mostrarToast('Visita cancelada correctamente.');
    } catch (err) {
      console.error('Error cancelando visita:', err);
      logError('error', 'Error cancelando visita', err.message);
      mostrarToast('Error al cancelar.', 'error');
    } finally {
      toggleLoading(false);
      enableButton(cancelYes);
    }
  });

  confirmCancel.addEventListener('click', () => { cerrarModal(modalConfirmarRegistro); programacionToRegister = null; });
  modalConfirmarRegistro.addEventListener('click', (e) => { if (e.target === modalConfirmarRegistro) { cerrarModal(modalConfirmarRegistro); programacionToRegister = null; } });
  confirmOk.addEventListener('click', async () => {
    if (!programacionToRegister) return;
    const obs = confirmObs.value.trim();

    toggleLoading(true);
    disableButton(confirmOk, 'Registrando...');
    try {
      const visita = programacionToRegister;
      const v = visita.visitantes;
      const userId = await getCurrentUserId();

      const { error: upErr } = await supabase.from('visitas').update({
        estado: 'ingresado',
        fecha_ingreso: new Date().toISOString(),
        obs_ingreso: obs
      }).eq('id', visita.id);
      if (upErr) throw upErr;

      const grupoId = generarUUID();
      const { error: histErr } = await supabase.from('historial').insert({
        visita_id: visita.id,
        visitante_id: v.id,
        tipo_doc: v.tipo_doc,
        num_doc: v.num_doc,
        nombre: v.nombre,
        empresa: v.empresa,
        motivo: visita.motivo || null,
        anfitrion_id: visita.anfitrion_id,
        anfitrion_nombre: visita.anfitriones?.nombre || '—',
        estado: 'ingreso_programado',
        obs,
        fecha: new Date().toISOString(),
        fecha_programada: visita.fecha_programada,
        creado_por: userId,
        grupo_id: grupoId
      });
      if (histErr) throw histErr;

      cerrarModal(modalConfirmarRegistro);
      programacionToRegister = null;
      await renderProgramadas();
      if (window.AppState.registro && typeof window.AppState.registro.renderVisitors === 'function') {
        await window.AppState.registro.renderVisitors();
      }
      mostrarToast('Visita registrada correctamente en Planta.');
    } catch (err) {
      console.error('Error registrando ingreso desde programada:', err);
      logError('error', 'Error registrando ingreso desde programada', err.message);
      mostrarToast('Error al registrar ingreso.', 'error');
    } finally {
      toggleLoading(false);
      enableButton(confirmOk);
    }
  });

  let docTimeout;
  document.getElementById('prog-numdoc').addEventListener('input', () => {
    clearTimeout(docTimeout);
    docTimeout = setTimeout(async () => {
      const tipoDoc = document.getElementById('prog-tipodoc').value;
      const numDoc = document.getElementById('prog-numdoc').value.trim();
      const visitante = await buscarVisitantePorDoc(tipoDoc, numDoc);
      if (visitante) {
        document.getElementById('prog-nombre').value = visitante.nombre;
        document.getElementById('prog-empresa').value = visitante.empresa === 'Particular' ? '' : visitante.empresa;
      }
    }, 300);
  });
  initAutocomplete('prog-anfitrion', 'anfitriones', 'nombre');

  window.AppState = window.AppState || {};
  window.AppState.programacion = { renderProgramadas };
})();
