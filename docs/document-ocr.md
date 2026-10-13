# Extracción de tickets y estados de cuenta (OCR)

Investigación y plan para dos funciones:

1. **Foto de ticket → transacción**: el usuario toma una foto del ticket y Finnit propone la transacción.
2. **Estados de cuenta en PDF**: soportar PDFs escaneados y más bancos sin depender de la IA.

Regla de diseño: **la extracción local (open source, en nuestro servidor) va primero; la IA es solo el respaldo**, y se usa únicamente cuando una validación determinista dice que la extracción local falló o está incompleta.

## Resumen de la decisión

| Pregunta | Decisión |
|---|---|
| Motor de OCR | **RapidOCR** con los modelos **PP-OCRv5** (PaddleOCR) en formato ONNX |
| Dónde corre | Contenedor propio `ocr` (Python + FastAPI), solo en la red interna; la API lo llama por HTTP |
| PDFs digitales | Sin OCR: texto de la capa del PDF (`unpdf`, como hoy) |
| PDFs escaneados | Rasterizar → OCR → los mismos parsers locales |
| Tickets | QR del CFDI → OCR → reglas → borrador que el usuario confirma |
| Respaldo con IA | Solo si el estado de cuenta no cuadra o al ticket le falta total/fecha; para tickets se envía el **texto** del OCR, no la imagen |

## Comparativa de motores de OCR

Contexto: podemos instalar lo que sea en Docker, pero producción es un Hetzner **CAX11 (arm64, sin GPU)** compartido con la API, dos PostgreSQL y otros proyectos. Importan: precisión en fotos de tickets térmicos en español, consumo en CPU/RAM, soporte arm64 y licencia.

| Motor | Licencia | Precisión en fotos de tickets | CPU / RAM | arm64 | Veredicto |
|---|---|---|---|---|---|
| **RapidOCR** (modelos PP-OCRv5 en ONNX Runtime) | Apache-2.0 | Alta (mismos modelos que PaddleOCR) | Ligero; ~3× más rápido que PaddleOCR nativo en CPU en una prueba x86 | Wheels de ONNX Runtime para aarch64; hay ports que corren en ARM (validar) | ✅ **Elegido** |
| PaddleOCR (nativo, PaddlePaddle) | Apache-2.0 | Alta; mejor extracción de campos en el benchmark de recibos | Pesado (framework PaddlePaddle completo) | Soporte de PaddlePaddle en aarch64 menos claro | Mismos modelos, más costo. Alternativa si RapidOCR falla |
| Tesseract 5 (`spa`) / OCRmyPDF | Apache-2.0 / MPL-2.0 | Baja en fotos sin preprocesar; buena en escaneos limpios | Muy ligero | Sí (paquete de Debian) | Bueno para PDFs escaneados limpios, no para tickets |
| docTR | Apache-2.0 | Buen texto, pero la peor extracción de campos del benchmark | Pesado (PyTorch o TensorFlow) | Sí, con PyTorch | No compensa el peso |
| EasyOCR | Apache-2.0 | Media | Pesado (PyTorch), lento en CPU | Sí | Descartado |
| Surya | GPL-3.0 + pesos con licencia comercial restringida | Alta | Pesado; pensado para GPU | — | Descartado por licencia |
| Docling / Marker / MinerU | MIT / GPL / AGPL | — (convierten documentos; usan un OCR por dentro) | Muy pesado | Parcial | No hace falta: los PDFs de bancos ya traen texto |
| ML Kit v2 / Apple Vision (en el celular) | Propietario, gratuito | Alta | Corre en el dispositivo | — | Opcional después (fase 5) para vista previa sin conexión |

**Por qué RapidOCR:** es la mejor precisión open source para fotos (los modelos de PaddleOCR, que soportan español desde PP-OCRv5 multilingüe) sin cargar con el framework PaddlePaddle. Corre en CPU con ONNX Runtime, que publica builds para arm64. La biblioteca incluye un clasificador de orientación (texto girado), y los modelos convertidos a ONNX tienen licencia Apache-2.0.

**Pendiente de validar en la fase 0:** el consumo real de RAM y el tiempo por imagen en el CAX11 (arm64). Los números de rendimiento de arriba vienen de pruebas en x86 de terceros.

### Por qué un contenedor aparte y no dentro de la API

- La imagen de la API (Node, `bookworm-slim`) se mantiene pequeña y su arranque no cambia (`prisma migrate deploy`).
- El OCR consume mucha CPU: con su propio límite de memoria y CPU en Dokploy, no puede tumbar la API.
- El ecosistema de OCR más sólido está en Python (RapidOCR, OpenCV, `pypdfium2`, `zxing-cpp`).
- Sin dominio público: solo es accesible en la red interna de Dokploy y en `docker-compose` local.

