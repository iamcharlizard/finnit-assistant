# Despliegue de la API

La API (`apps/api`) corre en un servidor Hetzner CAX11 (ARM, Nuremberg) administrado con **Dokploy**. Cada ambiente tiene su propio PostgreSQL en el mismo servidor, dentro del proyecto Finnit de Dokploy. El servidor es compartido con otros proyectos.

## Ambientes

| Ambiente | Rama | Tag de la imagen | Dominio | App / base en Dokploy |
|---|---|---|---|---|
| **production** | `main` | `latest` | `api.<dominio>` | `finnit-api` / `finnit-db` |
| **testing** | `testing` | `testing` | `api-test.<dominio>` | `finnit-api-test` / `finnit-db-test` |

Flujo de trabajo: `feature/*` → PR a `testing` (se despliega a testing y lo pruebas) → PR de `testing` a `main` (se despliega a producción).

Cada ambiente tiene su propia base de datos y su propio `JWT_SECRET`: los datos y las sesiones de testing nunca tocan producción.

## Cómo funciona

```
push a main o testing ──► GitHub Actions (runner arm64)
                           1. docker build (apps/api/Dockerfile)
                           2. smoke test: Postgres 18 temporal + migraciones + /health + signUp/signIn/me
                           3. push a ghcr.io/iamcharlizard/finnit-api:{sha-xxxxxxx, latest|testing}
                           4. POST /api/application.deploy en Dokploy (app del ambiente)
                                    │
                                    ▼
                        Dokploy descarga la imagen y reinicia el contenedor
                        └─ docker-entrypoint.sh: prisma migrate deploy → node dist/main.js
```

- Workflow: [`.github/workflows/deploy-api.yml`](../.github/workflows/deploy-api.yml). Se ejecuta al hacer push a `main` o `testing` con cambios en la API, la base de datos o el lockfile. También manualmente desde *Actions → Deploy API → Run workflow*, eligiendo la rama.
- Las migraciones se aplican al arrancar el contenedor. Deben ser **compatibles hacia atrás**: durante el reinicio, el contenedor anterior sigue atendiendo con el esquema ya migrado. Una migración llega primero a testing, así que ahí se detectan los problemas antes de producción.
- Probar la imagen en local: `docker build -f apps/api/Dockerfile -t finnit-api:local . && apps/api/scripts/smoke-test.sh finnit-api:local`

## Configuración de un ambiente en Dokploy

Repite estos pasos para cada ambiente, usando los valores de la tabla de abajo.

| | production | testing |
|---|---|---|
| Base (*App Name*) | `finnit-db` | `finnit-db-test` |
| App (*App Name*) | `finnit-api` | `finnit-api-test` |
| Imagen | `ghcr.io/iamcharlizard/finnit-api:latest` | `ghcr.io/iamcharlizard/finnit-api:testing` |
| Dominio | `api.<dominio>` | `api-test.<dominio>` |
| `GRAPHQL_PLAYGROUND` / `GRAPHQL_INTROSPECTION` | `false` | `true` (útil para explorar el schema) |
| Memoria de la API (límite / reserva) | 512 MB / 256 MB | 256 MB / 128 MB |
| CPU de la API (límite / reserva) | 1 / 0.25 | 0.5 / — |
| Memoria de la base (límite / reserva) | 1 GB / 256 MB | 512 MB / 128 MB |

### 1. Base de datos

1. En el proyecto **Finnit**: **Create Service → Database → PostgreSQL**.
   - *App Name* según la tabla; base `finnit`; usuario `finnit`.
   - Contraseña: usa el generador de Dokploy, o `openssl rand -hex 24`. Evita caracteres como `+ / = @`, porque rompen el `DATABASE_URL`.
   - Imagen: `postgres:18` (misma versión que en desarrollo y en el smoke test).
   - **No** configures *External Port*: la base solo debe ser accesible dentro de la red de Docker.
2. Deploy. En la pestaña de conexión copia el **Internal Connection URL** tal cual (el host lleva un sufijo aleatorio).
3. **Advanced → Resources**: límites según la tabla.
4. **Backups** (al menos en production): destino S3 (*Settings → S3 Destinations*) y respaldo diario.

### 2. Aplicación

