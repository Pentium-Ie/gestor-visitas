# Migración a Supabase — Gestor de Visitas

## Visión General

Reemplazar el estado local en memoria por persistencia en Supabase (PostgreSQL),
agregando autenticación real, sincronización multi-sesión y un modelo de datos
normalizado con integridad referencial.

---

## Fase 1 — Proyecto Existente

- **Ref:** `bygwwnaudkxinytgbmrf`
- **URL:** `https://bygwwnaudkxinytgbmrf.supabase.co`
- **Región:** `sa-east-1` (São Paulo)
- **Admin Auth:** `admin@gestor-visitas.com` / `admin123`
- **DB Password:** `ITzsUV9nJSk352Hd` (guardar en gestor de contraseñas)

---

## Fase 2 — Esquema de Base de Datos

### Diagrama de Entidades

```
anfitriones (catálogo de anfitriones)
visitantes (catálogo de visitantes — normalizado)
  ├── programadas (visitas programadas, soft-delete con estado)
  ├── en_planta   (visitas activas con salida_en, unique parcial)
  └── historial   (inmutable, denormalizado para auditoría)
```

### SQL Completo

```sql
-- ============================================================
-- EXTENSIONES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. PERFILES (vinculada a auth.users)
-- ============================================================
CREATE TABLE perfiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  nombre      VARCHAR(100) NOT NULL,
  rol         VARCHAR(20)  NOT NULL DEFAULT 'operador' CHECK (rol IN ('admin','operador')),
  activo      BOOLEAN      NOT NULL DEFAULT true,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. ANFITRIONES (catálogo para autocompletado)
-- ============================================================
CREATE TABLE anfitriones (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      VARCHAR(150) NOT NULL,
  area        VARCHAR(150),
  activo      BOOLEAN      NOT NULL DEFAULT true,
  creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  creado_por  UUID         REFERENCES perfiles(id) ON DELETE SET NULL
);
ALTER TABLE anfitriones ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_anfitriones_nombre ON anfitriones USING gin (nombre gin_trgm_ops);
CREATE INDEX idx_anfitriones_activo ON anfitriones(activo);

-- ============================================================
-- 3. VISITANTES (normalizado — único por tipo_doc+num_doc)
-- ============================================================
CREATE TABLE visitantes (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo_doc      VARCHAR(5)   NOT NULL DEFAULT 'DNI' CHECK (tipo_doc IN ('DNI','CE','PAS')),
  num_doc       VARCHAR(20)  NOT NULL,
  nombre        VARCHAR(150) NOT NULL,
  empresa       VARCHAR(150) NOT NULL DEFAULT 'Particular',
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tipo_doc, num_doc)
);
ALTER TABLE visitantes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_visitantes_doc    ON visitantes(tipo_doc, num_doc);
CREATE INDEX idx_visitantes_nombre ON visitantes USING gin (nombre gin_trgm_ops);

CREATE OR REPLACE FUNCTION fn_actualizar_visitante()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.actualizado_en = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_visitantes_actualizado
  BEFORE UPDATE ON visitantes FOR EACH ROW
  EXECUTE FUNCTION fn_actualizar_visitante();

-- ============================================================
-- 4. PROGRAMADAS (soft-delete con estado)
-- ============================================================
CREATE TABLE programadas (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitante_id  BIGINT       NOT NULL REFERENCES visitantes(id),
  motivo        VARCHAR(250),
  anfitrion_id  BIGINT       REFERENCES anfitriones(id),
  fecha         TIMESTAMPTZ  NOT NULL,
  estado        VARCHAR(20)  NOT NULL DEFAULT 'pendiente'
                 CHECK (estado IN ('pendiente','completado','cancelado')),
  creado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  creado_por    UUID         REFERENCES perfiles(id) ON DELETE SET NULL
);
ALTER TABLE programadas ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_programadas_fecha     ON programadas(fecha DESC);
CREATE INDEX idx_programadas_estado    ON programadas(estado);
CREATE INDEX idx_programadas_visitante ON programadas(visitante_id);

-- ============================================================
-- 5. EN PLANTA (visitas activas, unique parcial en visitante_id)
-- ============================================================
CREATE TABLE en_planta (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitante_id    BIGINT       NOT NULL REFERENCES visitantes(id),
  motivo          VARCHAR(250),
  anfitrion_id    BIGINT       REFERENCES anfitriones(id),
  obs_ingreso     TEXT         NOT NULL DEFAULT '',
  programada_id   BIGINT       REFERENCES programadas(id) ON DELETE SET NULL,
  ingreso_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  salida_en       TIMESTAMPTZ,
  obs_salida      TEXT,
  creado_por      UUID         REFERENCES perfiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_salida CHECK (
    (salida_en IS NULL AND obs_salida IS NULL) OR
    (salida_en IS NOT NULL AND obs_salida IS NOT NULL AND char_length(obs_salida) >= 4)
  )
);
ALTER TABLE en_planta ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX uq_en_planta_activo ON en_planta(visitante_id) WHERE salida_en IS NULL;
CREATE INDEX idx_en_planta_ingreso ON en_planta(ingreso_en);
CREATE INDEX idx_en_planta_salida  ON en_planta(salida_en);

-- ============================================================
-- 6. HISTORIAL (inmutable — solo INSERT + SELECT)
-- ============================================================
CREATE TABLE historial (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitante_id      BIGINT,          -- referencial, sin FK para no bloquear
  tipo_doc          VARCHAR(5)   NOT NULL DEFAULT 'DNI',
  num_doc           VARCHAR(20)  NOT NULL,
  nombre            VARCHAR(150) NOT NULL,
  empresa           VARCHAR(150) NOT NULL DEFAULT 'Particular',
  motivo            VARCHAR(250),
  anfitrion_id      BIGINT,
  anfitrion_nombre  VARCHAR(150) NOT NULL DEFAULT '',
  estado            VARCHAR(20)  NOT NULL
                    CHECK (estado IN ('ingreso','salida','cancelada',
                                      'ingreso_programado','salida_automatica')),
  obs               TEXT         NOT NULL DEFAULT '',
  fecha             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  fecha_programada  TIMESTAMPTZ,
  programada_id     BIGINT,
  creado_por        UUID         REFERENCES perfiles(id) ON DELETE SET NULL,
  creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
ALTER TABLE historial ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_historial_fecha        ON historial(fecha DESC);
CREATE INDEX idx_historial_busqueda     ON historial USING gin (nombre gin_trgm_ops);
CREATE INDEX idx_historial_fecha_nombre ON historial(fecha DESC, nombre);
CREATE INDEX idx_historial_estado       ON historial(estado);
```

