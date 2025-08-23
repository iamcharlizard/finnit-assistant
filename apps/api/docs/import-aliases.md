# Alias de Importación

## Descripción General

Para mejorar la legibilidad y mantenibilidad del código, se han configurado alias de importación que reemplazan las rutas relativas largas con nombres más descriptivos y cortos.

## Alias Configurados

### 📁 **@models/**

**Ruta**: `src/common/types/models/*`

**Uso**: Para importar modelos GraphQL centralizados

```typescript
// ✅ CORRECTO - Usar alias
import { Account } from '@models/account.model';
import { Transaction } from '@models/transaction.model';
import { Category } from '@models/category.model';

// ❌ INCORRECTO - Ruta relativa larga
import { Account } from '../../../common/types/models/account.model';
```

### 📁 **@common/**

**Ruta**: `src/common/types/*`

**Uso**: Para importar tipos comunes como paginación

```typescript
// ✅ CORRECTO - Usar alias
import { Connection, Edge, PageInfo } from '@common/pagination.types';

// ❌ INCORRECTO - Ruta relativa larga
import {
  Connection,
  Edge,
  PageInfo,
} from '../../../common/types/pagination.types';
```

### 📁 **@modules/**

**Ruta**: `src/modules/*`

**Uso**: Para importar entre módulos (cuando sea necesario)

```typescript
// ✅ CORRECTO - Usar alias
import { AccountsService } from '@modules/accounts/accounts.service';

// ❌ INCORRECTO - Ruta relativa larga
import { AccountsService } from '../../accounts/accounts.service';
```

## Configuración en tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@models/*": ["src/common/types/models/*"],
      "@common/*": ["src/common/types/*"],
      "@modules/*": ["src/modules/*"]
    }
  }
}
```

## Ejemplos de Uso

### En DTOs

```typescript
// src/modules/accounts/dto/account.dto.ts
import { ObjectType, InputType, Field, ArgsType, Int } from '@nestjs/graphql';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Connection, Edge, PageInfo } from '@common/pagination.types';
import { AccountType } from '@finnit/database';
import { Account } from '@models/account.model';

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
```

### En Resolvers

```typescript
// src/modules/accounts/accounts.resolver.ts
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Account } from '@models/account.model';
import {
  CreateAccountInput,
  UpdateAccountInput,
  AccountConnection,
} from './dto/account.dto';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';

@Resolver(() => Account)
@UseGuards(JwtAuthGuard)
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

### En Servicios

```typescript
// src/modules/accounts/accounts.service.ts
import { Injectable } from '@nestjs/common';
import { Account } from '@models/account.model';
import { CreateAccountInput, UpdateAccountInput } from './dto/account.dto';
import { PrismaService } from '@modules/database/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateAccountInput): Promise<Account> {
    // implementación
  }

  async update(
    id: string,
    userId: string,
    input: UpdateAccountInput,
  ): Promise<Account> {
    // implementación
  }
}
```

## Ventajas de los Alias

### ✅ **Beneficios**

1. **Legibilidad**: Rutas más cortas y descriptivas
2. **Mantenibilidad**: Fácil cambiar rutas sin afectar múltiples archivos
3. **Consistencia**: Patrón uniforme en todo el proyecto
4. **Refactoring**: Menos propenso a errores al mover archivos
5. **IDE Support**: Mejor autocompletado y navegación

### 🔧 **Mantenimiento**

- **Agregar nuevo alias**: Actualizar `tsconfig.json`
- **Cambiar ruta**: Actualizar solo el alias, no todos los archivos
- **Mover archivos**: Los alias se mantienen válidos

## Migración de Código Existente

### Antes (Rutas Relativas)

```typescript
// ❌ ANTES - Rutas relativas largas
import { Account } from '../../../common/types/models/account.model';
import {
  Connection,
  Edge,
  PageInfo,
} from '../../../common/types/pagination.types';
import { AccountsService } from '../../accounts/accounts.service';
```

### Después (Alias)

```typescript
// ✅ DESPUÉS - Alias descriptivos
import { Account } from '@models/account.model';
import { Connection, Edge, PageInfo } from '@common/pagination.types';
import { AccountsService } from '@modules/accounts/accounts.service';
```

## Mejores Prácticas

### 1. **Nomenclatura de Alias**

- Usar prefijos descriptivos (`@models`, `@common`, `@modules`)
- Mantener consistencia en todo el proyecto
- Evitar nombres genéricos que puedan causar conflictos

### 2. **Organización**

- Agrupar imports por tipo: NestJS, alias, relativos
- Mantener orden alfabético dentro de cada grupo
- Usar imports específicos en lugar de wildcards

### 3. **Documentación**

- Documentar nuevos alias en este archivo
- Mantener ejemplos actualizados
- Incluir casos de uso específicos

## Troubleshooting

### Error: "Cannot find module"

- Verificar que el alias esté configurado en `tsconfig.json`
- Reiniciar el servidor de desarrollo
- Limpiar cache de TypeScript

### Error: "Module resolution failed"

- Verificar que la ruta base sea correcta
- Asegurar que los archivos existan en las rutas especificadas
- Verificar configuración de `baseUrl`

### Error: "Circular dependency"

- Usar imports específicos en lugar de wildcards
- Revisar dependencias circulares entre módulos
- Considerar usar interfaces en lugar de clases cuando sea posible

## Recursos Adicionales

- [TypeScript Path Mapping](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping)
- [NestJS Module Resolution](https://docs.nestjs.com/modules)
- [ESLint Import Rules](https://eslint.org/docs/rules/import)
