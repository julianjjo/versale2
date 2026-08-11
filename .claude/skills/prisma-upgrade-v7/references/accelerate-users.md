# Prisma Accelerate Users

Special migration instructions for users of Prisma Accelerate or Prisma Postgres with `prisma://` or `prisma+postgres://` URLs.

## Important

**Do NOT pass Accelerate URLs to driver adapters.**

Driver adapters (like `PrismaPg`) expect direct database connection strings. They will fail with `prisma://` or `prisma+postgres://` URLs.

## Correct v7 Setup for Accelerate

### 1. Keep your Accelerate URL

```env
# .env
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=..."
# or
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/..."
```

### 2. Install Accelerate extension

```bash
npm install @prisma/extension-accelerate
```

### 3. Configure prisma.config.ts

```typescript
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),  // Accelerate URL works here
  },
})
```

### 4. Instantiate client with accelerateUrl

```typescript
import { PrismaClient } from '../generated/prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

// Use accelerateUrl instead of adapter
export const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,
}).$extends(withAccelerate())
```

## What NOT to Do

```typescript
// ❌ WRONG - Don't use adapter with Accelerate URL
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL  // This will fail — both prisma:// and prisma+postgres:// are invalid for PrismaPg
})
```

## Migrations with Accelerate

For migrations, you need a direct database connection:

### `prisma://` URLs require a direct URL for migrations

`prisma://` Accelerate URLs do **not** support `prisma migrate` or introspection commands. Set `DIRECT_DATABASE_URL` to a direct, non-Accelerate connection string and point `prisma.config.ts` at it for those CLI operations, as shown below.

`prisma+postgres://` URLs (Prisma Postgres's own Accelerate-like scheme) behave differently — see [Prisma Postgres (Cloud)](#prisma-postgres-cloud) below.

### Use a direct URL for migrations

```env
DATABASE_URL="prisma+postgres://..."  # For app
DIRECT_DATABASE_URL="postgresql://..."  # For migrations
```

```typescript
// prisma.config.ts
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  datasource: {
    url: env('DIRECT_DATABASE_URL'),  // Direct URL for CLI
  },
})
```

## Prisma Postgres (Cloud)

If using Prisma Postgres cloud database:

### Same approach

```typescript
import { PrismaClient } from '../generated/prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

export const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL,  // prisma+postgres:// URL
}).$extends(withAccelerate())
```

## Switching Away from Accelerate

If you later switch to direct TCP connection:

```typescript
// Change from accelerateUrl to adapter
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL  // Direct postgres:// URL
})

export const prisma = new PrismaClient({ adapter })
```

## Caching with Accelerate

The extension enables caching:

```typescript
const users = await prisma.user.findMany({
  cacheStrategy: {
    ttl: 60,  // Cache for 60 seconds
    swr: 120, // Stale-while-revalidate for 120 seconds
  },
})
```

## Edge Runtime

Accelerate works great in edge runtimes, but the generated client must target that runtime. Set a platform-specific `runtime` value in the generator block and regenerate before importing the client at the edge:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
  runtime  = "workerd"      // Cloudflare Workers
  // runtime = "vercel-edge" // Vercel Edge
}
```

```typescript
// Works in Vercel Edge, Cloudflare Workers, etc. — after regenerating with the runtime above.
import { PrismaClient } from '../generated/prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

// Accept the URL as a parameter instead of reading process.env directly —
// on Cloudflare Workers, env vars come from the binding passed into the
// fetch handler (env.DATABASE_URL), not process.env, without nodejs_compat.
export function createPrismaClient(databaseUrl: string) {
  return new PrismaClient({
    accelerateUrl: databaseUrl,
  }).$extends(withAccelerate())
}

// Cloudflare Workers handler:
export default {
  async fetch(request: Request, env: { DATABASE_URL: string }) {
    const prisma = createPrismaClient(env.DATABASE_URL)
    // ...
  },
}
```
