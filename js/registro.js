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

  let personasEnPlanta = [];
  let visitorToCheckoutId = null;

  async function renderVisitors() {
    if (!activeVisitorsList) return;
    toggleLoading(true);
    try {
      const { data, error } = await supabase
        .from('en_planta')
        .select('id, motivo, obs_ingreso, ingreso_en, programada_id, visitantes!inner(id, tipo_doc, num_doc, nombre, empresa), anfitriones!left(nombre)')
        .is('salida_en', null)
        .order('ingreso_en', { ascending: false });
      if (error) throw error;
      personasEnPlanta = data || [];
      renderList();
    } catch (err) {
      console.error('Error cargando planta:', err);
      activeVisitorsList.innerHTML = '<p class="empty-state">Error al cargar datos.</p>';
    } finally {
      toggleLoading(false);
    }
  }

  function renderList() {
    activeVisitorsList.innerHTML = "";
    if (personasEnPlanta.length === 0) {
      activeVisitorsList.innerHTML = '<p class="empty-state">No hay visitas en planta.</p>';
      return;
    }
    personasEnPlanta.forEach(entry => {
      const v = entry.visitantes;
      const anfitrionNombre = entry.anfitriones?.nombre || '—';
      const card = document.createElement('div');
      card.className = 'visitor-card';
      card.innerHTML = `
        <div class="visitor-info">
          <p>${escapeHtml(v.nombre)}</p>
          <span>${escapeHtml(v.empresa)} • Ref: ${escapeHtml(anfitrionNombre)}</span>
        </div>
        <div class="visitor-actions">
          <button class="btn-detail" data-id="${entry.id}" type="button">Detalle</button>
          <button class="btn-checkout" data-id="${entry.id}" type="button">Salida</button>
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
    const entry = personasEnPlanta.find(p => p.id === id);
    if (!entry) return;
    visitorToCheckoutId = id;
    modalVisitorInfo.textContent = `¿Confirmar la salida de ${entry.visitantes.nombre}?`;
    exitObs.value = "";
    modal.classList.remove('hidden');
    modal.setAttribute('aria-active', 'true');
    focusTrap(modal);
  }

  function openVisitorDetail(id) {
    const entry = personasEnPlanta.find(p => p.id === id);
    if (!entry) return;
    const v = entry.visitantes;
    modalVisitorDetailContent.innerHTML = `
      <span class="label">Documento</span><span class="value">${escapeHtml(v.tipo_doc)}: ${escapeHtml(v.num_doc)}</span>
      <span class="label">Nombre</span><span class="value">${escapeHtml(v.nombre)}</span>
      <span class="label">Empresa</span><span class="value">${escapeHtml(v.empresa)}</span>
      <span class="label">Anfitrión</span><span class="value">${escapeHtml(entry.anfitriones?.nombre || '—')}</span>
      <span class="label">Observaciones</span><span class="value">${escapeHtml(entry.obs_ingreso) || '—'}</span>`;
    modalVisitorDetail.classList.remove('hidden');
    modalVisitorDetail.setAttribute('aria-active', 'true');
    focusTrap(modalVisitorDetail);
  }

  formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validarFormulario(['reg-nombre', 'reg-numdoc', 'reg-anfitrion'])) return;
    const tipoDoc = document.getElementById('reg-tipodoc').value;
    const numDoc = document.getElementById('reg-numdoc').value.trim();
    const nombre = document.getElementById('reg-nombre').value.trim();
    const empresa = document.getElementById('reg-empresa').value.trim() || 'Particular';
    const motivo = document.getElementById('reg-motivo').value.trim();
    const anfitrionInput = document.getElementById('reg-anfitrion').value.trim();
    const obs = document.getElementById('reg-obs').value.trim();

    const duplicado = personasEnPlanta.some(p => p.visitantes.num_doc === numDoc);
    if (duplicado) { alert('Esta persona ya se encuentra registrada en planta.'); return; }

    toggleLoading(true);
    try {
      const visitanteId = await buscarOCrearVisitante(tipoDoc, numDoc, nombre, empresa);
      const anfitrionId = await buscarOCrearAnfitrion(anfitrionInput);
      const userId = await getCurrentUserId();

      const { data: ep, error: epErr } = await supabase.from('en_planta').insert({
        visitante_id: visitanteId, motivo: motivo || null,
        anfitrion_id: anfitrionId, obs_ingreso: obs, creado_por: userId
      }).select('id, ingreso_en').single();
      if (epErr) throw epErr;

      const { error: histErr } = await supabase.from('historial').insert({
        visitante_id: visitanteId, tipo_doc: tipoDoc, num_doc: numDoc,
        nombre, empresa, motivo: motivo || null, anfitrion_id: anfitrionId,
        anfitrion_nombre: anfitrionInput, estado: 'ingreso', obs,
        fecha: ep.ingreso_en, creado_por: userId
      });
      if (histErr) throw histErr;

      formRegistro.reset();
      document.querySelectorAll('#form-registro input, #form-registro select, #form-registro textarea').forEach(el => el.style.borderColor = '');
      await renderVisitors();
    } catch (err) {
      console.error('Error registrando ingreso:', err);
      alert('Error al registrar ingreso.');
    } finally {
      toggleLoading(false);
    }
  });

  modalCancel.addEventListener('click', () => { cerrarModal(modal); visitorToCheckoutId = null; });
  modalConfirm.addEventListener('click', async () => {
    if (visitorToCheckoutId === null) return;
    const obs = exitObs.value.trim();
    if (obs.length < 4) { alert('La observación de salida debe tener al menos 4 caracteres.'); return; }

    toggleLoading(true);
    try {
      const entry = personasEnPlanta.find(p => p.id === visitorToCheckoutId);
      if (!entry) throw new Error('Visita no encontrada');
      const v = entry.visitantes;
      const userId = await getCurrentUserId();

      const { error: upErr } = await supabase.from('en_planta').update({
        salida_en: new Date().toISOString(), obs_salida: obs
      }).eq('id', visitorToCheckoutId);
      if (upErr) throw upErr;

      const { error: histErr } = await supabase.from('historial').insert({
        visitante_id: v.id, tipo_doc: v.tipo_doc, num_doc: v.num_doc,
        nombre: v.nombre, empresa: v.empresa, motivo: entry.motivo || null,
        anfitrion_id: entry.anfitrion_id, anfitrion_nombre: entry.anfitriones?.nombre || '—',
        estado: 'salida', obs, fecha: new Date().toISOString(),
        programada_id: entry.programada_id, creado_por: userId
      });
      if (histErr) throw histErr;

      cerrarModal(modal);
      visitorToCheckoutId = null;
      await renderVisitors();
    } catch (err) {
      console.error('Error registrando salida:', err);
      alert('Error al registrar salida.');
    } finally {
      toggleLoading(false);
    }
  });

  modalVisitorDetailClose.addEventListener('click', () => cerrarModal(modalVisitorDetail));
  modalVisitorDetail.addEventListener('click', (e) => { if (e.target === modalVisitorDetail) cerrarModal(modalVisitorDetail); });

  window.AppState = window.AppState || {};
  window.AppState.registro = { renderVisitors };
})();
