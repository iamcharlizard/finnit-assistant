# Generación Automática del Schema de GraphQL

## Descripción General

El schema de GraphQL en este proyecto se genera **automáticamente** utilizando **NestJS GraphQL** con el decorador `@nestjs/graphql`. Este enfoque proporciona sincronización automática entre el código TypeScript y el schema GraphQL, eliminando la necesidad de mantener archivos de schema manualmente.

## Configuración Principal

### Módulo de GraphQL

En `src/modules/app.module.ts`, la configuración principal es:

```typescript
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: join(process.cwd(), 'schema.gql'),
  sortSchema: true,
  playground: true,
  introspection: true,
  context: ({ req, res }) => ({ req, res }),
}),
```

### Parámetros de Configuración

- **`autoSchemaFile`**: Ruta donde se genera el archivo `schema.gql`
- **`sortSchema`**: Ordena alfabéticamente los tipos en el schema generado
- **`playground`**: Habilita GraphQL Playground para desarrollo
- **`introspection`**: Permite consultas de introspección
- **`context`**: Define el contexto disponible en los resolvers

## Proceso de Generación

### 1. Escaneo de Decoradores

NestJS escanea automáticamente todos los archivos TypeScript en busca de:

- `@ObjectType()` - Define tipos de GraphQL
- `@InputType()` - Define tipos de entrada
- `@Resolver()` - Define resolvers
- `@Query()` - Define queries
- `@Mutation()` - Define mutations
- `@Field()` - Define campos de tipos
- `@ArgsType()` - Define tipos de argumentos

### 2. Análisis de Relaciones

El sistema analiza:

- Relaciones entre tipos
- Herencia de tipos
- Enums y escalares
- Validaciones con class-validator

### 3. Generación del Schema

Se genera automáticamente el archivo `schema.gql` que incluye:

- Definición completa de tipos
- Queries y mutations
- Enums y escalares
- Documentación inline

## Ejemplos de Definición de Tipos

### Tipo de Objeto

```typescript
@ObjectType()
export class Account {
  @Field()
  id: string;

  @Field(() => AccountType)
  type: AccountType;

  @Field()
  name: string;

  @Field()
  currency: string;

  @Field()
  balanceCurrent: number;

  @Field({ nullable: true })
  metadata?: string;
}
```

### Tipo de Entrada

```typescript
@InputType()
export class CreateAccountInput {
  @Field(() => AccountType)
  @IsEnum(AccountType)
  type: AccountType;

  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  currency: string;

  @Field()
  @IsNumber()
  initialBalance: number;
}
```

### Enum

```typescript
registerEnumType(AccountType, {
  name: 'AccountType',
  description: 'Account type',
});
```

### Resolver

```typescript
@Resolver(() => Account)
@UseGuards(JwtAuthGuard)
export class AccountsResolver {
  @Query(() => AccountConnection)
  async accounts(
    @CurrentUser() user: any,
    @Args() args: AccountsArgs,
  ): Promise<AccountConnection> {
    return this.accountsService.findMany(user.id, args);
  }

  @Mutation(() => Account)
  async createAccount(
    @CurrentUser() user: any,
    @Args('input') input: CreateAccountInput,
  ): Promise<Account> {
    return this.accountsService.create(user.id, input);
  }
}
```

## Cuándo se Regenera el Schema

El schema se regenera automáticamente cuando:

1. **Desarrollo**: `npm run start:dev`
2. **Compilación**: `npm run build`
3. **Playground**: `npm run playground`
4. **Cualquier cambio** en archivos con decoradores GraphQL

## Ventajas del Enfoque Automático

### ✅ Beneficios

- **Sincronización automática** entre TypeScript y GraphQL
- **Type safety** completo
- **Validación automática** con class-validator
- **Documentación automática** en el playground
- **Sin duplicación** de código
- **Refactoring seguro** - los cambios en TypeScript se reflejan automáticamente

### ⚠️ Consideraciones

- El archivo `schema.gql` **NO debe editarse manualmente**
- Los cambios deben hacerse en los DTOs TypeScript
- El schema se regenera completamente en cada cambio

## Estructura de Archivos

```
src/
├── modules/
│   ├── accounts/
│   │   ├── dto/
│   │   │   └── account.dto.ts      # Definición de tipos Account
│   │   ├── accounts.resolver.ts    # Resolvers para Account
│   │   └── accounts.module.ts      # Módulo de Account
│   ├── transactions/
│   │   ├── dto/
│   │   │   └── transaction.dto.ts  # Definición de tipos Transaction
│   │   ├── transactions.resolver.ts
│   │   └── transactions.module.ts
│   └── ...
├── common/
│   ├── types/
│   │   └── pagination.types.ts     # Tipos comunes (Connection, Edge, etc.)
│   └── ...
└── schema.gql                      # Schema generado automáticamente
```

## Scripts Disponibles

```json
{
  "scripts": {
    "start:dev": "nest start --watch", // Regenera schema en desarrollo
    "build": "nest build", // Regenera schema en build
    "playground": "nest start --watch --verbose",
    "schema:generate": "ts-node src/generate-schema.ts" // Script preparado (no implementado)
  }
}
```

## Troubleshooting

### Schema no se actualiza

1. Verifica que los decoradores estén correctamente importados
2. Asegúrate de que los módulos estén registrados en `app.module.ts`
3. Reinicia el servidor de desarrollo

### Errores de tipos

1. Verifica que los tipos TypeScript coincidan con los decoradores `@Field()`
2. Asegúrate de que los enums estén registrados con `registerEnumType()`
3. Revisa que las validaciones de class-validator sean compatibles

### Problemas de importación

1. Verifica las rutas de importación en los DTOs
2. Asegúrate de que los tipos comunes estén correctamente exportados
3. Revisa que no haya dependencias circulares

## Mejores Prácticas

1. **Usa decoradores consistentemente** en todos los DTOs
2. **Documenta los tipos** con descripciones en los decoradores
3. **Valida las entradas** con class-validator
4. **Mantén los tipos simples** y reutilizables
5. **Usa enums** para valores fijos
6. **Implementa paginación** usando los tipos Connection/Edge
7. **Protege las operaciones** con guards apropiados

## Recursos Adicionales

- [NestJS GraphQL Documentation](https://docs.nestjs.com/graphql/quick-start)
- [Apollo Server Documentation](https://www.apollographql.com/docs/apollo-server/)
- [GraphQL Schema Language](https://graphql.org/learn/schema/)
- [Class Validator Documentation](https://github.com/typestack/class-validator)
