# Migración a Supabase — Gestor de Visitas

## Visión General

Reemplazar el estado local en memoria (`AppState.personasEnPlanta`, `AppState.visitasProgramadas`, `AppState.historial`) por persistencia en Supabase (PostgreSQL), agregando autenticación real y sincronización multi-sesión.

---

## Fase 1 — Creación del Proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → **New Project**
2. Datos del proyecto:
   - **Name:** `gestor-visitas`
   - **Database Password:** (generar y guardar en gestor de contraseñas)
   - **Region:** `South America (São Paulo)` — menor latencia para Perú
3. Una vez creado, copiar desde **Settings → API**:
   - `Project URL` (ej. `https://xxxxx.supabase.co`)
   - `anon public key`

---

## Fase 2 — Esquema de Base de Datos

Ejecutar en **SQL Editor** de Supabase:

```sql
-- 1. TABLA DE PERFILES (vinculada a auth.users)
CREATE TABLE perfiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      VARCHAR(100) NOT NULL,
  rol         VARCHAR(20)  NOT NULL DEFAULT 'operador' CHECK (rol IN ('admin','operador')),
  activo      BOOLEAN      NOT NULL DEFAULT true,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- 2. TABLA DE VISITAS PROGRAMADAS
CREATE TABLE programadas (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_doc    VARCHAR(5)   NOT NULL DEFAULT 'DNI' CHECK (tipo_doc IN ('DNI','CE','PAS')),
  num_doc     VARCHAR(20)  NOT NULL,
  nombre      VARCHAR(150) NOT NULL,
  empresa     VARCHAR(150) NOT NULL DEFAULT 'Particular',
  motivo      VARCHAR(250),
  anfitrion   VARCHAR(150) NOT NULL,
  fecha       TIMESTAMPTZ  NOT NULL CHECK (fecha > now()),
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  creado_por  UUID REFERENCES perfiles(id)
);

ALTER TABLE programadas ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_programadas_fecha ON programadas(fecha);

-- 3. TABLA DE PERSONAS EN PLANTA (visitas activas)
CREATE TABLE en_planta (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_doc    VARCHAR(5)   NOT NULL DEFAULT 'DNI',
  num_doc     VARCHAR(20)  NOT NULL,
  nombre      VARCHAR(150) NOT NULL,
  empresa     VARCHAR(150) NOT NULL DEFAULT 'Particular',
  motivo      VARCHAR(250),
  anfitrion   VARCHAR(150) NOT NULL,
  obs         TEXT         NOT NULL DEFAULT '',
  programada_id BIGINT REFERENCES programadas(id) ON DELETE SET NULL,
  ingreso_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  creado_por  UUID REFERENCES perfiles(id)
);

ALTER TABLE en_planta ENABLE ROW LEVEL SECURITY;

-- 4. TABLA DE HISTORIAL (inmutable, solo inserción)
CREATE TABLE historial (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_doc        VARCHAR(5)   NOT NULL DEFAULT 'DNI',
  num_doc         VARCHAR(20)  NOT NULL,
  nombre          VARCHAR(150) NOT NULL,
  empresa         VARCHAR(150) NOT NULL DEFAULT 'Particular',
  motivo          VARCHAR(250),
  anfitrion       VARCHAR(150) NOT NULL,
  estado          VARCHAR(30)  NOT NULL CHECK (estado IN ('Ingreso','Salida','Cancelada','Ingreso (Programado)')),
  obs             TEXT         NOT NULL DEFAULT '',
  fecha           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  fecha_programada TIMESTAMPTZ,
  programada_id   BIGINT REFERENCES programadas(id) ON DELETE SET NULL,
  creado_por      UUID REFERENCES perfiles(id)
);

ALTER TABLE historial ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_historial_fecha   ON historial(fecha DESC);
CREATE INDEX idx_historial_nombre  ON historial(nombre);
CREATE INDEX idx_historial_estado  ON historial(estado);
```

---

## Fase 3 — Políticas de Seguridad (RLS)

