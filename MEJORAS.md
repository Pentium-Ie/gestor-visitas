# Mejoras y Correcciones — Gestor de Visitas

## 2026-06-13 — Sesión 1

### Objetivo
Revisión crítica del código y corrección de bugs críticos + mejoras de UX/seguridad.

---

### 1. 🔴 Fix: `atob()` no soporta base64url en JWT

**Archivo:** `js/supabase-client.js`

**Problema:** `atob(token.split('.')[1])` falla si el JWT contiene caracteres base64url (`-`, `_`) en lugar de base64 estándar (`+`, `/`). Esto causa un `DOMException` silencioso en `getTokenExpiry()`.

**Solución:**
```js
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return str;
}
```
- Se creó `base64UrlDecode()` que normaliza base64url → base64 antes de pasar a `atob`.
- Se agregó validación de `parts.length < 2` para tokens malformados.

---

### 2. 🔴 Fix: Doble clic en submit duplica registros

**Archivos:** `js/helpers.js`, `js/registro.js`, `js/programacion.js`

**Problema:** Si el usuario hace clic dos veces rápido en "Registrar Ingreso" o "Agendar Visita", se disparan dos INSERT idénticos antes de que el primero responda.

**Solución:**
- Nueva función `disableButton(btn, texto)` en helpers.js: deshabilita el botón y cambia el texto.
- Nueva función `enableButton(btn)` en helpers.js: restaura estado original.
- Aplicado a todos los submit handlers (`formRegistro`, `formProgramacion`) y botones de modal (`modalConfirm`, `detailCancelar`, `confirmOk`).
- El botón se deshabilita ANTES del primer `await` y se re-habilita en `finally`.

---

### 3. 🔴 Fix: `getSession()` no refresca token si access token expiró

**Archivo:** `js/supabase-client.js`

**Problema:** Si solo existía refresh token en localStorage pero el access token había expirado o sido removido, `getSession()` retornaba `{ session: null }` en vez de intentar refrescar.

**Solución:**
- `getSession()` ahora verifica si existe refresh token aunque no haya access token.
- Si hay refresh token, intenta `refreshSession()` antes de retornar null.
- Si el refresh falla, recién retorna `{ session: null }`.

---

### 4. 🟡 Safe area insets para iOS

**Archivos:** `index.html`, `css/variables.css`, `css/base.css`, `css/responsive.css`

**Problema:** En iPhone con notch y barra inferior, el contenido se superpone con los bordes del dispositivo.

**Solución:**
- Meta tags: `viewport-fit=cover`, `theme-color` con `prefers-color-scheme`, `apple-mobile-web-app-status-bar-style=black-translucent`.
- Variables CSS: `--safe-top`, `--safe-bottom`, `--safe-left`, `--safe-right` usando `env(safe-area-inset-*)`.
- `body` padding usa estas variables.
- En mobile breakpoint (768px), se suma `10px` extra al top padding.

---

### 5. 🟡 Overflow en móvil con layout absolute

**Archivo:** `css/responsive.css`

**Problema:** `body { overflow: hidden }` en desktop es correcto (paneles absolute dentro de container fixed), pero en mobile los paneles son `position: relative` y el viewport puede excederse en landscape/tablet.

**Solución:** Ya existía `body { overflow-y: auto }` en el breakpoint 768px. Se agregó padding con safe-area.

---

### 6. 🟡 Select global afectaba historial

**Archivos:** `css/components.css`, `css/historial.css`

**Problema:** `select { appearance: none; ... }` global sobreescribía el `<select id="historial-search-col">`, eliminando la flecha nativa y reemplazándola con una SVG embeddida que se ve pixelada en algunos DPI.

**Solución:** Scope reducido a `.grid-form select` (solo selects de formularios). El select de historial mantiene comportamiento nativo del navegador.

---

### 7. 🟠 Login lockout tras 4 intentos fallidos

**Archivo:** `js/app.js`

**Problema:** Sin límite de intentos de login, un atacante puede probar contraseñas indefinidamente.

**Solución:** Implementación client-side con localStorage:
- Se almacena `loginAttempts_{email}` con contador de intentos.
- Se almacena `loginBlockedUntil_{email}` con timestamp de bloqueo.
- Tras 4 intentos fallidos consecutivos, se bloquea por 15 minutos.
- El contador se resetea al cerrar sesión o al iniciar sesión exitosamente.

---

### 8. 🟠 Re-login forzado cada día a las 8 AM Lima

