# Pasar de testing a producción

Cómo llevar a **producción** lo que hoy vive en **testing**: la base de datos (usuarios, cuentas, movimientos, categorías, préstamos…), los archivos en S3 y las conexiones bancarias de Syncfy, sin volver a conectar los bancos.

Complementa a [deployment.md](./deployment.md), que explica cómo se configura cada ambiente.

## La idea

Producción recibe una **copia exacta de la base de testing**. Como los ids no cambian, las conexiones de Syncfy siguen funcionando solas:

- Testing usa hoy la **llave de producción de Syncfy** (ver "Conexión bancaria (Syncfy)" en deployment.md). Las credenciales bancarias que creaste existen en esa llave.
- Finnit solo guarda ids de Syncfy: el usuario de Syncfy (`BankProviderUser`, creado con el id del usuario de Finnit como `id_external`), la credencial (`BankConnection.providerItemId`) y las cuentas (`LinkedAccount`). Nunca usuario ni contraseña del banco.
- Con la misma llave de Syncfy y los mismos ids en la base, la API de producción ve las mismas credenciales y retoma la sincronización donde iba testing (`transactionsCursor`). No hace falta volver a conectar ningún banco ni gastar otra credencial del plan.

**Lo importante:** después de la copia, **testing no debe volver a entrar a esos bancos**. Si los dos ambientes sincronizan la misma credencial, la sesión del banco se cruza: algunos bancos solo permiten una a la vez (código 406), Syncfy cuenta el doble de entradas al banco y llegan avisos repetidos. El paso 9 lo resuelve.

## Antes de empezar

- [ ] **Producción existe y está configurada** según [deployment.md](./deployment.md): app `finnit-api`, base `finnit-db`, dominio `api.<dominio>`, secretos de GitHub del ambiente `production` y respaldos diarios de la base activados.
- [ ] **Las variables de la API de producción** (Dokploy → `finnit-api` → *Environment*) están completas. Compáralas con las de testing:

  | Variable | En producción |
  |---|---|
  | `SYNCFY_API_KEY` | **La misma llave de producción de Syncfy que usa testing hoy.** Con otra llave, las conexiones copiadas no existen y se marcan como revocadas. |
  | `BANK_SYNC_SCHEDULED` | Vacía (con `NODE_ENV=production` la sincronización de las 7:00 y 15:00 queda encendida). |
  | `JWT_SECRET` | Propio de producción, distinto al de testing. Todos inician sesión de nuevo después de la copia; es lo esperado. |
  | `S3_BUCKET`, `AWS_*`, `S3_KMS_KEY_ID` | El bucket **de producción** y las llaves de su usuario IAM. |
  | `GOOGLE_CLIENT_IDS` | Los mismos Client IDs (Web, iOS, Android) que en testing. |
  | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY` | Las que uses; los modelos y funciones de IA activos viajan en la base, las llaves no. |
  | `OCR_SERVICE_URL`, `OCR_SERVICE_TOKEN` | El OCR de producción (ver "OCR (servicio interno)"). |
  | `FINNIT_BFF_SECRET` | Propio de producción, igual al de la web de producción. |
  | `WEB_APP_URL`, `MAIL_TRANSPORT` | Los de producción. |

- [ ] **Qué hay hoy en la base de producción.** La copia la **reemplaza completa**. Si ya tiene algo que quieras conservar (por ejemplo, registros de la lista de espera de la landing), respáldalo y decide si lo vuelves a cargar. Para verlo, en el servidor:
  ```sh
  PROD_DB=$(docker ps --format '{{.Names}}' | grep '^finnit-db-' | grep -v -- '-test-' | head -1)
  docker exec "$PROD_DB" psql -U finnit -d finnit -c \
    'select (select count(*) from "User") users, (select count(*) from "WaitlistEntry") waitlist, (select count(*) from "Transaction") movements;'
  ```
- [ ] **Una ventana fuera de las 7:00 y las 15:00** (hora de CDMX), para que ninguna sincronización programada corra a mitad de la copia. Calcula unos 30 minutos.
- [ ] **AWS CLI** en tu Mac, con un perfil que pueda leer el bucket de testing y escribir en el de producción. Los usuarios IAM de la API solo ven su propio bucket, así que usa un perfil de administrador.

## Pasos

Los comandos de base corren **en el servidor** (por SSH). Las dos bases están en el mismo servidor, así que la copia no sale de él.

### 1. El mismo código en los dos ambientes

La copia incluye la tabla de migraciones (`_prisma_migrations`), así que producción debe estar exactamente en la misma versión que testing:

1. Haz el PR de `testing` a `main` y mergéalo. El workflow despliega producción.
2. Comprueba `https://api.<dominio>/health` → `{"status":"ok"}`.
3. Compara las migraciones de las dos bases; las listas deben ser iguales:
   ```sh
   TEST_DB=$(docker ps --format '{{.Names}}' | grep '^finnit-db-test-' | head -1)
   PROD_DB=$(docker ps --format '{{.Names}}' | grep '^finnit-db-' | grep -v -- '-test-' | head -1)
   for db in "$TEST_DB" "$PROD_DB"; do
     echo "== $db"
     docker exec "$db" psql -U finnit -d finnit -tAc \
       'select migration_name from _prisma_migrations where finished_at is not null order by 1' | tail -3
   done
   ```

