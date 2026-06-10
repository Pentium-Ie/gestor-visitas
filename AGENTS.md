# Resumen del Proyecto — Gestor de Visitas (Glass UI)

## Goal
Sistema web de gestión de visitas con diseño glass-morphism, tres vistas principales: Registro en planta, Programación de visitas futuras e Historial de movimientos.

## Arquitectura
- `index.html` — punto de entrada único
- `css/` — 7 archivos modulares (variables, base, glass, layout, components, historial, responsive)
- `js/` — 6 archivos modulares (helpers.js, supabase-client.js, historial.js, registro.js, programacion.js, app.js)
- Orden de carga JS: supabase-js CDN → helpers.js → supabase-client.js → historial.js → registro.js → programacion.js → app.js
- Estado global compartido via `window.AppState`
- Login: admin / admin123 (hardcoded, migrable a Supabase Auth)
- Archivos monolíticos eliminados (`script.js`, `styles.css`)

## Vistas Implementadas
1. **Login** — formulario con autenticación simple, animaciones de entrada, `role="alert"` en errores
2. **Registro** — formulario de ingreso + lista de personas en planta + modal salida + modal detalle
3. **Programación** — formulario con datetime-local + lista programadas + modal detalle (editar/cancelar/confirmar ingreso) + modal confirmación con observaciones
4. **Historial** — tabla con columnas fijas + búsqueda por columna + filtro rango fechas + modal detalle con fecha programada/ingreso
5. **Administración** — placeholder

## Mejoras Aplicadas (junio 2026)
- **XSS**: sanitización `escapeHtml()` en todo template literal (helpers.js)
- **Validación**: `validarFormulario()` del lado JS en todos los formularios
- **Duplicado de código**: eliminados `script.js` y `styles.css` monolíticos; solo queda arquitectura modular
- **Delegación de eventos**: listeners en contenedores padre en vez de re-binding por render
- **Throttle**: `requestAnimationFrame` en mousemove del reflejo glass
- **Focus trap**: `focusTrap()` en todos los modales, cierre con Escape global
- **ARIA**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `role="alert"`, `role="button"`, `scope="col"`, `sr-only`
- **Touch targets**: botones incrementados a `min-height: 34-38px`
- **Badges**: colores con variables CSS y mayor contraste (success-color, danger-color, warning-color)
- **Contraste**: `!important` removido de `.btn-secondary`, reemplazado por especificidad `.modal-actions .btn-secondary`
- **Clases vacío**: creada `.empty-state` para reemplazar inline styles
- **Loader overlay**: estructura preparada para operaciones asíncronas
- **CSS sin inline styles**: widths de modales pasados a clases `.modal-sm` / `.modal-md`

## Pendientes / Notas
- Migración a Supabase documentada en `SUPABASE-MIGRATION.md` (fases 1-10)
- El login actual sigue siendo hardcoded; seguir la guía para migrar a Supabase Auth
- El panel de Administración sigue siendo placeholder
- Sin paginación en historial (para producción con +1000 registros)
- Sin tests unitarios