**Archivo:** `js/app.js`

**Problema:** La sesión podía durar indefinidamente gracias al refresh token.

**Solución:**
- Se almacena `sessionStartedAt` con timestamp ISO al iniciar sesión.
- En cada inicialización de la app, se obtiene la hora actual en Lima (`America/Lima`).
- Si la hora actual en Lima es ≥ 08:00 y la sesión se inició en un día anterior, se fuerza logout.
- El usuario debe volver a autenticarse.

---

### 9. 🟡 Error logging visible en panel Administración

**Archivos:** `js/helpers.js`, `js/admin.js`, `js/supabase-client.js`, `js/registro.js`, `js/programacion.js`

**Problema:** Los errores de Supabase (timeout, 500, RLS) solo se logueaban a console.error, invisibles para el usuario admin.

**Solución:**
- Se crea función `logError(nivel, mensaje, detalle)` en helpers.js que persiste errores en `localStorage` (array `appLogs`), limitado a 200 registros.
- Se agrega sección "Log de Errores" en el panel Administración, debajo del log de auditoría.
- Muestra: fecha/hora, nivel (error/warn/info), mensaje, detalle con tooltip.
- Los errores se capturan en:
  - `_exec()` y `rpc()` de supabase-client.js
  - Todos los catch blocks de registro.js y programacion.js
  - Login fallido en app.js
- Botón "Limpiar Log de Errores" en el panel.

---

### 10. 🟡 Captura de errores en formularios

**Archivos:** `js/registro.js`, `js/programacion.js`

**Solución:** Todos los catch blocks ahora llaman a `logError()` con contexto del error, además del `console.error()` existente. Esto permite visibilidad desde el panel de administración sin depender de la consola del navegador.

---

### Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `js/supabase-client.js` | base64UrlDecode, getSession con refresh, _exec() y rpc() con retry 401 + logError |
| `js/helpers.js` | disableButton(), enableButton(), logError(), getLimaNow(), getLimaDateStr() |
| `js/app.js` | Lockout intentos login, re-login 8AM Lima, initSessionCheck con daily verify |
| `js/registro.js` | disableButton/enableButton en submit y checkout + logError en catch blocks |
| `js/programacion.js` | disableButton/enableButton en submit, cancel, confirm + logError en catch blocks |
| `js/admin.js` | Render logs de error desde localStorage + botón limpiar |
| `index.html` | Meta tags safe area, theme-color, apple-mobile-web-app |
| `css/variables.css` | --safe-* variables |
| `css/base.css` | body padding con safe-area |
| `css/components.css` | select → .grid-form select (scope reducido) |
| `css/historial.css` | option usa variable CSS, select mantiene comportamiento nativo |
| `css/responsive.css` | Body padding safe-area en móvil |

---

### Preguntas abiertas (para definir implementación)

**1. Offline / Supabase caído (tu pregunta 6.1)**

Si Supabase está caído, la app web **no puede funcionar**. Todo depende de la API (visitas, historial, visitantes, anfitriones). Para operar sin conexión se necesita:
- Service Worker que intercepte fetch y sirva desde cache
- IndexedDB como almacén local
- Cola de sincronización cuando vuelva la conexión

**Complejidad:** ALTA. Semanas de desarrollo.
**¿Se justifica para <100 visitas/día?** Mi recomendación: **No**. A menos que haya un requisito contractual de operación offline.

**2. Backoff exponencial (tu pregunta 6.2)**

Backoff = cuando una request falla por error transitorio (timeout, 503), se reintenta automáticamente con una pausa que crece en cada intento:
- 1er reintento: esperar 1s
- 2do reintento: esperar 2s
- 3er reintento: esperar 4s
- 4to reintento: esperar 8s

**Preguntas para definir:**
- ¿Cuántos reintentos máximos? (3, 5, 10?)
- ¿Solo para GET (lectura de listas/detalles) o también POST/PATCH (escritura de visitas)?
- ¿El usuario debe ver algo mientras se reintenta (spinner, toast) o debe ser transparente?

**3. MFA (tu pregunta 3.2)**

MFA = Multi-Factor Authentication = además de contraseña, pedir un código de 6 dígitos (Google Authenticator, SMS). Supabase lo soporta nativo.

Dijiste que no hay datos sensibles (3.3 = no). **No se necesita MFA.** El lockout de 4 intentos + re-login diario es suficiente para este caso de uso.
