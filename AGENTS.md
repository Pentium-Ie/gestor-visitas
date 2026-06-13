# Gestor de Visitas — Glass UI

## Goal
Sistema web de gestión de visitas con diseño glass-morphism, persistencia en Supabase y control de versiones en GitHub.

## Arquitectura
- `index.html` — punto de entrada único
- `css/` — 7 archivos modulares (variables.css, base.css, glass.css, layout.css, components.css, historial.css, responsive.css)
- `js/` — 7 archivos modulares (helpers.js, supabase-client.js, historial.js, registro.js, programacion.js, admin.js, app.js)
- Orden de carga JS: helpers.js → supabase-client.js → historial.js → registro.js → programacion.js → admin.js → app.js
- Estado global compartido via `window.AppState`
- Login: Supabase Auth con fetch (sin dependencias externas)

## Vistas
1. **Login** — formulario con toggle de contraseña (👁/🙈), animaciones fade, `role="alert"` en errores
2. **Registro** — formulario de ingreso + lista personal en planta + modal salida (obs ≥4 chars) + modal detalle
3. **Programación** — formulario con datetime-local + lista programadas + modal detalle (editar/cancelar/confirmar ingreso) + modal confirmación con observaciones
4. **Historial** — tabla centrada con columnas fijas, búsqueda por columna (ILIKE), filtro rango fechas, modal detalle con fechas separadas (programado/ingreso/salida), columnas ocultas progresivamente en móvil
5. **Administración** — log de auditoría desde `historial` con email del usuario via `fn_get_users_info`

## Mejoras Aplicadas (Junio 2026)
- **XSS**: `escapeHtml()` en todo template literal
- **Validación**: `validarFormulario()` en todos los formularios; `motivo` requerido
- **Duplicado de código**: eliminados `script.js` y `styles.css` monolíticos
- **Delegación de eventos**: listeners en contenedores padre con `closest()`
- **Throttle**: `requestAnimationFrame` en mousemove del reflejo glass
- **Focus trap**: `focusTrap()` en todos los modales, cierre con Escape global
- **ARIA**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `role="alert"`, `role="button"`, `scope="col"`, `sr-only`
- **Touch targets**: botones con `min-height: 34-38px`
- **Badges**: variables CSS de alto contraste (`--success-color`, `--danger-color`, `--warning-color`)
- **Clase unificada**: `.empty-state`, `.modal-sm` (380px), `.modal-md` (450px), `.icon-btn` (todos los iconos)
- **Loader overlay** preparado para operaciones asíncronas
- **Toast notificaciones** con glass styling (bisel + glow), auto-dismiss 5s, cierre manual
- **Autocomplete**: anfitriones (3 resultados ILIKE, dropdown fixed), visitante por documento (debounce 300ms, auto-fill nombre+empresa)
- **Anfitriones**: solo lookup en BD (`buscarAnfitrion`), sin creación desde formulario
- **`autocomplete="off"`** en formularios para suprimir sugerencias del navegador
- **Iconos SVG**: reemplazados emojis (👁🙈☾☀✓✕) por SVGs inline (eye, moon, sun, check, cross) en todos los botones y toasts
- **Bisel gradient en iconos**: `.icon-btn` usa `background-image` dual-layer (color sólido + gradient bisel) con `border: 1.3px solid transparent` para el mismo efecto de borde que los glass-card
- **Modo claro/oscuro**: botón con icono SVG (sun/moon) en header, variables CSS en `[data-theme="light"]`, persistencia en `localStorage`
- **Login Supabase**: implementado con fetch directo (sin CDN supabase-js), toggle de visibilidad de contraseña con SVG eye/eye-closed
- **`perfiles` FK**: `ON DELETE RESTRICT` a `auth.users(id)`

## Esquema de Datos
- **`visitas`** — tabla fuente de verdad (1 fila = 1 visita con fecha_programada, fecha_ingreso, fecha_salida, estado)
- **`historial`** — log inmutable (solo INSERT, con `visita_id` FK a `visitas`, `creado_por` UUID de auth.users)
- **`visitantes`** — upsert por tipo_doc+num_doc
- **`anfitriones`** — solo lectura (15 registros seeded)
- Tablas `en_planta` y `programadas` descartadas y reemplazadas por `visitas`
- Función `fn_get_users_info(user_ids UUID[]) RETURNS TABLE(id UUID, email TEXT)` para lookup batch de emails

## Infraestructura Cloud
- **Supabase**: proyecto `bygwwnaudkxinytgbmrf`, URL `https://bygwwnaudkxinytgbmrf.supabase.co`, región `sa-east-1`
- **Vercel**: `https://gestor-visitas-one.vercel.app`
- **GitHub**: `https://github.com/Pentium-Ie/gestor-visitas`
- Usuario: `luismaytadiaz15@gmail.com`
- 21 índices en `public`

## Notas
- Sin paginación en historial (para +1000 registros en producción)
- Sin notificación de visitas >3h en planta
- Sin Edge Function para auto-checkout 23:00 Lima
- Sin tests unitarios
