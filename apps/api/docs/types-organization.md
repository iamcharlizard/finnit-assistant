# Organización de Tipos GraphQL

## Descripción General

La organización de tipos GraphQL en este proyecto sigue una estructura modular y centralizada que separa claramente las responsabilidades y mejora la mantenibilidad del código.

## Estructura de Carpetas

```
src/common/types/
├── models/                    # Modelos centralizados
│   ├── account.model.ts       # Modelo Account
│   ├── transaction.model.ts   # Modelo Transaction
│   ├── category.model.ts      # Modelo Category
│   ├── budget.model.ts        # Modelos de Budget
│   ├── goal.model.ts          # Modelos de Goal
│   ├── debt.model.ts          # Modelos de Debt
│   ├── notification.model.ts  # Modelo Notification
│   ├── user.model.ts          # Modelo User
│   ├── transfer.model.ts      # Modelo Transfer
│   ├── attachment.model.ts    # Modelo Attachment
│   ├── report.model.ts        # Modelos de Report
│   ├── auth.model.ts          # Modelos de Auth
│   └── index.ts               # Entry point de modelos
├── pagination.types.ts        # Tipos de paginación comunes
└── index.ts                   # Entry point principal
```

## Principios de Organización

### 1. **Separación de Responsabilidades**

- **Modelos (`models/`)**: Solo contienen tipos de objetos GraphQL (`@ObjectType()`)
- **Inputs**: Se mantienen en cada módulo específico (`modules/[module]/dto/`)
- **Args**: Se mantienen en cada módulo específico
- **Paginación**: Tipos comunes reutilizables

### 2. **Centralización de Modelos**

Todos los modelos de objetos se centralizan en `src/common/types/models/`:

```typescript
// ✅ CORRECTO - Modelo centralizado
// src/common/types/models/account.model.ts
@ObjectType()
export class Account {
  @Field()
  id: string;
  // ... más campos
}
```

### 3. **Inputs Específicos por Módulo**

Los tipos de entrada se mantienen en cada módulo:

```typescript
// ✅ CORRECTO - Input en el módulo
// src/modules/accounts/dto/account.dto.ts
@InputType()
export class CreateAccountInput {
  @Field()
  @IsString()
  name: string;
  // ... más campos
}
```

## Estructura de Archivos

### Modelos Centralizados (`models/`)

Cada modelo tiene su propio archivo:

```typescript
// account.model.ts
import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { AccountType } from '@finnit/database';

registerEnumType(AccountType, {
  name: 'AccountType',
  description: 'Account type',
});

@ObjectType()
export class Account {
  @Field()
  id: string;
  // ... campos del modelo
}
```

### Entry Point de Modelos (`models/index.ts`)

```typescript
// Exporta todos los modelos
export { Account } from './account.model';
export { Transaction } from './transaction.model';
export { Category } from './category.model';
// ... más exportaciones
```

### Entry Point Principal (`index.ts`)

```typescript
// Exporta modelos centralizados
export * from './models';

// Exporta tipos de paginación comunes
export { PageInfo, Connection, Edge, PaginationArgs } from './pagination.types';
```

## Ejemplo de Uso

### En un Resolver

```typescript
// src/modules/accounts/accounts.resolver.ts
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { Account } from '../../../common/types/models';
import {
  CreateAccountInput,
  UpdateAccountInput,
  AccountConnection,
} from './dto/account.dto';

@Resolver(() => Account)
export class AccountsResolver {
  @Query(() => AccountConnection)
  async accounts(): Promise<AccountConnection> {
    // implementación
  }

  @Mutation(() => Account)
  async createAccount(
    @Args('input') input: CreateAccountInput,
  ): Promise<Account> {
    // implementación
  }
}
```

### En un DTO de Módulo

```typescript
// src/modules/accounts/dto/account.dto.ts
import { ObjectType, InputType, Field, ArgsType } from '@nestjs/graphql';
import { Account } from '../../../common/types/models';
import {
  Connection,
  Edge,
  PageInfo,
} from '../../../common/types/pagination.types';

// Connection types específicos del módulo
@ObjectType()
export class AccountEdge implements Edge<Account> {
  @Field(() => Account)
  node: Account;
  @Field()
  cursor: string;
}

@ObjectType()
export class AccountConnection implements Connection<Account> {
  @Field(() => [AccountEdge])
  edges: AccountEdge[];
  @Field(() => PageInfo)
  pageInfo: PageInfo;
  @Field(() => Int)
  totalCount: number;
}

// Inputs específicos del módulo
@InputType()
export class CreateAccountInput {
  @Field()
  @IsString()
  name: string;
  // ... más campos
}
```

## Ventajas de esta Organización

### ✅ **Beneficios**

1. **Reutilización**: Los modelos se pueden usar en múltiples módulos
2. **Mantenibilidad**: Cambios en modelos se reflejan automáticamente
3. **Claridad**: Separación clara entre modelos e inputs
4. **Escalabilidad**: Fácil agregar nuevos modelos
5. **Consistencia**: Patrón uniforme en todo el proyecto

### 🔧 **Mantenimiento**

- **Agregar nuevo modelo**: Crear archivo en `models/` y exportar en `index.ts`
- **Modificar modelo**: Cambiar solo el archivo del modelo
- **Agregar input**: Crear en el DTO del módulo específico
- **Reutilizar modelo**: Importar desde `common/types/models`

## Migración de Código Existente

### Antes (Estructura Antigua)

```typescript
// ❌ ANTES - Todo mezclado en un archivo
@ObjectType()
export class Account {
  /* ... */
}

@InputType()
export class CreateAccountInput {
  /* ... */
}

@ArgsType()
export class AccountsArgs {
  /* ... */
}
```

### Después (Nueva Estructura)

```typescript
// ✅ DESPUÉS - Separado por responsabilidad

// Modelo centralizado
// src/common/types/models/account.model.ts
@ObjectType()
export class Account {
  /* ... */
}

// Inputs en el módulo
// src/modules/accounts/dto/account.dto.ts
@InputType()
export class CreateAccountInput {
  /* ... */
}

@ArgsType()
export class AccountsArgs {
  /* ... */
}
```

## Mejores Prácticas

### 1. **Nomenclatura**

- Modelos: `[Entity].model.ts`
- Inputs: `[Action][Entity]Input` (ej: `CreateAccountInput`)
- Args: `[Entity]Args` (ej: `AccountsArgs`)

### 2. **Importaciones**

- Modelos: `import { Account } from '../../../common/types/models'`
- Paginación: `import { Connection, Edge } from '../../../common/types/pagination.types'`

### 3. **Validaciones**

- Usar `class-validator` en todos los inputs
- Validar en el nivel de DTO, no en el modelo

### 4. **Documentación**

- Documentar tipos complejos con JSDoc
- Usar descripciones en decoradores `@Field()`

## Troubleshooting

### Error: "Cannot find module"

- Verificar que el modelo esté exportado en `models/index.ts`
- Verificar la ruta de importación

### Error: "Duplicate identifier"

- Asegurar que no haya duplicados en el archivo
- Verificar que el modelo no esté definido en múltiples lugares

### Error: "Circular dependency"

- Usar imports relativos correctos
- Evitar dependencias circulares entre modelos

## Recursos Adicionales

- [NestJS GraphQL Documentation](https://docs.nestjs.com/graphql/quick-start)
- [GraphQL Schema Design](https://graphql.org/learn/schema/)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
