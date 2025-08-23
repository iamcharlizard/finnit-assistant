# Documentación de la API

Esta carpeta contiene la documentación técnica de la API de Finnit Assistant.

## Índice de Documentación

### 📋 [Generación Automática del Schema de GraphQL](./graphql-schema-generation.md)

Explicación detallada de cómo se genera automáticamente el schema de GraphQL usando NestJS GraphQL, incluyendo:

- Configuración del módulo GraphQL
- Proceso de generación automática
- Ejemplos de definición de tipos
- Mejores prácticas
- Troubleshooting

### 🏗️ [Estructura de Módulos de la API](./api-modules-structure.md)

Documentación completa sobre la arquitectura modular de la API, incluyendo:

- Descripción de cada módulo implementado
- Patrones de diseño utilizados
- Estructura de archivos por módulo
- Mejores prácticas de desarrollo
- Consideraciones de rendimiento y extensibilidad

### 📋 [Organización de Tipos GraphQL](./types-organization.md)

Guía completa sobre la organización de tipos GraphQL, incluyendo:

- Estructura centralizada de modelos
- Separación de responsabilidades
- Patrones de importación y exportación
- Ejemplos de uso y mejores prácticas
- Guía de migración de código existente

### 🔗 [Alias de Importación](./import-aliases.md)

Documentación sobre los alias de importación configurados, incluyendo:

- Configuración de alias en TypeScript
- Ejemplos de uso en DTOs, resolvers y servicios
- Ventajas y mejores prácticas
- Guía de migración de rutas relativas
- Troubleshooting común

## Estructura de la API

```
src/
├── modules/           # Módulos de la aplicación
│   ├── accounts/      # Gestión de cuentas
│   ├── transactions/  # Gestión de transacciones
│   ├── categories/    # Gestión de categorías
│   ├── budgets/       # Gestión de presupuestos
│   ├── goals/         # Gestión de metas financieras
│   ├── debts/         # Gestión de deudas
│   ├── notifications/ # Sistema de notificaciones
│   ├── reports/       # Reportes y análisis
│   └── auth/          # Autenticación y autorización
├── common/            # Utilidades y tipos comunes
├── services/          # Servicios compartidos
└── schema.gql         # Schema GraphQL generado automáticamente
```

## Tecnologías Utilizadas

- **NestJS**: Framework de Node.js para aplicaciones escalables
- **GraphQL**: Lenguaje de consulta y manipulación de datos
- **Apollo Server**: Servidor GraphQL
- **Prisma**: ORM para base de datos
- **JWT**: Autenticación basada en tokens
- **Class Validator**: Validación de datos
- **TypeScript**: Tipado estático

## Scripts Disponibles

```bash
# Desarrollo
npm run start:dev          # Inicia el servidor en modo desarrollo
npm run playground         # Inicia con playground GraphQL

# Construcción
npm run build             # Construye la aplicación
npm run start:prod        # Inicia en modo producción

# Testing
npm run test              # Ejecuta tests unitarios
npm run test:e2e          # Ejecuta tests end-to-end

# Base de datos
npm run db:migrate        # Ejecuta migraciones
npm run db:generate       # Genera cliente Prisma
npm run db:studio         # Abre Prisma Studio
```

## Endpoints Principales

- **GraphQL Playground**: `http://localhost:3000/graphql`
- **Health Check**: `http://localhost:3000/health`
- **API Documentation**: `http://localhost:3000/docs`

## Configuración del Entorno

### Variables de Entorno Requeridas

```env
# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/finnit_db"

# JWT
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="7d"

# Servidor
PORT=3000
NODE_ENV=development
```

## Contribución

1. Lee la documentación específica de cada módulo
2. Sigue las mejores prácticas de NestJS y GraphQL
3. Mantén la consistencia en el nombramiento y estructura
4. Documenta cualquier cambio significativo
5. Ejecuta los tests antes de hacer commit

## Recursos Adicionales

- [NestJS Documentation](https://docs.nestjs.com/)
- [GraphQL Documentation](https://graphql.org/learn/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Apollo Server Documentation](https://www.apollographql.com/docs/apollo-server/)
