# Despliegue de la API

La API (`apps/api`) corre en un servidor Hetzner CAX11 (ARM, Nuremberg) administrado con **Dokploy**. PostgreSQL vive en el mismo servidor, dentro del proyecto Finnit de Dokploy. El servidor es compartido con otros proyectos.

## Cómo funciona

```
push a main ──► GitHub Actions (runner arm64)
                 1. docker build (apps/api/Dockerfile)
                 2. smoke test: Postgres temporal + migraciones + /health + signUp/signIn/me
                 3. push a ghcr.io/iamcharlizard/finnit-api:{sha-xxxxxxx, latest}
                 4. POST /api/application.deploy en Dokploy
                          │
                          ▼
              Dokploy descarga :latest y reinicia el contenedor
              └─ docker-entrypoint.sh: prisma migrate deploy → node dist/main.js
```

- Workflow: [`.github/workflows/deploy-api.yml`](../.github/workflows/deploy-api.yml). Se ejecuta al hacer push a `main` con cambios en la API, la base de datos o el lockfile, o manualmente desde *Actions → Deploy API → Run workflow*.
- Las migraciones se aplican al arrancar el contenedor. Deben ser **compatibles hacia atrás**: durante el reinicio, el contenedor anterior sigue atendiendo con el esquema ya migrado.
- Probar la imagen en local: `docker build -f apps/api/Dockerfile -t finnit-api:local . && apps/api/scripts/smoke-test.sh finnit-api:local`

## Configuración inicial (una sola vez)

### 1. Base de datos en Dokploy

1. **Projects → Create Project** `Finnit` (entorno `production`).
2. Dentro del proyecto: **Create Service → Database → PostgreSQL**.
   - Nombre: `finnit-db`; base: `finnit`; usuario: `finnit`; contraseña: genera una fuerte (`openssl rand -base64 32`).
   - Imagen: `postgres:18` (misma versión que en desarrollo y en el smoke test).
   - **No** configures *External Port*: la base solo debe ser accesible dentro de la red de Docker.
3. Deploy. En la pestaña de conexión copia el **Internal Connection URL** (algo como `postgresql://finnit:...@finnit-finnitdb-xxxx:5432/finnit`).
4. **Backups**: agrega un destino S3 (Settings → S3 Destinations) y programa un respaldo diario de `finnit-db`.

### 2. Aplicación en Dokploy

1. En el proyecto Finnit: **Create Service → Application** `finnit-api`.
2. **Provider → Docker**: imagen `ghcr.io/iamcharlizard/finnit-api:latest`.
   - Si el paquete de GHCR es privado, agrega el registro en *Settings → Registry* con un token de GitHub con permiso `read:packages`. Alternativa: en GitHub → *Packages → finnit-api → Package settings*, hazlo público (el repo ya es público).
3. **Environment**:
   ```
   DATABASE_URL=<Internal Connection URL del paso 1>
   JWT_SECRET=<openssl rand -base64 48>
   NODE_ENV=production
   PORT=3000
   GRAPHQL_PLAYGROUND=false
   GRAPHQL_INTROSPECTION=false
   ```
   Sin `JWT_SECRET` la API se niega a arrancar en producción.
4. **Domains**: `api.<tu-dominio>` → puerto `3000`, HTTPS con Let's Encrypt. Crea antes el registro **A** en el DNS.
5. **Advanced → Resources**: límite de memoria de `512 MB` para no afectar a los otros proyectos del servidor.
6. **Deployments**: copia el `applicationId` (aparece en la URL de la app en Dokploy).

### 3. Secretos en GitHub

En el repo: *Settings → Environments → New environment* `production`, y dentro agrega estos **Environment secrets**:

| Secreto | Valor |
|---|---|
| `DOKPLOY_URL` | `https://panel.<tu-dominio>` (sin `/` al final) |
| `DOKPLOY_API_KEY` | Dokploy → *Profile → API/CLI → Generate token* |
| `DOKPLOY_APPLICATION_ID` | El `applicationId` del paso 2.6 |

Opcional: en el environment `production` activa *Required reviewers* para aprobar cada despliegue manualmente.

### 4. Primer despliegue

*Actions → Deploy API → Run workflow*. Al terminar, comprueba `https://api.<tu-dominio>/health` → `{"status":"ok"}`.

## Rollback

- **Código:** cada despliegue publica `sha-<commit>`. En Dokploy cambia la imagen a `ghcr.io/iamcharlizard/finnit-api:sha-<commit anterior>` y pulsa *Deploy*. Para volver al flujo automático, regresa la imagen a `:latest`.
- **Base de datos:** Prisma no revierte migraciones. Cada migración debe tener su script de rollback (ver `packages/database/scripts/rollback.sql`), o se restaura el respaldo diario de Dokploy.
