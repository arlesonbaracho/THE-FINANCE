-- Drop existing WhatsApp tables (CASCADE removes dependent FK constraints)
DROP TABLE IF EXISTS "WhatsAppLog" CASCADE;
DROP TABLE IF EXISTS "WhatsAppIntegration" CASCADE;

-- Drop old WhatsAppStatus enum (no longer used)
DROP TYPE IF EXISTS "WhatsAppStatus";

-- Replace WhatsAppMsgTipo enum with new values
DROP TYPE IF EXISTS "WhatsAppMsgTipo";
CREATE TYPE "WhatsAppMsgTipo" AS ENUM ('ALERTA_CRITICO', 'ALERTA_ALTO', 'ESTOQUE_BAIXO', 'RESUMO_DIARIO', 'LIMITE_IA', 'CONFIRMACAO_BOT', 'RESPOSTA_BOT', 'TESTE');

-- Replace WhatsAppMsgStatus enum (add PENDENTE)
DROP TYPE IF EXISTS "WhatsAppMsgStatus";
CREATE TYPE "WhatsAppMsgStatus" AS ENUM ('ENVIADO', 'FALHOU', 'PENDENTE');

-- CreateTable WhatsAppContato
CREATE TABLE "WhatsAppContato" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "permiteComandos" BOOLEAN NOT NULL DEFAULT false,
    "recebeAlertas" BOOLEAN NOT NULL DEFAULT true,
    "recebeResumoDiario" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppContato_pkey" PRIMARY KEY ("id")
);

-- CreateTable WhatsAppLog (no FK to WhatsAppIntegration, field renamed to conteudo)
CREATE TABLE "WhatsAppLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "WhatsAppMsgTipo" NOT NULL,
    "destinatario" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "status" "WhatsAppMsgStatus" NOT NULL,
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppContato_tenantId_numero_key" ON "WhatsAppContato"("tenantId", "numero");

-- CreateIndex
CREATE INDEX "WhatsAppContato_tenantId_idx" ON "WhatsAppContato"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsAppContato_numero_idx" ON "WhatsAppContato"("numero");

-- CreateIndex
CREATE INDEX "WhatsAppLog_tenantId_idx" ON "WhatsAppLog"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsAppLog_tenantId_createdAt_idx" ON "WhatsAppLog"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppContato" ADD CONSTRAINT "WhatsAppContato_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
