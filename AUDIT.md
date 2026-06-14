# Auditoría de Código — Gestor de Visitas

**Fecha:** 2026-06-13
**Alcance:** Full codebase (7 JS, 7 CSS, 1 HTML, 5 MD, .gitignore)
**Metodología:** Revisión manual de cada archivo + análisis de referencias cruzadas
**Estado:** ✅ 24/32 corregidos (ver MEJORAS.md Sesión 3)

---

## 📊 Resumen

| Severidad | Total | Corregidos | Pendientes |
|-----------|-------|------------|------------|
| 🔴 Crítico | 3 | 2 | 1 (C3) |
| 🟡 Alto | 6 | 4 | 2 (A2, A4) |
| 🔵 Medio | 12 | 12 | 0 |
| 🟢 Bajo | 11 | 6 | 5 (B3, B6, B8, B9, B11) |
| **Total** | **32** | **24** | **8** |

---

## ✅ Corregidos (24)

| ID | Severidad | Hallazgo | Fix |
|----|-----------|----------|-----|
| C1 | 🔴 | focusTrap memory leak | Limpieza de listener en `cerrarModal()` |
| C2 | 🔴 | `Pasaporte` vs `PAS` | Unificado a `PAS` |
| A1 | 🟡 | Sin CSP | Meta tag implementado |
| A3 | 🟡 | Sin verificación perfil activo | Consulta `perfiles` post-login |
| A5 | 🟡 | Chart.js sin fallback | Carga dinámica con fallback CDN |
| A6 | 🟡 | Máquina estados sin validación | Verifica `estado === 'ingresado'` |
| M1 | 🔵 | Color `#ff5559` hardcodeado | `getCSSVar('--danger-color')` |
| M2 | 🔵 | Duplicate `@media 576px` | Unificado |
| M3 | 🔵 | Sin maxlength en inputs | Agregado a todos los campos |
| M4 | 🔵 | `estadoClean` regex frágil | `normalize('NFD')` + strip |
| M5 | 🔵 | Nav coupling (simula click) | `showSection()` via AppState |
| M6 | 🔵 | Sin `aria-label` en logout | Agregado |
| M7 | 🔵 | `confirm()` nativo | Modal glass reemplaza |
| M8 | 🔵 | Sin validación horario | Horario 07-19 validado |
| M9 | 🔵 | Sin `type="button"` en modales | Agregado |
| M10 | 🔵 | Sección duplicada MEJORAS.md | Eliminada |
| M11 | 🔵 | `var ICONS` | Cambiado a `const` |
| M12 | 🔵 | DNI sin validación | `/^\d{8}$/` |
| B1 | 🟢 | Logo "STUDIO PRISM" | "Gestor Visitas" |
| B2 | 🟢 | Login en inglés | Español |
| B4 | 🟢 | `will-change` en glass | Eliminado |
| B5 | 🟢 | `btn-submit:hover` sin cambio | `brightness(1.15)` |
| B7 | 🟢 | KPIs UTC off-by-one | `Intl.DateTimeFormat` |
| B10 | 🟢 | Search select fondo fijo | `var(--input-bg)` |

---

## ❌ Pendientes (8)

| ID | Severidad | Hallazgo | Requiere |
|----|-----------|----------|----------|
| C3 | 🔴 Crítico | Login lockout 100% client-side | Edge Function + tabla `intentos_login` |
| A2 | 🟡 Alto | TOKENS.md con tokens vivos | Gestor de secretos externo |
| A4 | 🟡 Alto | LIMIT 1000 sin paginación | Paginación offset-based en historial |
| B3 | 🟢 Bajo | Sin LICENSE | Decidido: no agregar |
| B6 | 🟢 Bajo | Script tag sin `crossorigin`/`integrity` | Baja prioridad |
| B8 | 🟢 Bajo | Sin CHANGELOG.md | MEJORAS.md cumple ese rol |
| B9 | 🟢 Bajo | `loginError.textContent` seguro | Correcto por seguridad |
| B11 | 🟢 Bajo | AGENTS.md "25+ índices" inexacto | Actualizado |
