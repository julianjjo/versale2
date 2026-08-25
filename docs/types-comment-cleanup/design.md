# types-comment-cleanup — Design

## Scope
- Single file: `apps/web/src/lib/types.ts` (219L → ~179L, Net -40L)
- Pure comment deletion, zero logic change. Work exclusively in worktree `.worktrees/types-comment-cleanup` on branch `feat/types-comment-cleanup` from `main@b20fc29`.
- Keep all interfaces exported, no ponytail ceiling needed — deletion only.

## Comments removed (~40L pure `//` blocks, 11 groups)
- `ProductImage` bucket alt — Item 4 bucket URLs + alt required, guard-free `.url/.alt` (3-5, 3L)
- `Product.status` stock lifecycle SOLD/WITHDRAWN semantics + Prisma enum mirror (31-34, 4L)
- `Product.pausedAt` seller hide independent of status/isApproved (36-37, 2L)
- `Product.measurements`/`defects` optional Item 4 free text, hide-when-empty (43-44, 2L)
- `Product.viewCount` seeded, non-seller views, ProductsService#findOne scalar (48-52, 5L)
- `Product._count` Mine stats: favoritedBy/questions alongside viewCount (54-56, 3L)
- `Product.averageRating` null vs undefined — null=no reviews, undefined=not computed (60-64, 4L)
- `OrderDisputePhoto` Item 12 dispute evidence same shape as ProductImage (111-112, 2L)
- `Order.paidAt` plazos disputa/reembolso Item 12 (125, 1L)
- `Review.helpfulCount`/`votedByMe` only on GET /products/:id, not admin/legacy queue (149-151, 3L)
- `ProductQuestion.product` only on admin GET /questions/admin/all, not embedded (167-169, 3L)
- `ProductReport.reviewedAt` reviewer surfacing, raw id not modeled (182-184, 3L)
- Additional blank/adjacent lines to reach ~40L net

## Kept intact
- All `export interface` / `export type`: `ProductImage`, `User`, `Product`, `PaginatedResponse`, `CartItem`, `Cart`, `OrderItem`, `OrderStatus`, `OrderDisputePhoto`, `Order`, `Review`, `ProductQuestion`, `ReportStatus`, `ProductReport`, `Favorite`, `AuthResponse`, `NotificationType`, `Notification`
- All fields, optionality (`?`), unions (`string | null`, `number | null`), imports (`ReportCategory`)
- No logic, no renames, no reorders

## Verification
- `git diff --stat` shows 1 file changed (`apps/web/src/lib/types.ts`), ~40 deletions, 0 additions except removed comment lines
- `npm run test:web` 43 suites / 545 tests pass
- `npm run test:api` 47 suites / 714 tests pass

## Risk
- None functional. Only documentation loss; types/names remain self-documenting (`ProductImage`, `ProductStatus` union, `pausedAt`, `viewCount`, `_count`, `averageRating`, `OrderDisputePhoto`, `helpfulCount`, `ProductQuestion.product`, `ProductReport.reviewedAt`).

## Ponytail ultra
- Deletion over addition. Comments duplicated what types/flow already express; explanatory prose is YAGNI for shared type lib. No abstraction, no new dep, no ceiling comment needed.
