# Despliegue

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
                           2. smoke test: Postgres 18 temporal + migraciones + /health + create-master/signIn/me
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
   AWS_REGION=<región del bucket, p. ej. us-east-2>
   S3_BUCKET=<bucket del ambiente, ver "Almacenamiento de archivos">
   AWS_ACCESS_KEY_ID=<access key del usuario IAM del ambiente>
   AWS_SECRET_ACCESS_KEY=<secret del usuario IAM del ambiente>
   ANTHROPIC_API_KEY=<opcional>
   ANTHROPIC_WORKSPACE_ID=<solo si la llave no está ligada a un workspace de Anthropic>
   GOOGLE_API_KEY=<opcional: Google Cloud Translation para traducir las categorías que crean los usuarios; sin ella se traducen con IA>
   OPENAI_API_KEY=<opcional>
   GEMINI_API_KEY=<opcional>
   GOOGLE_CLIENT_IDS=<opcional: Client IDs de Google (web, iOS, Android) separados por comas; ver "Login con Google">
   SYNCFY_API_KEY=<opcional: conexión bancaria con Syncfy; ver "Conexión bancaria (Syncfy)">
   ```
4. **Domains**: el dominio de la tabla, *Path* `/`, *Container Port* `3000`, HTTPS con Let's Encrypt, *Strip Path* desactivado. Crea antes el registro **A** en el DNS (`api` o `api-test` → IPv4 del servidor).
5. **Advanced → Resources**: límites según la tabla.
6. Copia el `applicationId` (último segmento de la URL de la app en Dokploy).

### Almacenamiento de archivos (S3)

Todos los archivos (estados de cuenta y adjuntos de transacciones) van a un bucket **privado** por ambiente. Solo la API los lee y escribe, con las llaves de su usuario IAM; nunca hay URLs públicas ni pre-firmadas. Los usuarios descargan sus archivos por la API (`GET /statements/:id/file`, `GET /attachments/:id/file`) con su token, y la API comprueba en la base de datos que el archivo sea suyo antes de leerlo de S3. Las llaves de los objetos son `users/<userId>/<tipo>/<id>.<ext>`.

**1. Bucket**, uno por ambiente (en los ejemplos, `finnit-files-prod` y `finnit-files-test`), en la región de `AWS_REGION`:

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
- Solo los administradores pueden activar o desactivar modelos, elegir el predeterminado o cambiar el orden, desde el panel (`/admin/ai`) o con `updateAiModel`, `createAiModel` y `deleteAiModel`.
- Cada funcionalidad de IA (hoy solo `statement_parsing`, "Leer estados de cuenta en PDF") se puede apagar y tener su propio modelo, con o sin respaldo en los demás modelos activos (`aiFeatures`, `updateAiFeature`). Apagada, esos estados de cuenta quedan en `failed`.
- Se prueba primero el modelo predeterminado; si falla, los demás modelos activos con soporte de PDF, en orden de `sortOrder`. Un modelo desactivado nunca se usa.
- Las llaves van por proveedor en las variables `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` y `GEMINI_API_KEY`, nunca en la base de datos.

El PDF se envía a la API del proveedor. Si no hay ningún modelo utilizable, esos estados de cuenta quedan en `failed` con un mensaje que lo indica.

### Traducción de categorías

Las categorías se guardan con su nombre original en inglés y una traducción por idioma (es, en). Las predeterminadas vienen traducidas. Las que crea o renombra un usuario se traducen con **Google Cloud Translation** (`GOOGLE_API_KEY`).

Para obtener la llave, en el proyecto Finnit de Google Cloud:
1. Activa *Cloud Translation API*.
2. Crea una API key restringida a esa API.

Si Google falla, se usa la funcionalidad de IA `translation`. Si también falla, se guarda el texto tal cual en los dos idiomas. Nunca bloquea la creación de la categoría.

### Conexión bancaria (Syncfy)

- `SYNCFY_API_KEY` habilita la conexión bancaria. Cada llave (sandbox o producción) ve sus propios usuarios y conexiones.
- **Testing usa por ahora la llave de producción**, para probar con bancos reales. Consecuencias:
  - Las conexiones de testing cuentan para el límite del plan de Syncfy.
  - Testing también sincroniza a las 7:00 y 15:00, y esas sincronizaciones entran a los bancos reales.
  - Los datos no se mezclan con producción: el usuario de Syncfy se crea con el id del usuario de Finnit (`id_external`), y cada base tiene ids distintos.
  - Para probar sin bancos reales, cambia a la llave de sandbox; las conexiones creadas con una llave no se ven con la otra.
- La app (web o móvil) obtiene un token con `createBankConnectSession` y envía usuario, contraseña y códigos del banco directo a Syncfy con `@finnit/bank-connect`; si el banco necesita algo que el formulario nativo no soporta, la web abre el widget de Syncfy. Finnit guarda solo los ids de Syncfy, nunca usuario ni contraseña del banco.
- La API sincroniza a las 7:00 y 15:00 (CDMX), solo con `NODE_ENV=production` (production y testing). En local está apagado para no entrar al banco con una copia de datos reales; `BANK_SYNC_SCHEDULED=true|false` lo fuerza en cualquier ambiente. "Sincronizar ahora" funciona siempre.
- Cada sincronización pide a Syncfy que entre al banco como máximo cada 20 h por conexión (o cada hora si el usuario lo pide) y respeta `ready_in`; las lecturas son incrementales (`dt_refresh_from`) y reintenta con espera ante 429/5xx.
- Para adoptar una conexión creada fuera de la app (pruebas): `linkSyncfyUser(email, syncfyUser)` (solo administradores) y luego `registerBankConnection(idCredential)` como ese usuario.
- Borrar una conexión en Finnit no la borra en Syncfy; hazlo desde Syncfy.
- Revisa el límite de tu plan de Syncfy (credenciales y transacciones) antes de abrirlo a más usuarios.

### Usuario maestro y acceso

No hay registro abierto: un administrador da de alta a cada persona en el panel de la web (`/admin/users`). Cada ambiente necesita un **usuario maestro**, que puede nombrar a otros administradores. Créalo después del primer despliegue con la migración `20261014090000_admin_access_and_ai_features`:

1. En Dokploy, abre la app del ambiente → **Docker Terminal** (o `docker exec -it <contenedor> sh` en el servidor).
2. Ejecuta:
   ```
   node /repo/apps/api/dist/scripts/create-master.js --email <tu correo> --name "<tu nombre>"
   ```
   La terminal de Dokploy abre en `/`; el código del contenedor está en `/repo`, por eso la ruta completa. El comando pide la contraseña sin mostrarla (mínimo 10 caracteres). No la pongas en la línea de comandos: quedaría en el historial.
3. Entra a la web con ese correo y contraseña, o con Google si el correo es de una cuenta de Google.

- Si ya hay un maestro, el comando se niega; con `--replace` le pasa el rol a otro usuario (el anterior sigue siendo administrador).
- Si el maestro pierde su contraseña, vuelve a ejecutar el comando con su correo: asigna la nueva contraseña y cierra sus sesiones.
- Desactivar a un usuario o cambiarle la contraseña cierra sus sesiones abiertas (en máximo 15 minutos, la vida del access token).

### Login con Google

Google solo inicia sesión: la persona entra si su correo de Google es el de un usuario dado de alta y activo. Nunca crea cuentas.

**1. Proyecto y pantalla de consentimiento** (una vez, sirve para todos los ambientes), en [console.cloud.google.com](https://console.cloud.google.com):
1. Crea el proyecto `Finnit`.
2. *Google Auth Platform → Get started*: nombre de la app "Finnit", correo de soporte, audiencia **External**, correo de contacto.
3. *Branding*: página principal, política de privacidad y dominio autorizado `<dominio>`. Sin logo no hace falta la verificación de marca.
4. *Data access*: solo `openid`, `email` y `profile`. Son permisos no sensibles, sin revisión de Google.
5. *Audience*: **Publish app** (pasar a "In production"). En "Testing" solo entran los correos de prueba que agregues ahí, con un máximo de 100.

**2. Clientes OAuth** (*Google Auth Platform → Clients → Create client*):

| Cliente | Tipo | Configuración |
|---|---|---|
| Finnit Web | Web application | Orígenes: `http://localhost:3001`, `https://app-test.<dominio>`, `https://app.<dominio>`. URIs de redirección: los mismos orígenes + `/api/auth/google/callback` |
| Finnit iOS | iOS | Bundle ID `com.karlhub.finnitapp` |
| Finnit Android | Android | Paquete `com.karlhub.finnitapp` + SHA-1 de la llave de firma: la de debug (`keytool -list -v -keystore ~/.android/debug.keystore -storepass android`) para desarrollo, y la de release / Play App Signing al publicar (un cliente por llave) |

