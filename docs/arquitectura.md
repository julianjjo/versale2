# Arquitectura — Versale

Diagrama básico del monorepo (`main`, actualizado a `f3c1df9`).

```mermaid
graph TD
    subgraph Cliente
        B[Browser]
    end

    subgraph apps/web ["apps/web — Next.js (puerto 3000 / 3100 e2e)"]
        W[App Router: productos, cart, orders,<br/>favoritos, perfil, admin, auth pages]
        RQ[React Query]
        UI[Componentes: ui / layout / products /<br/>orders / marketing / admin]
    end

    subgraph apps/api ["apps/api — NestJS (puerto 3001 / 3101 e2e)"]
        AUTH[auth]
        USR[users]
        PROD[products]
        CART[cart]
        ORD[orders]
        REV[reviews]
        FAV[favorites]
        QST[questions]
        UPL[uploads]
        NTF[notifications<br/>Brevo service]
        REP[reports]
        P[Prisma ORM]
    end

    DB[(SQLite)]
    BREVO[Brevo API<br/>emails transaccionales]

    B --> W
    W --> RQ
    UI --> RQ
    RQ -->|REST /api| PROD & CART & ORD & FAV & QST & REV
    RQ -->|REST auth/JWT| AUTH & USR
    PROD & CART & ORD & FAV & QST & REV & AUTH & USR & UPL & REP & NTF --> P
    P --> DB
    NTF -->|Brevo SDK| BREVO

    subgraph e2e ["e2e — Playwright"]
        PW[Suites e2e]
    end
    PW -.->|webServer :3100 / :3101 + seed| W
```

## Resumen

- **`apps/web`**: Next.js + React Query. Copy en español. Puerto 3000 dev, 3100 e2e.
- **`apps/api`**: NestJS modular (auth, users, products, cart, orders, reviews, favorites,
  questions, uploads, reports, notifications) sobre Prisma con SQLite. Puerto 3001 dev, 3101 e2e.
- **`e2e`**: Playwright; levanta su propia API y Web (3101/3100) con SQLite dedicado en
  `apps/api/e2e.db` y seed propio.
- **Emails**: módulo `notifications` integra Brevo para emails transaccionales.

Verificación completa desde la raíz: `npm run test:api`, `npm run test:web`, `npm run e2e`.