## Estados de cuenta en PDF

### Cómo funciona hoy

`StatementParserRegistry.parse` ([statement-parser.registry.ts](../apps/api/src/modules/statements/parsing/statement-parser.registry.ts)):

1. Extrae el texto con `unpdf` (`extractPdfText`).
2. Usa el primer parser local cuyo `canParse` acepte el texto (hoy solo `banamex_v1`).
3. Si ninguno aplica, usa `AiStatementParser`.

Después, `StatementsService.process` calcula `checkStatement` (saldo anterior + cargos − abonos = saldo al corte) y lo guarda en `computedTotal` y `difference`.

### Huecos

- **PDF escaneado:** `extractPdfText` devuelve texto vacío, ningún parser lo reconoce y se va directo a la IA.
- **Parser local que extrae mal:** si `canParse` acepta el PDF, el resultado se usa aunque `checkStatement` diga que no cuadra. La IA nunca entra.
- **Un banco = una clase:** el parser de Banamex trabaja con texto plano y expresiones regulares. Cada banco nuevo es código nuevo.

### Diseño propuesto

```
PDF ─► texto (unpdf) ─► ¿hay texto? ── no ─► OCR (servicio ocr) ─┐
                            │ sí                                 │
                            ▼                                    ▼
                     parser local (canParse) ◄───────────────────┘
                            │
                     checkStatement ── cuadra ─► needs_review
                            │ no cuadra / sin parser
                            ▼
                    IA (si statement_parsing está habilitada)
                            │
                     checkStatement ─► needs_review (con la diferencia visible)
```

- **Validación como disparador:** la IA solo entra si el resultado local no cuadra (dentro de `BALANCE_TOLERANCE`). Si la IA tampoco cuadra, nos quedamos con el resultado que tenga menor `|difference|` y se marca para revisión.
- **PDF escaneado:** se detecta por poco texto por página. El servicio `ocr` rasteriza (`pypdfium2`, unos 300 dpi), aplica OCR y devuelve líneas reconstruidas por coordenadas. Pasan por los mismos parsers.
- **Perfiles por banco (cuando llegue el segundo banco):** usar las coordenadas que ya entrega pdf.js (`getTextContent`) para armar filas y columnas, y describir cada banco con configuración (texto que lo identifica, rangos de x de las columnas, formato de fecha, regla del signo) en lugar de una clase con expresiones regulares.
- **XML del CFDI del estado de cuenta:** Banamex emite sus estados de cuenta como CFDI 4.0, pero no encontramos una descarga del XML para personas físicas (BancaNet empresarial solo exporta TXT/CSV). Queda descartado por ahora.

## Fotos de tickets

### Qué se puede extraer sin IA

De forma confiable: **total, fecha, comercio (por RFC o por nombre) e IVA**. Las líneas de artículos son frágiles (abreviaturas, columnas desalineadas, papel térmico). Alcance: **un ticket = una transacción**, sin desglose.

### Pipeline

1. **QR del CFDI** (sin OCR): si es una factura impresa, el QR del SAT trae `re` (RFC del emisor), `rr` (RFC del receptor), `tt` (total), `id` (UUID) y `fe` (últimos 8 caracteres del sello). Se decodifica con `zxing-cpp` en el servicio `ocr`. Si hay QR válido, el total y el RFC son exactos.
2. **Preprocesado** (OpenCV): recorte del ticket, corrección de perspectiva, escala de grises y umbral adaptativo, y reducción a ~1600 px de lado mayor.
3. **OCR** (RapidOCR): líneas con su caja y su confianza.
4. **Reglas** (en la API, TypeScript, con pruebas unitarias):
   - Total: monto en la línea `TOTAL`; se descartan `SUBTOTAL`, `IVA`, `CAMBIO`, `EFECTIVO`, `PAGO`, `TARJETA`. Desempate: el monto mayor bajo el bloque de artículos.
   - Fecha: `dd/mm/aaaa`, `dd-mm-aa`, `dd-mmm-aaaa`, `aaaa-mm-dd`; no puede ser futura.
   - RFC del comercio: `[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}` (ya usamos un patrón similar en el parser de Banamex).
   - Comercio: tabla RFC → nombre → categoría, que se alimenta con las confirmaciones del usuario. Si no hay RFC, se usa la primera línea con letras del encabezado.
   - Forma de pago: últimos 4 dígitos de la tarjeta, si aparecen, para sugerir la cuenta.
   - Plantillas para las cadenas más comunes (OXXO, Walmart, Soriana, Costco, gasolineras), si las reglas genéricas no alcanzan.