```sql
-- Perfiles: cada uno ve su propio perfil; admins ven todos
CREATE POLICY perfiles_select ON perfiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- Programadas: todo operador autenticado puede leer/insertar
CREATE POLICY programadas_select ON programadas FOR SELECT
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY programadas_insert ON programadas FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY programadas_update ON programadas FOR UPDATE USING (
  EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true)
);
CREATE POLICY programadas_delete ON programadas FOR DELETE USING (
  EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true)
);

-- En Planta: mismas reglas
CREATE POLICY en_planta_select ON en_planta FOR SELECT
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY en_planta_insert ON en_planta FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY en_planta_delete ON en_planta FOR DELETE
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));

-- Historial: solo inserción y select
CREATE POLICY historial_select ON historial FOR SELECT
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY historial_insert ON historial FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
```

---

## Fase 4 — Instalación del Cliente

### 4.1 Agregar dependencia en `index.html`

```html
<!-- Antes de app.js -->
<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
<script src="js/app.js"></script>
...
```

### 4.2 Crear archivo de configuración `js/supabase-client.js`

```js
const SUPABASE_URL = window.SUPABASE_URL || 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'tu-anon-key';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper reactivo: escucha cambios en tiempo real
function suscribirse(tabla, callback) {
  return supabase
    .channel(`cambios-${tabla}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: tabla }, callback)
    .subscribe();
}
```

Agregar al `index.html`:

```html
<script src="js/supabase-client.js"></script>
<script src="js/app.js"></script>
```

---

## Fase 5 — Migración del Login a Supabase Auth

Reemplazar la validación `admin/admin123` en `app.js`:

```js
// ANTES
formLogin.addEventListener('submit', (e) => {
  e.preventDefault();
  if (username === 'admin' && password === 'admin123') { ... }
});

// DESPUÉS
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: document.getElementById('username').value.trim(),
    password: document.getElementById('password').value,
  });
  if (error) {
    loginError.textContent = 'Credenciales inválidas.';
    return;
  }
  // Login exitoso → continua con animaciones...
});

btnLogout.addEventListener('click', async () => {
  await supabase.auth.signOut();
  // resto del código de ocultar dashboard...
});
```

> **Nota:** El campo `username` del formulario debe cambiarse a `type="email"` o mapearse como email.

---

## Fase 6 — Capa de Datos Asíncrona

Cada módulo JS que hoy usa memoria local debe migrar sus operaciones a `supabase.from(...)`.

### 6.1 `registro.js` — Leer / Insertar / Eliminar en `en_planta`

```js
async function renderVisitors() {
  const { data, error } = await supabase
    .from('en_planta')
    .select('*')
    .order('ingreso_en', { ascending: false });
  if (error) return;
  const personasEnPlanta = data;
  // ... render igual que antes pero leyendo de data en vez de variable local
}

formRegistro.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { data, error } = await supabase.from('en_planta').insert({
    tipo_doc: ..., num_doc: ..., nombre: ..., empresa: ..., motivo: ..., anfitrion: ..., obs: ...
  }).select().single();
  // También insertar en historial (ver 6.3)
  await agregarHistorial({ ... });
  renderVisitors();
});

modalConfirm.addEventListener('click', async () => {
  await supabase.from('en_planta').delete().eq('id', visitorToCheckoutId);
  await agregarHistorial({ ..., estado: 'Salida', obs: exitObs.value.trim() });
  renderVisitors();
});
```

### 6.2 `programacion.js` — CRUD en `programadas`

Mismo patrón: reemplazar `visitasProgramadas.push(...)` por `supabase.from('programadas').insert(...)`, `filter(...)` por `supabase.from('programadas').delete().eq(...)`, etc.

### 6.3 `historial.js` — Solo Insert / Select

```js
async function agregarHistorial(entry) {
  const { error } = await supabase.from('historial').insert({
    tipo_doc: entry.tipoDoc, num_doc: entry.numDoc, nombre: entry.nombre,
    empresa: entry.empresa,  motivo: entry.motivo, anfitrion: entry.anfitrion,
    estado: entry.estado,    obs: entry.obs,       fecha: entry.fecha,
    fecha_programada: entry.fechaProgramada || null
  });
  await renderHistorial();
}