Los previews de Vercel con URL aleatoria no pueden usar Google: solo los dominios registrados.

**3. Variables:**

| Dónde | Variable | Valor |
|---|---|---|
| API (Dokploy, cada ambiente) | `GOOGLE_CLIENT_IDS` | Client IDs de Web, iOS y Android, separados por comas |
| Web (Vercel, cada ambiente) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Client ID y secret de "Finnit Web" |
| Móvil (`apps/finnit-app/.env`) | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` | Client ID web, Client ID iOS y el *iOS URL scheme* del cliente iOS |

En el móvil, el login con Google necesita un *development build* (`npx expo run:ios` / `run:android` o EAS); no funciona en Expo Go.

### 3. Secretos en GitHub

En el repo: *Settings → Environments → New environment*, con el nombre exacto del ambiente (`production` o `testing`). En cada uno agrega estos **Environment secrets**:

| Secreto | Valor |
|---|---|
| `DOKPLOY_URL` | `https://panel.<dominio-del-panel>` (sin `/` al final). Igual en ambos |
| `DOKPLOY_API_KEY` | Dokploy → *Profile → API/CLI → Generate token*. Puede ser el mismo en ambos |
| `DOKPLOY_APPLICATION_ID` | El `applicationId` de la app **de ese ambiente** |
| `DOKPLOY_OCR_APPLICATION_ID` | El `applicationId` de la app de OCR de ese ambiente (ver "OCR (servicio interno)") |