5. **Confianza:** alta si hay total y fecha, y el total coincide con subtotal + IVA o con el QR. Baja si falta alguno.
6. **IA de respaldo:** solo con confianza baja y la función `receipt_parsing` habilitada. Se envía el **texto del OCR** con un esquema JSON (más barato y sin mandar la imagen).
7. **Borrador, no transacción:** el usuario revisa y confirma. Al confirmar:
   - Se busca un movimiento existente en la misma cuenta, con el mismo monto (±0.01) y fecha ±3 días (por ejemplo, uno que vino de Syncfy o de un estado de cuenta). Si existe, la foto se **adjunta** a ese movimiento y no se crea uno nuevo, para no contar el gasto dos veces.
   - Si no existe, se crea la transacción y la foto queda como adjunto (`users/<userId>/attachments/...`, como ya funciona `POST /transactions/:id/attachments`).

## Listado de tareas

### Fase 0: prueba con datos reales (antes de construir)

- [ ] Juntar un set de prueba local, fuera del repo: 30 fotos de tickets (OXXO, supermercados, gasolineras, restaurantes, facturas con QR), 3 estados de cuenta digitales y 2 escaneados.
- [ ] Script que corra RapidOCR (PP-OCRv5) y Tesseract sobre el set y reporte, por ticket, si el total, la fecha y el RFC salieron correctos.
- [ ] Medir en el CAX11 (arm64): RAM en reposo y en carga, y segundos por imagen y por página.
- [ ] Decidir: confirmar RapidOCR o cambiar a PaddleOCR nativo. Anotar los resultados en este documento.

### Fase 1: servicio `ocr`

- [ ] `services/ocr/`: Python 3.12 + FastAPI + `rapidocr` (ONNX Runtime) + `opencv-python-headless` + `pypdfium2` + `zxing-cpp`. Modelos PP-OCRv5 descargados dentro de la imagen, sin descargas al arrancar.
- [ ] Endpoints:
  - `POST /v1/image`: líneas con texto, caja y confianza, más los QR detectados.
  - `POST /v1/pdf`: OCR por página.
  - `GET /health`.
- [ ] Autenticación con un token compartido (`OCR_SERVICE_TOKEN`). Sin puerto público. Límite de tamaño de archivo y de páginas.
- [ ] `Dockerfile` multi-arch (arm64 en producción y local en Mac). Agregar el servicio a `docker-compose.yml`.
- [ ] CI: build y smoke test de la imagen, push a GHCR con los tags `latest` y `testing`, siguiendo `deploy-api.yml`.
- [ ] Dokploy: una app `ocr` por ambiente, en la red interna del proyecto, con límites de memoria y CPU. Documentar en `docs/deployment.md` con su rollback.
- [ ] API: `OcrClient` en `src/modules/ocr/`, con `OCR_SERVICE_URL`, timeout, reintentos y un error tipado cuando el servicio no está disponible (en ese caso se pasa al respaldo de IA o el proceso falla con un mensaje claro).

### Fase 2: estados de cuenta

- [ ] Registry: si el parser local no cuadra según `checkStatement`, intentar con la IA (si `statement_parsing` está habilitada) y quedarse con el resultado que cuadre o, si ninguno cuadra, con el de menor diferencia. Pruebas unitarias.
- [ ] Detectar PDFs escaneados (poco texto por página) → `OcrClient.pdf` → parsers locales. Guardar el parser como `banamex_v1+ocr` para saber qué ruta se usó.
- [ ] Mostrar en la revisión (web y móvil) por qué ruta se extrajo y la diferencia de saldo.
- [ ] (Cuando llegue el segundo banco) Extraer el texto con coordenadas y crear perfiles declarativos por banco. Migrar `banamex_v1` al formato de perfil sin cambiar su salida (las pruebas actuales deben seguir pasando).

### Fase 3: tickets en la API

- [ ] Migración: tabla `receipt_imports` (usuario, cuenta sugerida, `file_key`, estado, campos extraídos, confianza, ruta usada, `transaction_id` al confirmar), con su script de rollback en `packages/database/scripts/rollbacks/`, envuelta en `BEGIN; … COMMIT;`.
- [ ] Migración: tabla `merchant_tax_ids` (RFC → nombre → categoría sugerida, por usuario y global).
- [ ] Nuevo `AiFeatureKey.receipt_parsing` (deshabilitado por defecto) en la configuración de funciones de IA del panel de admin.
- [ ] Módulo `src/modules/receipts/`:
  - `POST /receipts`: multipart; JPEG, PNG, WEBP o HEIC validados con `detectFileType`, máximo 10 MB, deduplicado por hash. Guardado en S3 bajo `users/<userId>/receipts/<id>.<ext>`.
  - Procesamiento asíncrono, igual que los estados de cuenta: QR → OCR → reglas → IA de respaldo.
  - GraphQL: `receiptImport` y `receiptImports` (paginación por cursor), `updateReceiptImport`, `confirmReceiptImport` (crea la transacción o adjunta la foto a un movimiento existente), `discardReceiptImport`.
  - `GET /receipts/:id/file`, que verifica el dueño en la base, como `sendFile`.
