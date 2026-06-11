document.addEventListener('DOMContentLoaded', () => {
  const viewLogin = document.getElementById('view-login');
  const viewDashboard = document.getElementById('view-dashboard');
  const formLogin = document.getElementById('form-login');
  const loginError = document.getElementById('login-error');
  const btnLogout = document.getElementById('btn-logout');
  const togglePassword = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('password');

  togglePassword?.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    togglePassword.setAttribute('aria-label', type === 'password' ? 'Mostrar contraseña' : 'Ocultar contraseña');
  });

  const navLinks = document.querySelectorAll('.nav-link');
  const workspacePanels = document.querySelectorAll('.workspace-panel');

  const systemHeader = document.querySelector('.system-header');
  const workspaceContainer = document.querySelector('.workspace-container');

  viewLogin.classList.add('fade-in');

  function aplicarReflejoCristal(card, angle, travelRatio) {
    card.style.setProperty('--light-deg', `${angle + 90}deg`);
    card.style.setProperty('--light-pos-min', `${travelRatio - 45}%`);
    card.style.setProperty('--light-pos-edge', `${travelRatio - 15}%`);
    card.style.setProperty('--light-pos-peak', `${travelRatio}%`);
    card.style.setProperty('--light-pos-edge2', `${travelRatio + 15}%`);
    card.style.setProperty('--light-pos-max', `${travelRatio + 45}%`);
  }

  let reflejoTicking = false;
  document.addEventListener('mousemove', (e) => {
    if (!reflejoTicking) {
      window.requestAnimationFrame(() => {
        const visibleCards = document.querySelectorAll('.glass-card:not(.hidden-section)');
        visibleCards.forEach(card => {
          const rect = card.getBoundingClientRect();
          const angle = Math.atan2(e.clientY - (rect.top + rect.height / 2), e.clientX - (rect.left + rect.width / 2)) * (180 / Math.PI);
          const travelRatio = (Math.sqrt(Math.pow(e.clientX - (rect.left + rect.width / 2), 2) + Math.pow(e.clientY - (rect.top + rect.height / 2), 2)) / Math.sqrt(window.innerWidth**2 + window.innerHeight**2)) * 130;
          aplicarReflejoCristal(card, angle, travelRatio);
        });
        reflejoTicking = false;
      });
      reflejoTicking = true;
    }
  });

  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (e) => {
      let x = e.gamma; let y = e.beta;
      if (x === null || y === null) return;
      if (y > 40) y = (y - 70) * 1.8;
      const angle = Math.atan2(y, x) * (180 / Math.PI);
      const travelRatioClamped = Math.max(5, Math.min(50 + (x * 0.8) + (y * 0.5), 95));
      const visibleCards = document.querySelectorAll('.glass-card:not(.hidden-section)');
      visibleCards.forEach(card => aplicarReflejoCristal(card, angle, travelRatioClamped));
    });
  }

  function solicitarPermisoSensores() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().catch(console.error);
    }
  }

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      workspacePanels.forEach(panel => panel.classList.add('hidden-section'));
      const targetId = link.getAttribute('data-target');
      const target = document.getElementById(targetId);
      if (target) target.classList.remove('hidden-section');
      if (targetId === 'sec-historial') window.AppState.historial.loadHistorial();
      if (targetId === 'sec-registro') window.AppState.registro.renderVisitors();
      if (targetId === 'sec-programacion') window.AppState.programacion.renderProgramadas();
    });
  });

  async function entrarAlSistema() {
    viewLogin.classList.remove('fade-in');
    viewLogin.classList.add('fade-out');
    setTimeout(() => {
      viewLogin.classList.add('hidden');
      viewDashboard.classList.remove('hidden');
      window.AppState.registro.renderVisitors();
      window.AppState.programacion.renderProgramadas();
      workspacePanels.forEach(panel => panel.classList.add('hidden-section'));
      const registroPanel = document.getElementById('sec-registro');
      if (registroPanel) registroPanel.classList.remove('hidden-section');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          systemHeader.classList.add('animate-header');
          setTimeout(() => {
            workspaceContainer.classList.add('animate-workspace');
          }, 1200);
        });
      });
    }, 1000);
  }

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    solicitarPermisoSensores();

    const email = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !password) {
      loginError.textContent = "Complete todos los campos.";
      return;
    }

    toggleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      loginError.textContent = "";
      entrarAlSistema();
    } catch {
      loginError.textContent = "Usuario o contraseña incorrectos.";
    } finally {
      toggleLoading(false);
    }
  });

  btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut().catch(() => {});
    viewDashboard.classList.add('hidden');
    systemHeader.classList.remove('animate-header');
    workspaceContainer.classList.remove('animate-workspace');
    workspacePanels.forEach(panel => panel.classList.add('hidden-section'));
    viewLogin.classList.remove('fade-out');
    viewLogin.classList.add('fade-in');
    viewLogin.classList.remove('hidden');
    formLogin.reset();
    loginError.textContent = "";
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay[aria-active="true"]').forEach(modal => {
        cerrarModal(modal);
      });
    }
  });

  (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) entrarAlSistema();
  })();
});
