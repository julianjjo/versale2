# Arquitectura — Versale

Diagrama del monorepo, verificado contra `main` (2026-08-27).

```mermaid
graph TD
    subgraph Cliente
        B[Browser]
    end

    subgraph web ["apps/web — Next.js (3000 dev / 3100 e2e)"]
        W[App Router: products, cart, orders, mis-productos,<br/>mis-ventas, favoritos, vendedores, profile,<br/>admin, auth pages, sitemap/robots]
        RQ[React Query]
        UI[Componentes: ui / layout / products /<br/>orders / marketing / admin]
    end

    subgraph api ["apps/api — NestJS (3001 dev / 3101 e2e)"]
        AUTH[auth]
        USR[users]
        PROD[products]
        CART[cart]
        ORD[orders]
        PAY[payments]
        REV[reviews]
        FAV[favorites]
        QST[questions]
        UPL[uploads]
        NTF[notifications<br/>brevo.service]
        REP[reports]
        CMN[common: pagination, query,<br/>prisma-error, csv, security-headers]
        P[Prisma ORM]
    end

    DB[(SQLite)]
    BREVO[Brevo API<br/>emails transaccionales]
    R2[Cloudflare R2<br/>via @aws-sdk/client-s3]
    MP[Mercado Pago]

    B --> W
    W --> RQ
    UI --> RQ
    RQ -->|REST /api| PROD & CART & ORD & PAY & FAV & QST & REV & REP & UPL
    RQ -->|REST auth/JWT| AUTH & USR
    PROD & CART & ORD & PAY & FAV & QST & REV & AUTH & USR & REP & NTF --> P
    PROD & ORD & FAV & QST & REV & REP & NTF --> CMN
    P --> DB
    NTF -->|Brevo SDK| BREVO
    UPL -->|PutObject| R2
    PAY -->|MP_ACCESS_TOKEN| MP

    subgraph e2eblk ["e2e — Playwright"]
        PW[Suites e2e]
    end
    PW -.->|webServer :3100 / :3101 + seed| W
```

## Resumen

- **`apps/web`**: Next.js + React Query. Copy en español. Puerto 3000 dev, 3100 e2e.
- **`apps/api`**: NestJS modular (`auth`, `users`, `products`, `cart`, `orders`, `payments`,
  `reviews`, `favorites`, `questions`, `uploads`, `reports`, `notifications`, más `common` y
  `prisma`) sobre Prisma con SQLite. Puerto 3001 dev, 3101 e2e.
- **`e2e`**: Playwright; levanta su propia API y Web (3101/3100) con SQLite dedicado en
  `apps/api/e2e.db` y seed propio.
- **Emails**: el módulo `notifications` integra Brevo para emails transaccionales; `auth`
  lo reutiliza para verificación de email y recuperación de contraseña.
- **Imágenes**: `uploads` escribe en Cloudflare R2 con el cliente S3 (`R2_*` en entorno).
- **Pagos**: `payments` habla con Mercado Pago cuando hay `MP_ACCESS_TOKEN`.

Verificación completa desde la raíz: `npm run test:api`, `npm run test:web`, `npm run e2e`.