### 2. Detener testing

Así no cambia nada mientras se copia:

1. Dokploy → `finnit-api-test` → *Environment*: agrega `BANK_SYNC_SCHEDULED=false` y guarda.
2. Pulsa **Stop** en `finnit-api-test`. Sin API, ni la app ni la web pueden escribir en testing.

### 3. Detener producción

Dokploy → `finnit-api` → **Stop**. Nadie debe escribir en la base mientras se reemplaza.

### 4. Respaldar producción

Aunque esté vacía, es tu punto de regreso:

```sh
mkdir -p ~/finnit-migration && cd ~/finnit-migration
docker exec "$PROD_DB" pg_dump -U finnit -d finnit -Fc > prod-before-$(date +%F-%H%M).dump
ls -lh
```

### 5. Copiar la base de testing

```sh
docker exec "$TEST_DB" pg_dump -U finnit -d finnit -Fc > testing-$(date +%F-%H%M).dump
ls -lh
```

### 6. Cargarla en producción

Primero se vacía el esquema, para que quede exactamente como testing. Después se restaura la copia, sin dueños ni permisos, porque el usuario es `finnit` en las dos bases:

```sh
DUMP=$(ls -t testing-*.dump | head -1)
docker exec "$PROD_DB" psql -U finnit -d finnit -v ON_ERROR_STOP=1 -c \
  'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
docker exec -i "$PROD_DB" pg_restore -U finnit -d finnit --no-owner --no-privileges \
  --exit-on-error < "$DUMP"
```

Comprueba que las dos bases tengan lo mismo:

```sh
Q='select (select count(*) from "User") users, (select count(*) from "Account") accounts,
  (select count(*) from "Transaction") movements, (select count(*) from "BankConnection") banks,
  (select count(*) from "BankProviderUser") syncfy_users'
docker exec "$TEST_DB" psql -U finnit -d finnit -c "$Q"
docker exec "$PROD_DB" psql -U finnit -d finnit -c "$Q"
```

Si `pg_restore` falla, vuelve al respaldo del paso 4 (ver "Si algo sale mal").

### 7. Copiar los archivos de S3

La base solo guarda la llave de cada archivo (`users/<userId>/<tipo>/<id>.<ext>`): estados de cuenta, adjuntos, tickets, capturas y fotos de perfil. Como los ids son los mismos, basta copiar los objetos al bucket de producción. Desde tu Mac:

```sh
aws s3 sync s3://<bucket-de-testing>/users/ s3://<bucket-de-produccion>/users/ --profile <admin>
```

- Si los buckets usan **SSE-KMS con llaves distintas**, agrega `--sse aws:kms --sse-kms-key-id <S3_KMS_KEY_ID de producción>`. Así los objetos quedan cifrados con la llave que puede leer la API de producción.
- Compara cuántos objetos hay en cada bucket: `aws s3 ls s3://<bucket>/users/ --recursive --summarize --profile <admin> | tail -2`.

### 8. Encender producción y revisarla

1. Dokploy → `finnit-api` → **Deploy** (o *Start*). Al arrancar corre `prisma migrate deploy`. Como las migraciones ya están en la copia, no hace nada.
2. `https://api.<dominio>/health` → `{"status":"ok"}`.
3. Entra con tu usuario (contraseña o Google) contra producción (ver el paso 10 para apuntar la web y la app):
   - El inicio muestra tus saldos y movimientos.
   - Un estado de cuenta o un adjunto se abre, lo que confirma que S3 funciona.
   - En una cuenta conectada, **Sincronizar ahora** termina sin error y la pastilla dice "Automática · hace un momento".
4. Las sincronizaciones programadas de producción empiezan en la siguiente ventana de las 7:00 o las 15:00. Después llega el aviso "Nu se actualizó" de cada banco.

