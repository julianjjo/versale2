-- CreateIndex
CREATE INDEX "Product_isApproved_soldAt_price_idx" ON "Product"("isApproved", "soldAt", "price");
