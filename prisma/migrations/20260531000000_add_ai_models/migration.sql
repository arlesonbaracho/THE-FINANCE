-- CreateEnum
CREATE TYPE "NfOrigem" AS ENUM ('UPLOAD_IMAGEM', 'UPLOAD_PDF', 'TEXTO');

-- CreateEnum
CREATE TYPE "NfStatus" AS ENUM ('PROCESSANDO', 'CONCLUIDA', 'ERRO');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "NfProcessada" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "origem" "NfOrigem" NOT NULL,
    "cloudinaryUrl" TEXT,
    "numeroNf" TEXT,
    "fornecedorNome" TEXT,
    "dataEmissao" TIMESTAMP(3),
    "valorTotal" DECIMAL(65,30),
    "status" "NfStatus" NOT NULL,
    "rawResponseIa" JSONB NOT NULL,
    "itensCriados" INTEGER NOT NULL DEFAULT 0,
    "processadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NfProcessada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokensUsados" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "custoEstimado" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "limiteTokens" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "tokensInput" INTEGER NOT NULL,
    "tokensOutput" INTEGER NOT NULL,
    "custoEstimado" DECIMAL(65,30) NOT NULL,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NfProcessada_tenantId_idx" ON "NfProcessada"("tenantId");

-- CreateIndex
CREATE INDEX "NfProcessada_tenantId_status_idx" ON "NfProcessada"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ChatMessage_tenantId_userId_idx" ON "ChatMessage"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsage_tenantId_key" ON "AiUsage"("tenantId");

-- CreateIndex
CREATE INDEX "AiUsageHistory_tenantId_idx" ON "AiUsageHistory"("tenantId");

-- AddForeignKey
ALTER TABLE "NfProcessada" ADD CONSTRAINT "NfProcessada_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageHistory" ADD CONSTRAINT "AiUsageHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
