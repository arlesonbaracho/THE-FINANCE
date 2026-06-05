-- CreateEnum
CREATE TYPE "HealthLogTipo" AS ENUM ('API', 'JOB', 'WEBHOOK', 'DATABASE', 'REDIS', 'AI');

-- CreateEnum
CREATE TYPE "HealthLogStatus" AS ENUM ('OK', 'ALERTA', 'CRITICO');

-- CreateTable
CREATE TABLE "PlatformHealthLog" (
    "id" TEXT NOT NULL,
    "tipo" "HealthLogTipo" NOT NULL,
    "metrica" TEXT NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "status" "HealthLogStatus" NOT NULL,
    "detalhes" JSONB,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformHealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasMetricsSnapshot" (
    "id" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "mrr" DECIMAL(65,30) NOT NULL,
    "mrrPorPlano" JSONB NOT NULL,
    "churnRate" DECIMAL(65,30),
    "tenantCount" INTEGER NOT NULL,
    "tenantAtivos" INTEGER NOT NULL,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaasMetricsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "severidade" TEXT NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidoEm" TIMESTAMP(3),

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSettings" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformHealthLog_tipo_registradoEm_idx" ON "PlatformHealthLog"("tipo", "registradoEm");

-- CreateIndex
CREATE INDEX "PlatformHealthLog_registradoEm_idx" ON "PlatformHealthLog"("registradoEm");

-- CreateIndex
CREATE INDEX "SaasMetricsSnapshot_data_idx" ON "SaasMetricsSnapshot"("data");

-- CreateIndex
CREATE UNIQUE INDEX "SaasMetricsSnapshot_data_key" ON "SaasMetricsSnapshot"("data");

-- CreateIndex
CREATE INDEX "AdminNotification_resolvido_criadoEm_idx" ON "AdminNotification"("resolvido", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSettings_chave_key" ON "AdminSettings"("chave");
