-- CreateEnum
CREATE TYPE "WhatsAppStatus" AS ENUM ('CONECTADO', 'DESCONECTADO', 'ERRO');

-- CreateEnum
CREATE TYPE "WhatsAppMsgTipo" AS ENUM ('ALERTA', 'RESUMO_DIARIO', 'PEDIDO_IFOOD');

-- CreateEnum
CREATE TYPE "WhatsAppMsgStatus" AS ENUM ('ENVIADO', 'FALHOU');

-- CreateTable
CREATE TABLE "WhatsAppIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,
    "numeroConectado" TEXT,
    "status" "WhatsAppStatus" NOT NULL,
    "ultimaConexao" TIMESTAMP(3),
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "WhatsAppIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "WhatsAppMsgTipo" NOT NULL,
    "destinatario" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "status" "WhatsAppMsgStatus" NOT NULL,
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppIntegration_tenantId_key" ON "WhatsAppIntegration"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsAppIntegration_tenantId_idx" ON "WhatsAppIntegration"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsAppLog_tenantId_idx" ON "WhatsAppLog"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsAppLog_tenantId_createdAt_idx" ON "WhatsAppLog"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppIntegration" ADD CONSTRAINT "WhatsAppIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppLog" ADD CONSTRAINT "WhatsAppLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "WhatsAppIntegration"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
