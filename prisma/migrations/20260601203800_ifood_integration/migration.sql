-- CreateEnum
CREATE TYPE "OrigemPedido" AS ENUM ('BALCAO', 'MESA', 'IFOOD');

-- CreateEnum
CREATE TYPE "IFoodStatus" AS ENUM ('CONECTADO', 'DESCONECTADO', 'ERRO');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PROCESSADO', 'FALHOU');

-- DropForeignKey
ALTER TABLE "Pedido" DROP CONSTRAINT "Pedido_garcomId_fkey";

-- DropForeignKey
ALTER TABLE "Pedido" DROP CONSTRAINT "Pedido_mesaId_fkey";

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "origem" "OrigemPedido" NOT NULL DEFAULT 'MESA',
ALTER COLUMN "mesaId" DROP NOT NULL,
ALTER COLUMN "garcomId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "IFoodIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretEncrypted" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" "IFoodStatus" NOT NULL,
    "ultimaSincronizacao" TIMESTAMP(3),

    CONSTRAINT "IFoodIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IFoodPedido" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "ifoodOrderId" TEXT NOT NULL,
    "ifoodReference" TEXT,
    "statusIfood" TEXT NOT NULL,
    "comissaoPercent" DECIMAL(65,30) NOT NULL,
    "enderecoEntrega" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IFoodPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IFoodWebhookLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ifoodOrderId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL,
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IFoodWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IFoodItemMap" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ifoodItemId" TEXT NOT NULL,
    "ifoodItemNome" TEXT NOT NULL,
    "produtoId" TEXT,

    CONSTRAINT "IFoodItemMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IFoodIntegration_tenantId_key" ON "IFoodIntegration"("tenantId");

-- CreateIndex
CREATE INDEX "IFoodIntegration_tenantId_idx" ON "IFoodIntegration"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "IFoodPedido_pedidoId_key" ON "IFoodPedido"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "IFoodPedido_ifoodOrderId_key" ON "IFoodPedido"("ifoodOrderId");

-- CreateIndex
CREATE INDEX "IFoodPedido_tenantId_idx" ON "IFoodPedido"("tenantId");

-- CreateIndex
CREATE INDEX "IFoodWebhookLog_tenantId_idx" ON "IFoodWebhookLog"("tenantId");

-- CreateIndex
CREATE INDEX "IFoodItemMap_tenantId_idx" ON "IFoodItemMap"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "IFoodItemMap_tenantId_ifoodItemId_key" ON "IFoodItemMap"("tenantId", "ifoodItemId");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_garcomId_fkey" FOREIGN KEY ("garcomId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IFoodIntegration" ADD CONSTRAINT "IFoodIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IFoodPedido" ADD CONSTRAINT "IFoodPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IFoodPedido" ADD CONSTRAINT "IFoodPedido_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "IFoodIntegration"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IFoodWebhookLog" ADD CONSTRAINT "IFoodWebhookLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "IFoodIntegration"("tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IFoodItemMap" ADD CONSTRAINT "IFoodItemMap_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IFoodItemMap" ADD CONSTRAINT "IFoodItemMap_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
