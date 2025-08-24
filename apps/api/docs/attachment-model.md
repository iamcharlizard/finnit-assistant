# 📎 Attachment Model

El modelo `Attachment` representa archivos adjuntos a transacciones financieras, como recibos, comprobantes, facturas, etc.

## 📋 Estructura del Modelo

### Attachment (ObjectType)

| Campo           | Tipo     | Requerido | Descripción                                             |
| --------------- | -------- | --------- | ------------------------------------------------------- |
| `id`            | `String` | ✅        | Identificador único del adjunto                         |
| `transactionId` | `String` | ✅        | ID de la transacción a la que pertenece                 |
| `fileUrl`       | `String` | ✅        | URL donde está almacenado el archivo                    |
| `fileType`      | `String` | ✅        | Tipo MIME del archivo (ej: image/jpeg, application/pdf) |
| `fileSize`      | `Number` | ❌        | Tamaño del archivo en bytes                             |
| `extra`         | `String` | ❌        | Metadatos adicionales en formato JSON                   |
| `uploadedAt`    | `Date`   | ✅        | Fecha y hora de subida del archivo                      |

### CreateAttachmentInput (InputType)

| Campo           | Tipo     | Requerido | Descripción                           |
| --------------- | -------- | --------- | ------------------------------------- |
| `transactionId` | `String` | ✅        | ID de la transacción                  |
| `fileUrl`       | `String` | ✅        | URL del archivo (debe ser URL válida) |
| `fileType`      | `String` | ✅        | Tipo MIME del archivo                 |
| `fileSize`      | `Number` | ❌        | Tamaño en bytes                       |
| `extra`         | `String` | ❌        | Metadatos JSON adicionales            |

### UpdateAttachmentInput (InputType)

| Campo      | Tipo     | Requerido | Descripción           |
| ---------- | -------- | --------- | --------------------- |
| `fileUrl`  | `String` | ❌        | Nueva URL del archivo |
| `fileType` | `String` | ❌        | Nuevo tipo MIME       |
| `fileSize` | `Number` | ❌        | Nuevo tamaño en bytes |
| `extra`    | `String` | ❌        | Nuevos metadatos JSON |

## 🔗 Relaciones

- **Transaction**: Un adjunto pertenece a una transacción (`transactionId`)

## 📝 Ejemplos de Uso

### Crear un adjunto

```graphql
mutation CreateAttachment($input: CreateAttachmentInput!) {
  createAttachment(input: $input) {
    id
    transactionId
    fileUrl
    fileType
    fileSize
    uploadedAt
  }
}
```

Variables:

```json
{
  "input": {
    "transactionId": "txn-123",
    "fileUrl": "https://storage.example.com/receipts/receipt-123.pdf",
    "fileType": "application/pdf",
    "fileSize": 245760,
    "extra": "{\"originalName\": \"receipt.pdf\", \"uploadedBy\": \"user-456\"}"
  }
}
```

### Consultar adjuntos de una transacción

```graphql
query GetTransaction($id: String!) {
  transaction(id: $id) {
    id
    description
    amount
    attachments {
      id
      fileUrl
      fileType
      fileSize
      uploadedAt
    }
  }
}
```

## 🎯 Casos de Uso

1. **Recibos de compras**: Adjuntar recibos de supermercado, gasolina, etc.
2. **Facturas**: Adjuntar facturas de servicios, renta, etc.
3. **Comprobantes bancarios**: Adjuntar comprobantes de transferencias
4. **Documentos de ingresos**: Adjuntar recibos de nómina, facturas de venta, etc.

## 🔒 Validaciones

- `fileUrl`: Debe ser una URL válida
- `fileType`: Debe ser un tipo MIME válido
- `fileSize`: Debe ser un número positivo
- `transactionId`: Debe referenciar una transacción existente

## 📊 Tipos de Archivo Soportados

- **Imágenes**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- **Documentos**: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **Hojas de cálculo**: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Texto**: `text/plain`, `text/csv`
