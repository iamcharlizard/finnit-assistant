/*
  Warnings:

  - A unique constraint covering the columns `[userId,name]` on the table `Account` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,name]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,name]` on the table `Debt` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,name]` on the table `Goal` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,accountId,txnDate]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[fromTxnId,toTxnId]` on the table `Transfer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_name_key" ON "public"."Account"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "public"."Category"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Debt_userId_name_key" ON "public"."Debt"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Goal_userId_name_key" ON "public"."Goal"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_userId_accountId_txnDate_key" ON "public"."Transaction"("userId", "accountId", "txnDate");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_fromTxnId_toTxnId_key" ON "public"."Transfer"("fromTxnId", "toTxnId");
