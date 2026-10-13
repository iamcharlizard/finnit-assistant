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

   Para archivos (estados de cuenta y adjuntos), IA y banco (opcionales; sin ellas la API arranca, pero subir archivos responde 503):
   ```
   AWS_REGION=us-east-1
   S3_BUCKET=<bucket del ambiente, ver "Almacenamiento de archivos">
   AWS_ACCESS_KEY_ID=<access key del usuario IAM del ambiente>
   AWS_SECRET_ACCESS_KEY=<secret del usuario IAM del ambiente>
   ANTHROPIC_API_KEY=<opcional>
   OPENAI_API_KEY=<opcional>
   GEMINI_API_KEY=<opcional>
   ADMIN_EMAILS=<emails que pueden administrar el catálogo de modelos de IA, separados por comas>
   SYNCFY_API_KEY=<opcional: conexión bancaria con Syncfy; llave de sandbox en testing, de producción en production>
   ```
4. **Domains**: el dominio de la tabla, *Path* `/`, *Container Port* `3000`, HTTPS con Let's Encrypt, *Strip Path* desactivado. Crea antes el registro **A** en el DNS (`api` o `api-test` → IPv4 del servidor).
5. **Advanced → Resources**: límites según la tabla.
6. Copia el `applicationId` (último segmento de la URL de la app en Dokploy).

### Almacenamiento de archivos (S3)

Todos los archivos (estados de cuenta y adjuntos de transacciones) van a un bucket **privado** por ambiente. Solo la API los lee y escribe, con las llaves de su usuario IAM; nunca hay URLs públicas ni pre-firmadas. Los usuarios descargan sus archivos por la API (`GET /statements/:id/file`, `GET /attachments/:id/file`) con su token, y la API comprueba en la base de datos que el archivo sea suyo antes de leerlo de S3. Las llaves de los objetos son `users/<userId>/<tipo>/<id>.<ext>`.

**1. Bucket** (`finnit-files-prod` y `finnit-files-test`, en la región de `AWS_REGION`):

| Ajuste | Valor |
|---|---|
| Block Public Access | Las 4 opciones activadas |
| Object Ownership | *Bucket owner enforced* (ACLs deshabilitadas) |
| Default encryption | SSE-S3 (o SSE-KMS con *Bucket Key*, y entonces `S3_KMS_KEY_ID`) |
| Versioning | Activado (protege contra borrados accidentales) |
| Lifecycle | Expirar versiones no actuales a los 30 días; abortar *multipart uploads* incompletos a los 7 días |
| CORS | Ninguno (el navegador nunca habla con S3) |
| Static website hosting | Desactivado |
| Server access logging / CloudTrail data events | Recomendado en producción |

**2. Bucket policy** (sustituye `<ACCOUNT_ID>`, el bucket y el usuario IAM). Rechaza conexiones sin TLS y cualquier acceso a objetos que no venga del usuario de la API:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::finnit-files-prod", "arn:aws:s3:::finnit-files-prod/*"],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    },
    {
      "Sid": "OnlyTheApiReadsAndWritesObjects",
      "Effect": "Deny",
      "Principal": "*",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::finnit-files-prod/*",
      "Condition": {
        "ArnNotEquals": { "aws:PrincipalArn": "arn:aws:iam::<ACCOUNT_ID>:user/finnit-api-prod" }
      }
    }
  ]
}
```
La segunda regla solo afecta a los objetos: tu usuario administrador sigue pudiendo cambiar la configuración del bucket.

**3. Usuario IAM** `finnit-api-prod` (y `finnit-api-test` para su bucket), sin acceso a consola, con solo esta política:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::finnit-files-prod/users/*"
  }]
}
```
Si usas SSE-KMS, agrega `kms:Encrypt`, `kms:Decrypt` y `kms:GenerateDataKey` sobre esa llave. Genera una *access key*, ponla en Dokploy (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) y rótala periódicamente.

**4. Variables** en Dokploy: `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y, opcionales, `S3_KMS_KEY_ID` y `S3_EXPECTED_BUCKET_OWNER` (tu *account id*: la API rechaza operar si el bucket es de otra cuenta).

En desarrollo local, el servicio `s3` de `docker-compose.yml` (s3mock en el puerto 9090) sustituye a AWS; las variables están en `apps/api/.env.example`.

### Modelos de IA

Los bancos sin parser local se leen con IA. Los modelos disponibles están en el catálogo `AiModel` (Anthropic, OpenAI y Gemini):

- La query `aiModels` lista el catálogo e indica para cada modelo si está activo, si es el predeterminado y si se puede usar (`usable`): activo **y** con la llave de su proveedor configurada.
- Solo los emails de `ADMIN_EMAILS` pueden activar o desactivar modelos, elegir el predeterminado o cambiar el orden (`updateAiModel`, `createAiModel`, `deleteAiModel`).
- Se prueba primero el modelo predeterminado; si falla, los demás modelos activos con soporte de PDF, en orden de `sortOrder`. Un modelo desactivado nunca se usa.
- Las llaves van por proveedor en las variables `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` y `GEMINI_API_KEY`, nunca en la base de datos.

El PDF se envía a la API del proveedor. Si no hay ningún modelo utilizable, esos estados de cuenta quedan en `failed` con un mensaje que lo indica.

En desarrollo local, el servicio `s3` de `docker-compose.yml` (s3mock en el puerto 9090) sustituye a AWS; las variables están en `apps/api/.env.example`.

### Conexión bancaria (Syncfy)

- `SYNCFY_API_KEY` habilita la conexión bancaria. Usa la llave de **sandbox** en testing y la de **producción** solo en production: cada llave ve sus propios usuarios y conexiones.
- El usuario conecta su banco en el widget de Syncfy (`createBankConnectSession`); Finnit guarda solo los ids de Syncfy, nunca usuario ni contraseña del banco.
- La API sincroniza a las 7:00 y 15:00 (CDMX). Pide a Syncfy que entre al banco como máximo cada 20 h por conexión (o cada hora si el usuario lo pide) y respeta `ready_in`; las lecturas son incrementales (`dt_refresh_from`) y reintenta con espera ante 429/5xx.
- Para adoptar una conexión creada fuera de la app (pruebas): `linkSyncfyUser(email, syncfyUser)` (solo `ADMIN_EMAILS`) y luego `registerBankConnection(idCredential)` como ese usuario.
- Borrar una conexión en Finnit no la borra en Syncfy; hazlo desde Syncfy.
- Revisa el límite de tu plan de Syncfy (credenciales y transacciones) antes de abrirlo a más usuarios.

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
