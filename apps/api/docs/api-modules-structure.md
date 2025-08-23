# Estructura de Módulos de la API

## Descripción General

La API de Finnit Assistant está organizada en módulos siguiendo los principios de NestJS. Cada módulo representa una funcionalidad específica del sistema financiero y contiene sus propios resolvers, servicios y DTOs.

## Arquitectura de Módulos

### Estructura Base de un Módulo

```
modules/
└── [module-name]/
    ├── dto/                    # Data Transfer Objects
    │   ├── [entity].dto.ts     # Tipos GraphQL para la entidad
    │   └── [entity]-input.dto.ts # Tipos de entrada
    ├── [module-name].resolver.ts # Resolvers GraphQL
    ├── [module-name].service.ts  # Lógica de negocio
    └── [module-name].module.ts   # Configuración del módulo
```

## Módulos Implementados

### 🔐 Auth Module (`auth/`)

**Responsabilidad**: Autenticación y autorización de usuarios

**Funcionalidades**:

- Registro de usuarios
- Inicio de sesión
- Renovación de tokens
- Recuperación de contraseña
- Validación de tokens

**Archivos principales**:

- `auth.resolver.ts` - Resolvers de autenticación
- `auth.service.ts` - Lógica de autenticación
- `jwt.strategy.ts` - Estrategia JWT
- `local.strategy.ts` - Estrategia local

### 👥 Users Module (`users/`)

**Responsabilidad**: Gestión de perfiles de usuario

**Funcionalidades**:

- Consulta de información de usuario
- Actualización de perfil
- Gestión de preferencias

### 💰 Accounts Module (`accounts/`)

**Responsabilidad**: Gestión de cuentas financieras

**Funcionalidades**:

- Crear cuentas (efectivo, crédito, débito, etc.)
- Consultar saldos
- Ajustar balances
- Archivar cuentas
- Paginación de cuentas

**Tipos principales**:

- `Account` - Tipo de cuenta
- `AccountType` - Enum de tipos de cuenta
- `CreateAccountInput` - Entrada para crear cuenta
- `UpdateAccountInput` - Entrada para actualizar cuenta

### 💳 Transactions Module (`transactions/`)

**Responsabilidad**: Gestión de transacciones financieras

**Funcionalidades**:

- Crear transacciones
- Consultar historial
- Filtrar por categoría, cuenta, fecha
- Búsqueda por descripción
- Paginación avanzada

**Tipos principales**:

- `Transaction` - Tipo de transacción
- `TransactionType` - Enum de tipos (ingreso, gasto, transferencia)
- `TransactionSource` - Enum de fuentes (manual, importado, OCR)
- `TransactionFilters` - Filtros de búsqueda

### 📂 Categories Module (`categories/`)

**Responsabilidad**: Gestión de categorías de gastos

**Funcionalidades**:

- Crear categorías jerárquicas
- Categorías por defecto
- Ordenamiento personalizado
- Sugerencias automáticas por comercio

**Tipos principales**:

- `Category` - Tipo de categoría
- `CreateCategoryInput` - Entrada para crear categoría
- `UpdateCategoryInput` - Entrada para actualizar categoría

### 📊 Budgets Module (`budgets/`)

**Responsabilidad**: Gestión de presupuestos mensuales

**Funcionalidades**:

- Crear presupuestos por categoría
- Alertas de presupuesto
- Resúmenes de uso
- Plantillas de presupuesto

**Tipos principales**:

- `Budget` - Tipo de presupuesto
- `BudgetCategory` - Categoría dentro del presupuesto
- `BudgetSummary` - Resumen de uso
- `BudgetAlert` - Alertas de presupuesto

### 🎯 Goals Module (`goals/`)

**Responsabilidad**: Gestión de metas financieras

**Funcionalidades**:

- Crear metas de ahorro
- Seguimiento de progreso
- Cálculo de fechas de cumplimiento
- Metas con fechas límite

**Tipos principales**:

- `Goal` - Tipo de meta
- `GoalProgress` - Progreso de la meta
- `CreateGoalInput` - Entrada para crear meta

### 💸 Debts Module (`debts/`)

**Responsabilidad**: Gestión de deudas y préstamos

**Funcionalidades**:

- Registrar deudas (tarjetas, préstamos)
- Seguimiento de pagos
- Proyecciones de pago
- Estrategias de pago (avalancha, bola de nieve)

**Tipos principales**:

- `Debt` - Tipo de deuda
- `DebtKind` - Enum de tipos de deuda
- `DebtPayment` - Pago de deuda
- `DebtPayoffProjection` - Proyección de pago

### 🔔 Notifications Module (`notifications/`)

**Responsabilidad**: Sistema de notificaciones

**Funcionalidades**:

- Notificaciones automáticas
- Programación de recordatorios
- Estados de lectura
- Diferentes tipos de notificación

**Tipos principales**:

- `Notification` - Tipo de notificación
- `NotificationType` - Enum de tipos
- `NotificationStatus` - Enum de estados

### 📈 Reports Module (`reports/`)

**Responsabilidad**: Reportes y análisis financieros

**Funcionalidades**:

- Reportes mensuales
- Análisis de gastos por categoría
- Proyecciones de flujo de caja
- Escenarios "what-if"

**Tipos principales**:

- `MonthlyReport` - Reporte mensual
- `CategoryUsage` - Uso por categoría
- `CashFlowProjection` - Proyección de flujo de caja
- `WhatIfResult` - Resultado de escenario

### 🔄 Transfers Module (`transfers/`)

**Responsabilidad**: Transferencias entre cuentas

**Funcionalidades**:

- Transferencias internas
- Seguimiento de transferencias
- Validación de cuentas

## Patrones de Diseño Implementados

### 1. **Repository Pattern**

- Separación entre lógica de negocio y acceso a datos
- Uso de Prisma como ORM
- Servicios encapsulan la lógica de negocio

### 2. **DTO Pattern**

- Transferencia de datos tipada
- Validación con class-validator
- Separación entre tipos de entrada y salida

### 3. **Guard Pattern**

- Protección de endpoints con JWT
- Autenticación centralizada
- Decoradores para obtener usuario actual

### 4. **Connection Pattern**

- Paginación consistente en todos los módulos
- Tipos `Connection`, `Edge`, `PageInfo` reutilizables
- Cursor-based pagination

## Configuración de Módulos

### Registro en AppModule

```typescript
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      playground: true,
      introspection: true,
      context: ({ req, res }) => ({ req, res }),
    }),
    AuthModule,
    UsersModule,
    AccountsModule,
    CategoriesModule,
    TransactionsModule,
    TransfersModule,
    BudgetsModule,
    GoalsModule,
    DebtsModule,
    NotificationsModule,
    ReportsModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
```

### Dependencias Compartidas

- **PrismaService**: Servicio de base de datos compartido
- **JwtAuthGuard**: Guard de autenticación
- **CurrentUser**: Decorador para obtener usuario actual
- **Pagination Types**: Tipos de paginación reutilizables

## Mejores Prácticas por Módulo

### 1. **Nomenclatura Consistente**

- Nombres de archivos en kebab-case
- Nombres de clases en PascalCase
- Nombres de métodos en camelCase

### 2. **Organización de DTOs**

- Separar tipos de entrada y salida
- Usar sufijos descriptivos (`Input`, `Connection`, `Edge`)
- Agrupar DTOs relacionados en el mismo archivo

### 3. **Validación**

- Usar decoradores de class-validator
- Validar en el nivel de DTO
- Proporcionar mensajes de error descriptivos

### 4. **Documentación**

- Documentar tipos con descripciones
- Usar JSDoc para métodos complejos
- Mantener ejemplos actualizados

### 5. **Testing**

- Tests unitarios para servicios
- Tests de integración para resolvers
- Mocks para dependencias externas

## Flujo de Datos Típico

```
Client Request
    ↓
GraphQL Resolver
    ↓
Service Layer (Business Logic)
    ↓
Prisma Service (Data Access)
    ↓
Database
    ↓
Response (DTO)
    ↓
GraphQL Schema
    ↓
Client Response
```

## Consideraciones de Rendimiento

### 1. **N+1 Queries**

- Usar DataLoader para resolver relaciones
- Implementar field resolvers eficientes
- Considerar eager loading cuando sea apropiado

### 2. **Paginación**

- Usar cursor-based pagination
- Limitar tamaños de página
- Implementar índices en la base de datos

### 3. **Caching**

- Cachear consultas frecuentes
- Invalidar cache en mutaciones
- Usar cache de Redis para datos compartidos

## Extensibilidad

### Agregar Nuevo Módulo

1. Crear estructura de carpetas
2. Definir DTOs con decoradores GraphQL
3. Implementar servicio con lógica de negocio
4. Crear resolver con queries/mutations
5. Registrar módulo en AppModule
6. Agregar tests unitarios e integración

### Modificar Módulo Existente

1. Actualizar DTOs según necesidades
2. Modificar servicio manteniendo compatibilidad
3. Agregar nuevos resolvers si es necesario
4. Actualizar documentación
5. Ejecutar tests para verificar cambios

## Recursos Adicionales

- [NestJS Modules Documentation](https://docs.nestjs.com/modules)
- [GraphQL Resolvers Best Practices](https://www.apollographql.com/docs/apollo-server/data/resolvers/)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
