-- CreateIndex
CREATE INDEX "Product_isApproved_status_pausedAt_category_idx" ON "Product"("isApproved", "status", "pausedAt", "category");

-- CreateIndex
CREATE INDEX "Product_isApproved_status_pausedAt_size_idx" ON "Product"("isApproved", "status", "pausedAt", "size");

-- CreateIndex
CREATE INDEX "Product_isApproved_status_pausedAt_condition_idx" ON "Product"("isApproved", "status", "pausedAt", "condition");
