-- Item 4: images migrates to [{ url, alt }] (max 6, R2-only — enforced by the
-- DTO), plus seller-curated `measurements` and `defects` text columns.

-- Backfill: rewrite legacy string-array rows to [{ url, alt: "" }] objects.
-- An empty alt is honest (the data never existed) and the seller-facing edit
-- flow requires one going forward. Rows already storing objects are left
-- untouched; the guard keys off any string element being present.
UPDATE "Product"
SET "images" = (
    SELECT json_group_array(json_object('url', je.value, 'alt', ''))
    FROM json_each("Product"."images") je
)
WHERE "images" IS NOT NULL
  AND json_type("Product"."images") = 'array'
  AND EXISTS (
      SELECT 1 FROM json_each("Product"."images") je2
      WHERE json_type(je2.value) = 'text'
  );

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "measurements" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "defects" TEXT;