Opcional: en `production` activa *Required reviewers* para aprobar cada despliegue manualmente.

### 4. Primer despliegue

Haz push a la rama del ambiente o usa *Actions → Deploy API → Run workflow* eligiendo la rama. Comprueba `https://<dominio del ambiente>/health` → `{"status":"ok"}`.

## OCR (servicio interno)

El servicio `ocr` ([`apps/ocr`](../apps/ocr/README.md)) lee fotos de tickets y PDFs escaneados con RapidOCR (PP-OCRv5). Es una imagen aparte para que su consumo de CPU y memoria no afecte a la API. **No tiene dominio**: solo la API lo llama, por la red interna de Dokploy, con un token compartido. Diseño y mediciones: [`docs/document-ocr.md`](document-ocr.md).

```
push a main o testing con cambios en apps/ocr ──► GitHub Actions (runner arm64)
   1. docker build --target test → pytest dentro de la imagen (imágenes sintéticas)
   2. docker build → smoke test: sin token no arranca, /health, 401, OCR de un ticket generado con QR
   3. push a ghcr.io/iamcharlizard/finnit-ocr:{sha-xxxxxxx, latest|testing}
   4. POST /api/application.deploy en Dokploy (DOKPLOY_OCR_APPLICATION_ID del ambiente)
```

Workflow: [`.github/workflows/deploy-ocr.yml`](../.github/workflows/deploy-ocr.yml). También se puede lanzar a mano (*Actions → Deploy OCR → Run workflow*).

| | production | testing |
|---|---|---|
| App (*App Name*) | `finnit-ocr` | `finnit-ocr-test` |
| Imagen | `ghcr.io/iamcharlizard/finnit-ocr:latest` | `ghcr.io/iamcharlizard/finnit-ocr:testing` |
| Dominio | Ninguno | Ninguno |
| Memoria (límite / reserva) | 1 GB / 256 MB | 768 MB / 128 MB |
| CPU (límite / reserva) | 1 / — | 0.5 / — |
| Variables extra | `OCR_THREADS=1` | `OCR_THREADS=1`, `OCR_PDF_DPI=150` |

