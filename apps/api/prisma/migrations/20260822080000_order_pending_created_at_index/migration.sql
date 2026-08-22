-- autoCancelStalePendingOrders' hourly sweep filters PENDING orders by
-- createdAt, same shape as the two existing deadline-sweep indexes.

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