### 9. Desconectar testing de los bancos reales

Testing sigue teniendo las mismas conexiones, y con la llave de producción de Syncfy podría volver a entrar a tus bancos. Elige una opción:

- **Recomendada: testing con la llave sandbox de Syncfy.** Dokploy → `finnit-api-test` → *Environment*: pon `SYNCFY_API_KEY` = la llave sandbox y quita `BANK_SYNC_SCHEDULED=false` (o déjalo, si no quieres sincronizar en testing). Con esa llave, las conexiones copiadas no existen: la próxima vez que testing intente sincronizarlas las marca como revocadas, solo en su propia base, sin tocar Syncfy ni producción. Para probar la conexión bancaria en testing, usa los bancos de prueba de sandbox.
- **Testing sin conexión bancaria:** deja `SYNCFY_API_KEY` vacía en testing. La conexión bancaria queda deshabilitada ahí.

**Nunca borres esas conexiones desde Syncfy:** son las que usa producción. Borrarlas en la base de testing no les hace nada en Syncfy, pero con la llave sandbox no hace falta.

Al final, enciende de nuevo `finnit-api-test` (*Deploy*).

### 10. Apuntar la web y la app a producción

- **Web (Vercel):** en las variables del ambiente *Production*, `FINNIT_API_URL=https://api.<dominio>`. También `FINNIT_BFF_SECRET` (igual al de la API de producción), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` y `FINNIT_SITE_URL`. Haz redeploy. Si hasta ahora probabas la web local contra testing, en `apps/web/.env.local` cambia `FINNIT_API_URL` cuando quieras usar producción.
- **App móvil:** `EXPO_PUBLIC_GRAPHQL_URL` se mete dentro del build, así que cambiarla exige compilar de nuevo:
  1. En `apps/finnit-app/.env.local`, que se carga en todos los modos y hoy apunta a `api-test`, pon `EXPO_PUBLIC_GRAPHQL_URL=https://api.<dominio>/graphql`.
  2. `pnpm build:device` (o un build de EAS con esa variable en su perfil).
  3. Abre la app e inicia sesión de nuevo.
- **Google:** el cliente "Finnit Web" ya debe tener `https://app.<dominio>` en orígenes y redirecciones (ver "Login con Google").

### 11. Limpiar

- Borra las copias del servidor cuando todo funcione, porque contienen datos reales: `rm -r ~/finnit-migration`. Para guardar una, bájala a un lugar cifrado.
- Quita `BANK_SYNC_SCHEDULED=false` de testing si lo dejaste y testing ya usa la llave sandbox.

## Si algo sale mal

- **Antes del paso 8**, solo se tocó la base de producción. Vuelve a cargar el respaldo del paso 4:
  ```sh
  BACKUP=$(ls -t ~/finnit-migration/prod-before-*.dump | head -1)
  docker exec "$PROD_DB" psql -U finnit -d finnit -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
  docker exec -i "$PROD_DB" pg_restore -U finnit -d finnit --no-owner --no-privileges < "$BACKUP"
  ```
  Enciende testing de nuevo (quita `BANK_SYNC_SCHEDULED=false` y *Deploy*) para seguir como antes.
- **Después del paso 8**, si producción ya sincronizó, no regreses a testing con la llave de producción sin apagar antes producción. Las dos no deben sincronizar las mismas credenciales.
- Los objetos copiados a S3 no estorban si vuelves atrás. El bucket tiene versionado, así que también se pueden borrar sin perder nada de testing.

## Otra opción: empezar producción desde cero

Si prefieres no llevar los datos de testing, porque eran pruebas:

1. Crea el usuario maestro en producción (`create-master.js`, ver "Usuario maestro y acceso") y da de alta a los usuarios desde `/admin/users`.
2. Cada usuario conecta de nuevo sus bancos desde la app. Esto crea **credenciales nuevas** en Syncfy, que cuentan otra vez para el límite del plan.
3. Para liberar el plan y que testing no siga entrando a esos bancos, borra desde el panel de Syncfy las credenciales viejas que creó testing, o aplica el paso 9.

Se pierde todo lo que no viene del banco: categorías y nombres automáticos, préstamos, pagos recurrentes, presupuestos, metas, adjuntos y clasificaciones a mano.

## Más adelante: refrescar testing con datos de producción

Si algún día quieres una copia de producción en testing para probar, es el mismo proceso en sentido contrario. Antes de encender testing con esa copia, **testing debe tener la llave sandbox o `SYNCFY_API_KEY` vacía**. Si no, entraría a los bancos reales de todos los usuarios de producción.
