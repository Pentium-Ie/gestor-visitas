# Usuarios del Sistema — Gestor de Visitas

Para crear un usuario administrador, usar el Dashboard de Supabase:

1. **Authentication → Users → Add User**
2. Ingresar email y contraseña
3. Insertar su perfil en `perfiles`:
   ```sql
   INSERT INTO perfiles (id, nombre, rol, activo)
   VALUES ('<uuid_del_usuario>', 'Nombre Completo', 'admin', true);
   ```

Para usuarios operadores (sin acceso a DELETE ni Admin):
   ```sql
   INSERT INTO perfiles (id, nombre, rol, activo)
   VALUES ('<uuid_del_usuario>', 'Nombre Completo', 'operador', true);
   ```

> **Nota:** Las contraseñas se almacenan hasheadas con bcrypt. No compartir credenciales por canales inseguros.
