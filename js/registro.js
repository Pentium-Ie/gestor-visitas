(function() {
  const formRegistro = document.getElementById('form-registro');
  const regSubmitBtn = formRegistro?.querySelector('.btn-submit');
  const activeVisitorsList = document.getElementById('active-visitors-list');

  const modal = document.getElementById('modal-salida');
  const modalVisitorInfo = document.getElementById('modal-visitor-info');
  const exitObs = document.getElementById('exit-obs');
  const modalCancel = document.getElementById('modal-cancel');
  const modalConfirm = document.getElementById('modal-confirm');

  const modalVisitorDetail = document.getElementById('modal-visitor-detail');
  const modalVisitorDetailContent = document.getElementById('modal-visitor-detail-content');
  const modalVisitorDetailClose = document.getElementById('modal-visitor-detail-close');

  let visitasActivas = [];
  let visitorToCheckoutId = null;

  async function renderVisitors() {
    if (!activeVisitorsList) return;
    mostrarSkeleton(activeVisitorsList, 'card', 3);
    try {
      const { data, error } = await supabase
        .from('visitas')
        .select('*, visitantes!inner(*), anfitriones!left(*), autorizadores!left(*)')
        .eq('estado', 'Ingresado')
        .order('fecha_ingreso', { ascending: false });
      if (error) throw error;
      visitasActivas = data || [];
      renderList();
    } catch (err) {
      console.error('Error cargando visitas activas:', err);
      logError('error', 'Error cargando visitas activas', err.message);
      activeVisitorsList.innerHTML = '<p class="empty-state">Error al cargar datos.</p>';
    } finally { }
  }

  function formatDuration(isoStart) {
    if (!isoStart) return '';
    const diff = Date.now() - new Date(isoStart).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rest = mins % 60;
    return `${hrs}h ${rest}m`;
  }

  function renderList() {
    if (visitasActivas.length === 0) {
      activeVisitorsList.innerHTML = '<p class="empty-state">No hay visitas en planta.</p>';
      return;
    }
    const fragment = document.createDocumentFragment();
    visitasActivas.forEach(entry => {
      const v = entry.visitantes;
      const anfitrionNombre = entry.anfitriones?.nombre || '—';
      const duracion = formatDuration(entry.fecha_ingreso);
      const card = document.createElement('div');
      card.className = 'visitor-card';
      card.innerHTML = `
        <div class="visitor-info">
          <p>${escapeHtml(v.nombre)} <span class="duration-badge">${duracion}</span></p>
          <span>${escapeHtml(v.empresa)} • Ref: ${escapeHtml(anfitrionNombre)}</span>
        </div>
        <div class="visitor-actions">
          <button class="btn-detail" data-id="${entry.id}" type="button">Detalle</button>
          <button class="btn-checkout" data-id="${entry.id}" type="button">Salida</button>
        </div>`;
      fragment.appendChild(card);
    });
    activeVisitorsList.innerHTML = "";
    activeVisitorsList.appendChild(fragment);
  }

  activeVisitorsList.addEventListener('click', (e) => {
    const checkoutBtn = e.target.closest('.btn-checkout');
    if (checkoutBtn) return openCheckoutModal(checkoutBtn.getAttribute('data-id'));
    const detailBtn = e.target.closest('.btn-detail');
    if (detailBtn) openVisitorDetail(detailBtn.getAttribute('data-id'));
  });

  function openCheckoutModal(id) {
    const entry = visitasActivas.find(p => p.id === id);
    if (!entry) return;
    visitorToCheckoutId = id;
    modalVisitorInfo.textContent = `¿Confirmar la salida de ${entry.visitantes.nombre}?`;
    exitObs.value = "";
    modal.classList.remove('hidden');
    modal.setAttribute('aria-active', 'true');
    focusTrap(modal);
  }

  function openVisitorDetail(id) {
    const entry = visitasActivas.find(p => p.id === id);
    if (!entry) return;
    const v = entry.visitantes;
    modalVisitorDetailContent.innerHTML = `
      <span class="label">Documento</span><span class="value">${escapeHtml(v.tipo_doc)}: ${escapeHtml(v.num_doc)}</span>
      <span class="label">Nombre</span><span class="value">${escapeHtml(v.nombre)}</span>
      <span class="label">Empresa</span><span class="value">${escapeHtml(v.empresa)}</span>
      <span class="label">Anfitrión</span><span class="value">${escapeHtml(entry.anfitriones?.nombre || '—')}</span>
      <span class="label">Autorizador</span><span class="value">${escapeHtml(entry.autorizadores?.nombre || '—')}</span>
      <span class="label">Motivo</span><span class="value">${escapeHtml(entry.motivo) || '—'}</span>
      <span class="label">Observaciones</span><span class="value">${escapeHtml(entry.obs_ingreso) || '—'}</span>`;
    modalVisitorDetail.classList.remove('hidden');
    modalVisitorDetail.setAttribute('aria-active', 'true');
    focusTrap(modalVisitorDetail);
  }

  formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validarFormulario(['reg-nombre', 'reg-numdoc', 'reg-motivo', 'reg-anfitrion'])) return;
    const tipoDoc = document.getElementById('reg-tipodoc').value;
    const numDoc = document.getElementById('reg-numdoc').value.trim();
    if (tipoDoc === 'DNI' && !/^\d{8}$/.test(numDoc)) { mostrarToast('El DNI debe tener exactamente 8 dígitos.', 'error'); return; }
    const nombre = document.getElementById('reg-nombre').value.trim();
    const empresa = document.getElementById('reg-empresa').value.trim() || 'Particular';
    const motivo = document.getElementById('reg-motivo').value.trim();
    const anfitrionInput = document.getElementById('reg-anfitrion').value.trim();
    const autorizadorInput = document.getElementById('reg-autorizador').value.trim();
    const obs = document.getElementById('reg-obs').value.trim();

    const duplicado = visitasActivas.some(p => p.visitantes.num_doc === numDoc);
    if (duplicado) { mostrarToast('Esta persona ya se encuentra registrada en planta.', 'error'); return; }

    toggleLoading(true);
    disableButton(regSubmitBtn, 'Registrando...');
    try {
      const visitanteId = await buscarOCrearVisitante(tipoDoc, numDoc, nombre, empresa);
      const anfitrionId = await buscarAnfitrion(anfitrionInput);
      if (!anfitrionId) { mostrarToast('Seleccione un anfitrión válido de la lista.', 'error'); toggleLoading(false); return; }
      const autorizadorId = autorizadorInput ? await buscarPorNombre('autorizadores', autorizadorInput) : null;
      const userId = await getCurrentUserId();
      const fechaIngreso = new Date().toISOString();

      const { data: visita, error: visErr } = await supabase.from('visitas').insert({
        visitante_id: visitanteId, anfitrion_id: anfitrionId, motivo: motivo || null,
        obs_ingreso: obs, fecha_ingreso: fechaIngreso, estado: 'Ingresado', creado_por: userId,
        autorizador_id: autorizadorId
      }).select('id').single();
      if (visErr) throw visErr;

      const grupoId = generarUUID();
      const { error: histErr } = await supabase.from('historial').insert({
        visitante_id: visitanteId, tipo_doc: tipoDoc, num_doc: numDoc,
        nombre, empresa, motivo: motivo || null, anfitrion_id: anfitrionId,
        anfitrion_nombre: anfitrionInput, estado: 'Ingresado', obs,
        fecha: fechaIngreso, creado_por: userId, grupo_id: grupoId,
        visita_id: visita.id, autorizador: autorizadorInput || null
      });
      if (histErr) throw histErr;

      formRegistro.reset();
      document.querySelectorAll('#form-registro input, #form-registro select, #form-registro textarea').forEach(el => el.style.borderColor = '');
      await renderVisitors();
      mostrarToast('Ingreso registrado correctamente.');
    } catch (err) {
      console.error('Error registrando ingreso:', err);
      logError('error', 'Error registrando ingreso', err.message);
      mostrarToast('Error al registrar ingreso.', 'error');
    } finally {
      toggleLoading(false);
      enableButton(regSubmitBtn);
    }
  });

  modalCancel.addEventListener('click', () => { cerrarModal(modal); visitorToCheckoutId = null; });
  modalConfirm.addEventListener('click', async () => {
    if (visitorToCheckoutId === null) return;
    const obs = exitObs.value.trim();
    if (obs.length < 4) { mostrarToast('La observación de salida debe tener al menos 4 caracteres.', 'error'); return; }

    toggleLoading(true);
    disableButton(modalConfirm, 'Registrando...');
    try {
      const entry = visitasActivas.find(p => p.id === visitorToCheckoutId);
      if (!entry) throw new Error('Visita no encontrada');
      if (entry.estado !== 'Ingresado') { mostrarToast('La visita ya no está en planta.', 'error'); cerrarModal(modal); visitorToCheckoutId = null; toggleLoading(false); enableButton(modalConfirm); return; }
      const v = entry.visitantes;
      const userId = await getCurrentUserId();

      const { error: upErr } = await supabase.from('visitas').update({
        fecha_salida: new Date().toISOString(), obs_salida: obs, estado: 'Retirado'
      }).eq('id', visitorToCheckoutId);
      if (upErr) throw upErr;

      const { data: histGrupo } = await supabase.from('historial')
        .select('grupo_id')
        .eq('visita_id', visitorToCheckoutId)
        .limit(1);

      const { error: histErr } = await supabase.from('historial').insert({
        visitante_id: v.id, tipo_doc: v.tipo_doc, num_doc: v.num_doc,
        nombre: v.nombre, empresa: v.empresa, motivo: entry.motivo || null,
        anfitrion_id: entry.anfitrion_id, anfitrion_nombre: entry.anfitriones?.nombre || '—',
        estado: 'Retirado', obs, fecha: new Date().toISOString(),
        creado_por: userId, grupo_id: (histGrupo && histGrupo.length > 0) ? histGrupo[0].grupo_id : generarUUID(),
        visita_id: visitorToCheckoutId,
        autorizador: entry.autorizadores?.nombre || null
      });
      if (histErr) throw histErr;

      cerrarModal(modal);
      visitorToCheckoutId = null;
      await renderVisitors();
      mostrarToast('Salida registrada correctamente.');
    } catch (err) {
      console.error('Error registrando salida:', err);
      logError('error', 'Error registrando salida', err.message);
      mostrarToast('Error al registrar salida.', 'error');
    } finally {
      toggleLoading(false);
      enableButton(modalConfirm);
    }
  });

  modalVisitorDetailClose.addEventListener('click', () => cerrarModal(modalVisitorDetail));
  modalVisitorDetail.addEventListener('click', (e) => { if (e.target === modalVisitorDetail) cerrarModal(modalVisitorDetail); });

  let docTimeout;
  document.getElementById('reg-numdoc').addEventListener('input', () => {
    clearTimeout(docTimeout);
    docTimeout = setTimeout(async () => {
      const tipoDoc = document.getElementById('reg-tipodoc').value;
      const numDoc = document.getElementById('reg-numdoc').value.trim();
      const visitante = await buscarVisitantePorDoc(tipoDoc, numDoc);
      if (visitante) {
        document.getElementById('reg-nombre').value = visitante.nombre;
        document.getElementById('reg-empresa').value = visitante.empresa === 'Particular' ? '' : visitante.empresa;
      }
    }, 300);
  });
  initAutocomplete('reg-anfitrion', 'anfitriones', 'nombre');
  initAutocomplete('reg-autorizador', 'autorizadores', 'nombre');
  initCharCount('exit-obs', 'exit-obs-count', 4);
  initCharCount('confirm-obs', 'confirm-obs-count');
  initCharCount('cancel-obs', 'cancel-obs-count');

  document.getElementById('btn-limpiar-registro')?.addEventListener('click', () => {
    document.getElementById('form-registro').reset();
    document.querySelectorAll('#form-registro input, #form-registro select, #form-registro textarea').forEach(el => el.style.borderColor = '');
  });

  setInterval(() => { if (visitasActivas.length > 0) renderVisitors(); }, 60000);

  window.AppState = window.AppState || {};
  window.AppState.registro = { renderVisitors };
})();