Por qué esos valores (medidos en arm64, ver la fase 0 en `docs/document-ocr.md`): ~160 MB en reposo, ~0.6 GB de pico con fotos y ~0.8 GB con páginas de PDF a 200 dpi (~0.57 GB a 150 dpi). Con `OCR_MAX_CONCURRENCY=1` (por defecto) solo hay un trabajo a la vez. `OCR_THREADS` debe ser igual al límite de CPU redondeado hacia arriba: ONNX Runtime no ve la cuota de CPU y con más hilos se vuelve 3–4× más lento. Si las fotos tardan demasiado en el servidor y la máquina tiene CPU libre, sube producción a CPU 2 con `OCR_THREADS=2`. Si la memoria del servidor no alcanza, detén `finnit-ocr-test` cuando no lo uses: la API de testing responde con un error tipado mientras no esté.

### Crear la app (por ambiente)

1. En el proyecto **Finnit**: **Create Service → Application** con el *App Name* de la tabla.
2. **Provider → Docker**: la imagen de la tabla. El paquete `finnit-ocr` de GHCR debe ser público (*GitHub → Packages → finnit-ocr → Package settings → Change visibility*), igual que `finnit-api`; si lo dejas privado, configura *Registry URL* `ghcr.io` con un token con `read:packages`.
3. **Environment**:
   ```
   OCR_SERVICE_TOKEN=<openssl rand -hex 32, distinto por ambiente>
   OCR_THREADS=1
   ```
   más las variables extra de la tabla. Opcionales (con sus valores por defecto): `OCR_MAX_CONCURRENCY=1`, `OCR_REQUEST_TIMEOUT_SECONDS=30`, `OCR_PDF_TIMEOUT_SECONDS=300`, `OCR_MAX_UPLOAD_MB=15`, `OCR_PDF_DPI=200`. Sin `OCR_SERVICE_TOKEN` el contenedor no arranca.
4. **Domains**: ninguno. **Advanced → Ports**: ninguno publicado. El contenedor escucha en el puerto `8090` dentro de la red de Dokploy.
5. **Advanced → Resources**: límites según la tabla.
6. Deploy. En **Logs** debe aparecer `models loaded (PP-OCRv5)`; el healthcheck de la imagen consulta `/health`.
7. Copia el `applicationId` y agrégalo como secreto `DOKPLOY_OCR_APPLICATION_ID` en el environment de GitHub del ambiente (ver "Secretos en GitHub").

### Conectar la API

En la app de la API del mismo ambiente:
```
OCR_SERVICE_URL=http://<App Name de la app de OCR>:8090
OCR_SERVICE_TOKEN=<el mismo valor que en la app de OCR>
```
Usa el nombre exacto que muestra Dokploy para la app de OCR (si le agregó un sufijo aleatorio, inclúyelo), igual que con el host de la base. Para comprobar desde la terminal de la API: `node -e "fetch('http://<host>:8090/health').then(r=>r.text()).then(console.log)"` → `{"status":"ok","engine":"rapidocr","models":"PP-OCRv5"}`.

Timeouts para el cliente de la API: una foto tarda unos segundos (máximo 30 s en el servicio, más hasta 30 s de espera si hay otro trabajo en curso); un PDF, ~7 s por página (máximo `OCR_PDF_TIMEOUT_SECONDS`). Respuestas `503 busy` y `504 timeout` se pueden reintentar más tarde.

### Medir en el servidor

[`apps/ocr/scripts/benchmark.sh`](../apps/ocr/scripts/benchmark.sh) arranca la imagen con límite de memoria, envía archivos (fotos a `/v1/image`, PDFs a `/v1/pdf`) y muestra latencia, tiempos del servidor y número de líneas y QR (nunca el texto leído), más la memoria en reposo, el pico (`memory.peak` del cgroup y `docker stats`) y si hubo OOM. Usa el puerto `127.0.0.1:18090` y borra el contenedor al terminar. Necesita `bash`, `curl` y `awk`.