1. **Create Service → Application** con el *App Name* de la tabla.
2. **Provider → Docker**: la imagen de la tabla. Deja *Registry URL*, *Username* y *Password* vacíos (el paquete de GHCR es público).
3. **Environment**:
   ```
   DATABASE_URL=<Internal Connection URL de la base de este ambiente>
   JWT_SECRET=<openssl rand -hex 32, distinto por ambiente>
   NODE_ENV=production
   PORT=3000
   GRAPHQL_PLAYGROUND=<según la tabla>
   GRAPHQL_INTROSPECTION=<según la tabla>
   ```
   `NODE_ENV=production` también en testing: así testing se comporta igual que producción. Sin `JWT_SECRET` la API no arranca.

   Para la importación de estados de cuenta (opcionales; sin ellas la API arranca, pero la subida de PDFs responde 503):
   ```
   AWS_REGION=us-east-1
   S3_BUCKET=<bucket del ambiente, ver "Almacenamiento de estados de cuenta">
   AWS_ACCESS_KEY_ID=<access key del usuario IAM del ambiente>
   AWS_SECRET_ACCESS_KEY=<secret del usuario IAM del ambiente>
   ANTHROPIC_API_KEY=<opcional: lectura con Claude de bancos sin parser local>
   STATEMENT_AI_MODEL=claude-haiku-5-5
   ```
4. **Domains**: el dominio de la tabla, *Path* `/`, *Container Port* `3000`, HTTPS con Let's Encrypt, *Strip Path* desactivado. Crea antes el registro **A** en el DNS (`api` o `api-test` → IPv4 del servidor).
5. **Advanced → Resources**: límites según la tabla.
6. Copia el `applicationId` (último segmento de la URL de la app en Dokploy).

### Almacenamiento de estados de cuenta (S3)

Los PDF de estados de cuenta se guardan en un bucket **privado** por ambiente. La API solo entrega URLs firmadas que expiran en 5 minutos.

1. En AWS (región `us-east-1` o la que uses en `AWS_REGION`), crea los buckets `finnit-statements-prod` y `finnit-statements-test`:
   - *Block all public access* activado.
   - Cifrado por defecto SSE-S3.
   - Opcional: regla de ciclo de vida para borrar versiones antiguas.
2. Crea un usuario IAM por ambiente (`finnit-api-prod`, `finnit-api-test`), sin acceso a consola, con esta política (cambia el bucket):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::finnit-statements-prod/*"
     }]
   }
   ```
3. Genera una access key para cada usuario y ponla en las variables del ambiente en Dokploy.

`ANTHROPIC_API_KEY` activa la lectura con Claude para bancos sin parser local. Ten en cuenta que el PDF se envía a la API de Anthropic. Sin la clave, esos estados de cuenta quedan en `failed` con "Unsupported statement format".

En desarrollo local, el servicio `s3` de `docker-compose.yml` (s3mock en el puerto 9090) sustituye a AWS; las variables están en `apps/api/.env.example`.

### 3. Secretos en GitHub

En el repo: *Settings → Environments → New environment*, con el nombre exacto del ambiente (`production` o `testing`). En cada uno agrega estos **Environment secrets**:

| Secreto | Valor |
|---|---|
| `DOKPLOY_URL` | `https://panel.<dominio-del-panel>` (sin `/` al final). Igual en ambos |
| `DOKPLOY_API_KEY` | Dokploy → *Profile → API/CLI → Generate token*. Puede ser el mismo en ambos |
| `DOKPLOY_APPLICATION_ID` | El `applicationId` de la app **de ese ambiente** |

Opcional: en `production` activa *Required reviewers* para aprobar cada despliegue manualmente.

### 4. Primer despliegue

Haz push a la rama del ambiente o usa *Actions → Deploy API → Run workflow* eligiendo la rama. Comprueba `https://<dominio del ambiente>/health` → `{"status":"ok"}`.

## Rollback

- **Código:** cada despliegue publica `sha-<commit>`. En Dokploy cambia la imagen a `ghcr.io/iamcharlizard/finnit-api:sha-<commit anterior>` y pulsa *Deploy*. Para volver al flujo automático, regresa la imagen a `:latest` (production) o `:testing` (testing).
- **Base de datos:** Prisma no revierte migraciones. Cada migración debe tener su script de rollback (ver `packages/database/scripts/rollback.sql`), o se restaura el respaldo diario de Dokploy.