---

## Fase 3 — Políticas RLS

```sql
-- Perfiles: el usuario ve su propio perfil; admins ven todos
CREATE POLICY perfiles_select ON perfiles FOR SELECT USING (
  auth.uid() = id OR EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
);

-- Anfitriones: solo usuarios activos pueden leer/insertar
CREATE POLICY anfitriones_select ON anfitriones FOR SELECT
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY anfitriones_insert ON anfitriones FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));

-- Visitantes: lectura, inserción y actualización para usuarios activos
CREATE POLICY visitantes_select ON visitantes FOR SELECT
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY visitantes_insert ON visitantes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY visitantes_update ON visitantes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));

-- Programadas: CRUD para activos; solo admin puede DELETE
CREATE POLICY programadas_select ON programadas FOR SELECT
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY programadas_insert ON programadas FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY programadas_update ON programadas FOR UPDATE
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY programadas_delete ON programadas FOR DELETE
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- En Planta: SELECT, INSERT, UPDATE para activos
CREATE POLICY en_planta_select ON en_planta FOR SELECT
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY en_planta_insert ON en_planta FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY en_planta_update ON en_planta FOR UPDATE
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));

-- Historial: solo INSERT y SELECT (inmutable)
CREATE POLICY historial_select ON historial FOR SELECT
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
CREATE POLICY historial_insert ON historial FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND activo = true));
```

---

## Fase 4 — Auto-Checkout Nocturno

Función que debe ejecutarse diariamente a las 23:00 (hora Lima) vía
**Supabase Edge Function** o **pg_cron**:

```sql
CREATE OR REPLACE FUNCTION fn_auto_checkout_cierre()
RETURNS TABLE(visitante_id BIGINT, nombre_visitante VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH cerrados AS (
    UPDATE en_planta
    SET salida_en = (date_trunc('day', now() AT TIME ZONE 'America/Lima') + INTERVAL '23 hours')
                    AT TIME ZONE 'America/Lima',
        obs_salida = 'Salida automática - cierre del día'
    WHERE salida_en IS NULL
    RETURNING id, visitante_id
  )
  INSERT INTO historial
    (visitante_id, tipo_doc, num_doc, nombre, empresa,
     motivo, anfitrion_id, estado, obs, fecha, programada_id, creado_por)
  SELECT v.id, v.tipo_doc, v.num_doc, v.nombre, v.empresa,
         ep.motivo, ep.anfitrion_id, 'salida_automatica',
         'Salida automática - cierre del día', now(),
         ep.programada_id, NULL
  FROM cerrados c
  JOIN en_planta ep ON ep.id = c.id
  JOIN visitantes v ON v.id = c.visitante_id
  RETURNING historial.visitante_id, historial.nombre;
END;
$$;
```