1. Copia el script y algunas fotos de prueba al servidor (son datos personales: bórralos al terminar):
   ```
   ssh <servidor> mkdir -p ocr-bench
   scp apps/ocr/scripts/benchmark.sh tickets/*.jpg <servidor>:ocr-bench/
   ```
2. Imagen: después del primer despliegue el script descarga `ghcr.io/iamcharlizard/finnit-ocr:latest`. Antes, constrúyela en la Mac (es arm64, igual que el CAX11) y cópiala:
   ```
   docker build -t finnit-ocr:local apps/ocr
   docker save finnit-ocr:local | gzip > /tmp/finnit-ocr.tar.gz
   scp /tmp/finnit-ocr.tar.gz <servidor>:ocr-bench/
   ```
3. En el servidor (Docker requiere `sudo`):
   ```
   cd ocr-bench && chmod +x benchmark.sh
   # Con la configuración recomendada para producción (1 GB, 1 CPU):
   sudo ./benchmark.sh -m 1g -c 1 -n 3 *.jpg
   # Con 2 CPU, para comparar:
   sudo ./benchmark.sh -m 1g -c 2 -n 3 *.jpg
   # Con la imagen copiada en vez de la de GHCR:
   sudo ./benchmark.sh -l finnit-ocr.tar.gz -i finnit-ocr:local -m 1g -c 1 *.jpg
   # Un PDF (máximo 3 páginas) con la configuración de testing:
   sudo ./benchmark.sh -m 768m -c 0.5 -e OCR_PDF_DPI=150 -P 3 -n 1 estado.pdf
   ```
   Opciones: `-i` imagen, `-l` tar a cargar, `-m` memoria, `-c` CPU, `-t` hilos (por defecto, la CPU redondeada hacia arriba), `-n` corridas por archivo, `-P` páginas de PDF, `-e VAR=valor` variables extra, `-p` puerto.
4. Anota en `docs/document-ocr.md` (fase 0) la latencia por foto, el pico de memoria y si hubo OOM, y ajusta los límites de la tabla si hace falta. Luego borra las fotos: `rm -rf ~/ocr-bench`.

### Rollback del OCR

Cada despliegue publica `sha-<commit>`. En Dokploy cambia la imagen de `finnit-ocr` (o `finnit-ocr-test`) a `ghcr.io/iamcharlizard/finnit-ocr:sha-<commit anterior>` y pulsa *Deploy*; para volver al flujo automático, regresa a `:latest` o `:testing`. El servicio no guarda estado ni tiene migraciones. Si hay que apagarlo, la API sigue funcionando: los tickets y PDFs escaneados quedan pendientes o pasan al respaldo de IA, según su configuración.

## Web app

La web (`apps/web`) se desplegará en **Vercel**, después de validar la API en testing. Mientras tanto se prueba en local contra la API de testing:

1. En `apps/web/.env.local`: `FINNIT_API_URL=https://api-test.<dominio>`
2. `pnpm web:dev` y abre http://localhost:3001.

Solo el servidor de Next habla con la API: el navegador llama a `/api/graphql` de la propia web, que agrega el token desde cookies httpOnly. Por eso la API no necesita CORS para la web. Variables de la web:

- `FINNIT_API_URL`: la API de su mismo ambiente (testing → `api-test`, production → `api`).
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`: el cliente "Finnit Web" (ver "Login con Google"). Sin ellas, el botón de Google muestra que no está disponible.

## Rollback

- **Código:** cada despliegue publica `sha-<commit>`. En Dokploy cambia la imagen a `ghcr.io/iamcharlizard/finnit-api:sha-<commit anterior>` y pulsa *Deploy*. Para volver al flujo automático, regresa la imagen a `:latest` (production) o `:testing` (testing).
- **Base de datos:** Prisma no revierte migraciones. Cada migración debe tener su script de rollback (ver `packages/database/scripts/rollback.sql`), o se restaura el respaldo diario de Dokploy.
