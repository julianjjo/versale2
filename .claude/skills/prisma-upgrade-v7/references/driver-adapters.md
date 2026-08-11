# Driver Adapters

Prisma v7 requires driver adapters for SQL database connections. This is the standard SQL execution path in current Prisma releases.

MongoDB should not follow this path. There is no published MongoDB `@prisma/adapter-*` package, and MongoDB projects should remain on the latest Prisma 6.x release instead of trying to fit into the Prisma 7 SQL adapter model.

## Why Driver Adapters?

- No native engine binary in the Prisma Client SQL path
- Smaller bundle size
- Better serverless/edge compatibility
- Uses native Node.js database drivers
- More control over connection pooling

## Available Adapters

| Database | Adapter Package | Underlying Driver |
|----------|-----------------|-------------------|
| PostgreSQL | `@prisma/adapter-pg` | `pg` |
| MySQL / MariaDB | `@prisma/adapter-mariadb` | `mariadb` |
| SQLite | `@prisma/adapter-better-sqlite3` | `better-sqlite3` |
| Prisma Postgres (Node.js) | `@prisma/adapter-pg` | `pg` |
| Prisma Postgres (edge/serverless) | `@prisma/adapter-ppg` | `@prisma/ppg` |
| SQL Server | `@prisma/adapter-mssql` | `mssql` |
| Neon | `@prisma/adapter-neon` | `@neondatabase/serverless` |
| PlanetScale | `@prisma/adapter-planetscale` | `@planetscale/database` |
| Turso/libSQL | `@prisma/adapter-libsql` | `@libsql/client` |
| D1 (Cloudflare) | `@prisma/adapter-d1` | Cloudflare D1 |

## Installation

### PostgreSQL

```bash
npm install @prisma/adapter-pg
```

### MySQL

```bash
npm install @prisma/adapter-mariadb mariadb
```

### SQLite

```bash
npm install @prisma/adapter-better-sqlite3
```

### Prisma Postgres

```bash
npm install @prisma/adapter-pg pg
```

### SQL Server

```bash
npm install @prisma/adapter-mssql mssql
```

## Configuration

### PostgreSQL

```typescript
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
})

const prisma = new PrismaClient({ adapter })
```

### MySQL

```typescript
import { PrismaClient } from '../generated/prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const adapter = new PrismaMariaDb({
  host: 'localhost',
  port: 3306,
  connectionLimit: 5,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
})

const prisma = new PrismaClient({ adapter })
```

### SQLite

```typescript
import { PrismaClient } from '../generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db'
})

const prisma = new PrismaClient({ adapter })
```

### Neon (Serverless PostgreSQL)

```typescript
import { PrismaClient } from '../generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL
})

const prisma = new PrismaClient({ adapter })
```

### Prisma Postgres (direct TCP)

`PrismaPg` needs a direct `postgres://`/`postgresql://` connection string — `prisma://` and `prisma+postgres://` Accelerate URLs are not valid here (use `accelerateUrl` with `withAccelerate` for those instead; see `references/accelerate-users.md`):

```typescript
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL, // e.g. postgres://user:pass@host:5432/db
})

const prisma = new PrismaClient({ adapter })
```

### Prisma Postgres serverless driver

`@prisma/adapter-ppg` is Early Access and not recommended for production:

```typescript
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPostgresAdapter } from '@prisma/adapter-ppg'

const prisma = new PrismaClient({
  adapter: new PrismaPostgresAdapter({
    connectionString: process.env.PRISMA_DIRECT_TCP_URL,
  }),
})
```

### SQL Server

```typescript
import { PrismaClient } from '../generated/prisma/client'
import { PrismaMssql } from '@prisma/adapter-mssql'

const adapter = new PrismaMssql({
  server: 'localhost',
  port: 1433,
  database: 'mydb',
  user: process.env.SQLSERVER_USER,
  password: process.env.SQLSERVER_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
})

const prisma = new PrismaClient({ adapter })
```

`trustServerCertificate: true` skips certificate validation entirely. Only enable it for a local-development database, never in production:

```typescript
// Local development ONLY — never enable this in production.
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
```

## Connection Pool Configuration

Driver adapters use the underlying driver's pool settings, which differ from v6 defaults.

### PostgreSQL with custom pool

```typescript
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  // Pool configuration
  max: 10,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Connection timeout (v6 default was 5s)
})
```

### Matching v6 behavior

```typescript
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,  // v6 used 5 second timeout
})
```

## SSL Configuration

### Accept self-signed certificates (local development only)

Local development ONLY — never use `rejectUnauthorized: false` in production. It disables certificate validation entirely and leaves the connection open to man-in-the-middle attacks.

```typescript
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false  // Accept self-signed certs — local dev only, do not use in production
  }
})
```

### Proper SSL configuration

```typescript
import { readFileSync } from 'fs'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: readFileSync('/path/to/ca-cert.pem'),
    rejectUnauthorized: true
  }
})
```

## Migration from v6

### Before (v6)

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL }
  }
})
```

### After (v7)

```typescript
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
})

const prisma = new PrismaClient({ adapter })
```

## Singleton Pattern

```typescript
// lib/prisma.ts
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!
})

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```
