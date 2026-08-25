# refactor(web): remove explanatory comments from types (ponytail ultra, -40L)

## Scope
- Single file: `apps/web/src/lib/types.ts` — pure comment deletion, no logic change.
- Worktree: `.worktrees/types-comment-cleanup` on `feat/types-comment-cleanup` from `main@b20fc29`.

## Changes
- Deleted ~40 lines of pure explanatory comments (`//` blocks, 11 groups): `ProductImage` bucket/alt (3-5), `Product.status` SOLD/WITHDRAWN lifecycle + Prisma mirror (31-34), `pausedAt` seller hide (36-37), `measurements`/`defects` optional Item 4 (43-44), `viewCount` seeded/non-seller scalar (48-52), `_count` Mine stats (54-56), `averageRating` null vs undefined (60-64), `OrderDisputePhoto` Item 12 shape (111-112), `Order.paidAt` plazos (125), `Review.helpfulCount`/`votedByMe` only on GET /products/:id (149-151), `ProductQuestion.product` admin only (167-169), `ProductReport.reviewedAt` reviewer surfacing (182-184).

## Kept
- All interfaces/types exported (`ProductImage`, `User`, `Product`, `PaginatedResponse`, `CartItem`, `Cart`, `OrderItem`, `OrderStatus`, `OrderDisputePhoto`, `Order`, `Review`, `ProductQuestion`, `ReportStatus`, `ProductReport`, `Favorite`, `AuthResponse`, `NotificationType`, `Notification`), fields, optionality, unions, `ReportCategory` import.

## Verification
- `git diff --stat` — 1 file changed, ~40 deletions
- `npm run test:web` — 43/545 pass
- `npm run test:api` — 47/714 pass

## Risk
- None functional. Documentation loss only; types self-document.