- [ ] Reglas de extracción (`receipt-rules.ts`) con pruebas unitarias sobre los textos de OCR del set de la fase 0 (anonimizados).
- [ ] Parser del QR del CFDI (`re`, `rr`, `tt`, `id`, `fe`) con pruebas.
- [ ] Buscar movimientos existentes al confirmar (monto y fecha ±3 días en la misma cuenta), para no duplicar.
- [ ] Actualizar `docs/features.md`, `docs/prd.md`, `schema.gql` y la colección de Postman.

### Fase 4: clientes

- [ ] Web: subir la foto (arrastrar o elegir archivo), estado del procesamiento y pantalla de revisión con la imagen al lado.
- [ ] Móvil: capturar con `expo-image-picker` (cámara o galería), comprimir la imagen antes de subirla, y la misma pantalla de revisión. Requiere conectar el móvil a la API real.
- [ ] Lista de tickets pendientes de revisar.

### Fase 5 (opcional): OCR en el celular

- [ ] Evaluar `expo-mlkit-ocr` (ML Kit v2) en un dev build con el SDK 56, para obtener una vista previa instantánea sin conexión. El texto del dispositivo se envía junto con la foto y el servidor sigue siendo la fuente de verdad.

## Riesgos

- **Memoria en el CAX11:** el servidor es compartido. Hay que medirlo en la fase 0 y fijar límites en Dokploy. Si no alcanza, se puede mover el servicio `ocr` a otro servidor sin cambiar la API (solo cambia `OCR_SERVICE_URL`).
- **Calidad de las fotos:** papel térmico desteñido, arrugas y mala luz. La app debe guiar la captura (encuadre, luz) y el usuario siempre confirma.
- **Privacidad:** las fotos de tickets pueden incluir los últimos dígitos de la tarjeta y el RFC del usuario. Se guardan en el bucket privado como el resto de los archivos, y a la IA solo se envía texto, solo si la función está habilitada.
- **Duplicados:** un gasto puede llegar por ticket, por Syncfy y por estado de cuenta. La búsqueda al confirmar y la conciliación existente deben cubrir los tres caminos.

## Fuentes

- [Benchmark de OCR en recibos (2026)](https://imagetotable.ai/references/receipt-ocr-benchmark-results) y [Tesseract vs PaddleOCR en recibos](https://imagetotable.ai/references/tesseract-vs-paddleocr-receipt-benchmark). Publicados por un proveedor; solo recibos en inglés e indonesio.
- [PP-OCRv5 multilingüe (PaddleOCR)](https://www.paddleocr.ai/latest/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html) · [paddleocr en PyPI](https://pypi.org/project/paddleocr/)
- [RapidOCRSharpOnnx (comparación de tiempos en CPU)](https://www.nuget.org/packages/rapidocrsharponnx) · [OnnxOCR (ARM y x86)](https://github.com/elecmonkey/OnnxOCR) · [Modelos PP-OCRv5 en ONNX](https://interfaze.ai/models/monktpaddleocr-onnx)
- [Mejores modelos de OCR: precisión, velocidad y costo](https://reducto.ai/guides/best-ocr-models-accuracy-speed-cost) · [OCR open source para facturas](https://invoicedataextraction.com/blog/open-source-ocr-invoice-extraction)
- [expo-mlkit-ocr](https://awesome.ecosyste.ms/projects/github.com%2Frbayuokt%2Fexpo-mlkit-ocr) · [@bear-block/vision-camera-ocr](https://www.jsdelivr.com/package/npm/@bear-block/vision-camera-ocr) · [natscan](https://cdn.jsdelivr.net/npm/natscan@1.1.2/README.md)
- [Parsers de estados de cuenta con pdfplumber y Camelot](https://awesome.ecosyste.ms/projects/github.com%2Fibnu-umer%2Ffinance-parser) · [Parser de estados de cuenta HDFC](https://dev.to/vishwaraja_pathivishwa/building-a-pdf-parser-for-hdfc-bank-statements-from-165-pages-to-csv-in-minutes-34c6)
- [Código QR en CFDI impresos](https://contadormx.com/que-es-el-codigo-de-barras-bidimensional-en-los-cfdi-impresos-y-donde-se-generan/) · [QR code for CFDI (CryptoSys)](https://cryptosys.net/firmasat/qrcode-for-cfdi.html)
- [Banamex CFDI](https://www.banamex.com/cfdi/index.html) · [BancaNet: estados de cuenta y movimientos](https://www.banamex.com/resources/bancanets/bne/esp/contenedor/Estados-de-cuenta-y-Movimientos.htm)