async function renderHistorial() {
  let query = supabase.from('historial').select('*').order('fecha', { ascending: false });
  const search = ...;
  if (search) query = query.ilike(searchCol, `%${search}%`);
  if (fechaInicio) query = query.gte('fecha', fechaInicio + 'T00:00:00');
  if (fechaFin)    query = query.lte('fecha', fechaFin + 'T23:59:59');
  const { data } = await query;
  // render con data...
}
```

---

## Fase 7 — Sincronización en Tiempo Real (Opcional pero Recomendado)

```js
// En registro.js
suscribirse('en_planta', () => { renderVisitors(); });

// En programacion.js
suscribirse('programadas', () => { renderProgramadas(); });

// En historial.js
suscribirse('historial', () => { renderHistorial(); });
```

Esto garantiza que si otro operador (u otra pestaña) modifica datos, la UI se actualiza automáticamente.

---

## Fase 8 — Manejo de Estado de Carga

Cada operación asíncrona debe mostrar feedback visual. Agregar un loader simple:

```html
<!-- en index.html, dentro del workspace-container o como overlay global -->
<div id="loader" class="loader-overlay hidden">
  <div class="loader-spinner"></div>
</div>
```

```css
.loader-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}
.loader-spinner {
  width: 40px; height: 40px;
  border: 4px solid rgba(255,255,255,0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

```js
// Helper global
async function conLoader(promise) {
  document.getElementById('loader').classList.remove('hidden');
  try { return await promise; }
  finally { document.getElementById('loader').classList.add('hidden'); }
}
```

Uso:

```js
formRegistro.addEventListener('submit', async (e) => {
  e.preventDefault();
  await conLoader(supabase.from('en_planta').insert({ ... }));
  renderVisitors();
});
```

---

## Fase 9 — Resumen de Archivos a Modificar/Crear

| Archivo | Acción |
|---|---|
| `supabase-client.js` | **CREAR** — inicializa y exporta `supabase` |
| `app.js` | MODIFICAR — login con `supabase.auth.signInWithPassword`, logout con `supabase.auth.signOut` |
| `registro.js` | MODIFICAR — todas las operaciones `en_planta` contra Supabase |
| `programacion.js` | MODIFICAR — todas las operaciones `programadas` contra Supabase |
| `historial.js` | MODIFICAR — todas las operaciones `historial` contra Supabase |
| `index.html` | MODIFICAR — agregar `<script>` de supabase-js CDN, nuevo `<script>` de supabase-client, loader HTML |
| `css/` | MODIFICAR (opcional) — agregar estilos del loader |

---

## Fase 10 — Verificación

1. Crear un usuario en **Supabase → Authentication → Add User**
2. Insertar su perfil manualmente:
   ```sql
   INSERT INTO perfiles (id, nombre, rol)
   VALUES ('<uuid_del_usuario>', 'Admin Principal', 'admin');
   ```
3. Iniciar sesión en la app con ese email/contraseña
4. Probar todo el flujo: registro → planta → salida, programación → registro → historial
5. Abrir dos pestañas y verificar que los cambios se reflejan en ambas (gracias a realtime)

---

## Consideraciones Finales

- **Nunca exponer la `service_role key`** en el frontend; solo usar la `anon key` con RLS.
- Para migrar datos existentes de demostración, usar el SQL Editor con inserts directos a `programadas` e `historial`.
- Si se requiere multitenant (multi-empresa), agregar columna `tenant_id` a todas las tablas y filtrar por ella en RLS.
- Para producción, reemplazar el CDN de supabase-js por una instalación npm y usar un bundler (Vite, Webpack) o importmap.
- El helper `conLoader` puede refinarse con timeouts y manejo de errores específico por operación.
