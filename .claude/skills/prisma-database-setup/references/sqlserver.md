# SQL Server Setup

Configure Prisma with Microsoft SQL Server.

## Prerequisites

- SQL Server 2017, 2019, 2022, or Azure SQL
- TCP/IP enabled

## 1. Schema Configuration

In `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlserver"
}

generator client {
  provider = "prisma-client"
  output   = "../generated"
}
```

## 2. Config Configuration

In `prisma.config.ts`:

```typescript
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
})
```

## 3. Environment Variable

In `.env` (local development / self-signed certificate only):

```env
DATABASE_URL="sqlserver://localhost:1433;database=mydb;user=sa;password=Password123;encrypt=true;trustServerCertificate=true"
```

### Connection String Format

```
sqlserver://HOST:PORT;database=DB;user=USER;password=PASS;encrypt=true;trustServerCertificate=false
```

- **encrypt**: Required for Azure (true).
- **trustServerCertificate**: Only set to `true` for local development against a self-signed certificate, as in the example above. Use `false` for production and any server with a certificate signed by a trusted CA.

## Driver Adapter

Use a driver adapter for the standard SQL workflow.

1. Install adapter and driver:
   ```bash
   npm install @prisma/adapter-mssql mssql
   ```

2. Instantiate Prisma Client with the adapter:
   ```typescript
   import 'dotenv/config'
   import { PrismaClient } from '../generated/client'
   import { PrismaMssql } from '@prisma/adapter-mssql'

   const adapter = new PrismaMssql({
     server: 'localhost',
     port: 1433,
     database: 'mydb',
     user: process.env.SQLSERVER_USER,
     password: process.env.SQLSERVER_PASSWORD,
     options: {
       encrypt: true,
       trustServerCertificate: true,
     },
   })

   const prisma = new PrismaClient({ adapter })
   ```

   This example reads `SQLSERVER_USER` and `SQLSERVER_PASSWORD` from the environment in addition to `DATABASE_URL`. Add them to your `.env`:
   ```env
   SQLSERVER_USER="sa"
   SQLSERVER_PASSWORD="Password123"
   ```

## Common Issues

### "Login failed for user"
- SQL Server auth vs Windows auth. Prisma typically uses SQL Server authentication (username/password).
- Ensure TCP/IP is enabled in SQL Server Configuration Manager.

### "Table not found" (dbo schema)
Prisma assumes the `dbo` schema by default. To use a different schema, add the `schema=<name>` parameter to your connection string. For multi-schema setups, list every schema in the `schemas` array of the `datasource` block and add `@@schema("...")` to each model that lives outside the default schema.
