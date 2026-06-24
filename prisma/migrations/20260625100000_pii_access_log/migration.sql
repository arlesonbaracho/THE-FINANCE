-- CreateEnum
CREATE TYPE "AcaoPii" AS ENUM ('CONSULTA', 'EXPORTACAO', 'EXCLUSAO');

-- CreateTable
CREATE TABLE "PiiAccessLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "acao" "AcaoPii" NOT NULL,
    "alvo" TEXT NOT NULL,
    "detalhe" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PiiAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PiiAccessLog_tenantId_idx" ON "PiiAccessLog"("tenantId");

-- CreateIndex
CREATE INDEX "PiiAccessLog_tenantId_createdAt_idx" ON "PiiAccessLog"("tenantId", "createdAt");