---

## Fase 5 — Seed Data

```sql
-- Anfitriones iniciales
INSERT INTO anfitriones (nombre, area) VALUES
  ('Gerencia TI',       'Tecnología'),
  ('Área de Innovación', 'I+D'),
  ('Ing. Martínez',     'Obras Civiles'),
  ('Contabilidad',      'Finanzas'),
  ('Recursos Humanos',  'Gestión de Personas'),
  ('Seguridad',         'Instalaciones'),
  ('Dirección General', 'Alta Dirección'),
  ('Mantenimiento',     'Infraestructura');
```

---

## Fase 6 — Instalación del Cliente JS

```html
<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
<script src="js/helpers.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/historial.js"></script>
<script src="js/registro.js"></script>
<script src="js/programacion.js"></script>
<script src="js/app.js"></script>
```

`js/supabase-client.js` ya contiene las credenciales del proyecto.

---

## Fase 7 — Migración del Login

Reemplazar la validación hardcoded `admin/admin123` en `app.js`:

```js
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: document.getElementById('username').value.trim(),
    password: document.getElementById('password').value,
  });
  if (error) { loginError.textContent = 'Credenciales inválidas.'; return; }
  // Login exitoso → animaciones...
});
```

---

## Fase 8 — Lógica de Negocio (Flujo de Datos)

### Registro de Ingreso
1. Buscar `visitantes` por `(tipo_doc, num_doc)`
2. Si existe → precargar nombre y empresa; si no → crear registro
3. INSERT en `en_planta` (con `visitante_id`, `anfitrion_id`, `obs_ingreso`)
4. INSERT en `historial` con estado `'ingreso'`

### Registro de Salida
1. UPDATE `en_planta` set `salida_en = now()`, `obs_salida = '...'`
2. INSERT en `historial` con estado `'salida'`
3. `obs_salida` obligatorio, mínimo 4 caracteres (CHECK constraint)

### Programar Visita
1. Buscar/crear `visitantes`
2. Seleccionar `anfitrion` desde `anfitriones` (autocompletado top 3)
3. INSERT en `programadas` con estado `'pendiente'`

### Registrar Ingreso desde Programada
1. UPDATE `programadas.estado = 'completado'`
2. INSERT en `en_planta` con `programada_id`
3. INSERT en `historial` con estado `'ingreso_programado'`

### Cancelar Programada
1. UPDATE `programadas.estado = 'cancelado'`
2. INSERT en `historial` con estado `'cancelada'`

### Notificación de 3 horas en Planta
- Frontend: al renderizar `en_planta`, calcular `now() - ingreso_en > 3 hours`
- Si excede y `salida_en IS NULL`, mostrar badge de advertencia

### Auto-Checkout 23:00 Lima
- Edge Function o pg_cron ejecuta `fn_auto_checkout_cierre()`
- Marca todos los `salida_en IS NULL` con hora 23:00 Lima
- Inserta historial con estado `'salida_automatica'`

---

## Fase 9 — Seguridad y Buenas Prácticas

| Regla | Detalle |
|---|---|
| **NUNCA** exponer service_role key en frontend | Solo anon key con RLS |
| **Historial inmutable** | Sin UPDATE/DELETE policies |
| **Soft-delete** | `programadas.estado`, `en_planta.salida_en` |
| **Unique parcial** | `uq_en_planta_activo` evita duplicados en planta |
| **pg_trgm** | Búsqueda por substring sin degradación |
| **Zona horaria** | `TIMESTAMPTZ` con conversión explícita a `America/Lima` |
| **CHECK constraints** | Validación de datos a nivel BD (salida, estado) |

---

## Fase 10 — Sobre la Modificación del Historial

Por diseño, `historial` no permite UPDATE ni DELETE vía RLS.
Si es absolutamente necesario corregir un registro:

1. Usar el **SQL Editor** de Supabase con la **service_role key**
2. Insertar un registro de corrección (nuevo INSERT con observación aclaratoria)
3. No modificar in-place — mantener la traza original intacta

Ejemplo de corrección:
```sql
INSERT INTO historial (visitante_id, tipo_doc, num_doc, nombre, empresa,
                       motivo, anfitrion_id, estado, obs, fecha, creado_por)
SELECT visitante_id, tipo_doc, num_doc, nombre, empresa,
       motivo, anfitrion_id, 'ingreso'::varchar,
       'CORRECCIÓN: ' || obs, now(), '9e471111-7ac0-4ace-a7bf-a14a81e0d3db'
FROM historial WHERE id = <id_erroneo>;
```
