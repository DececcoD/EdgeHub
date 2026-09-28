-- AlterTable
ALTER TABLE "bankrolls" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "bankrolls_userId_key" ON "bankrolls"("userId");
