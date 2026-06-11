# Usuarios del Sistema — Gestor de Visitas

## Admin Maestro

| Campo | Valor |
|---|---|
| Email | `master-admin@gestor-visitas.com` |
| Contraseña | `Huachip5667Sca85#` |
| Rol | `admin` |
| Nombre | Luis Mayta (Master Admin) |

> Esta cuenta tiene acceso completo al sistema: CRUD en todas las tablas,
> eliminación física de programadas, y acceso al panel de Administración.

## Admin Legacy

| Campo | Valor |
|---|---|
| Email | `admin@gestor-visitas.com` |
| Contraseña | `admin123` |
| Rol | `admin` |
| Nombre | Admin Principal |

> Cuenta original del proyecto. Se mantiene por compatibilidad pero puede
> desactivarse cuando ya no sea necesaria.

## Cómo Agregar un Nuevo Usuario

1. Crear el usuario en Supabase Auth desde el Dashboard:
   - Ir a **Authentication → Users → Invite** o **Add User**
   - Ingresar email y contraseña temporal

2. Insertar su perfil en la tabla `perfiles` con rol `operador`:
   ```sql
   INSERT INTO perfiles (id, nombre, rol, activo)
   VALUES ('<uuid_del_usuario>', 'Nombre del Usuario', 'operador', true);
   ```

## Notas

- Las contraseñas se almacenan hasheadas con bcrypt (`pgcrypto`).
- El login acepta tanto el email completo como el usuario hardcoded
  `admin/admin123` (solo para desarrollo, será removido en producción).
- Para desactivar un usuario sin eliminar, cambiar `activo = false` en `perfiles`.
