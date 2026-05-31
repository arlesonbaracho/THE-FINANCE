-- CreateEnum
CREATE TYPE "InventarioStatus" AS ENUM ('ABERTO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "CancellationStatus" AS ENUM ('PENDING', 'PROCESSED', 'REVERTED');

-- CreateEnum
CREATE TYPE "MesaStatus" AS ENUM ('LIVRE', 'OCUPADA', 'RESERVADA');

-- CreateEnum
CREATE TYPE "PedidoStatus" AS ENUM ('ABERTO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "PedidoItemStatus" AS ENUM ('PENDENTE', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'DEBITO', 'CREDITO', 'PIX');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('ESTOQUE', 'FINANCEIRO', 'OPERACIONAL', 'SISTEMA');

-- CreateEnum
CREATE TYPE "Severidade" AS ENUM ('CRITICA', 'ALTA', 'MEDIA', 'BAIXA', 'INFO');

-- CreateEnum
CREATE TYPE "StatusAlerta" AS ENUM ('NAO_LIDO', 'LIDO', 'RESOLVIDO', 'IGNORADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovementType" ADD VALUE 'LOSS';
ALTER TYPE "MovementType" ADD VALUE 'EXPIRY';
ALTER TYPE "MovementType" ADD VALUE 'INTERNAL_USE';

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "codigoInterno" TEXT,
ADD COLUMN     "custoMedioPonderado" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "dataValidade" TIMESTAMP(3),
ADD COLUMN     "fatorConversao" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "fornecedorSecundarioId" TEXT,
ADD COLUMN     "foto" TEXT,
ADD COLUMN     "localizacao" TEXT,
ADD COLUMN     "pontoReposicao" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "quantidadeMaxima" DOUBLE PRECISION,
ADD COLUMN     "subcategoria" TEXT,
ADD COLUMN     "unidadeCompra" "Unit";

-- AlterTable
ALTER TABLE "IngredientMovement" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "totalCost" DOUBLE PRECISION,
ADD COLUMN     "unitCost" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "endereco" TEXT,
ADD COLUMN     "prazoEntregaDias" INTEGER;

-- CreateTable
CREATE TABLE "Inventario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "InventarioStatus" NOT NULL DEFAULT 'ABERTO',
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEm" TIMESTAMP(3),
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventarioItem" (
    "id" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "qtdSistema" DOUBLE PRECISION NOT NULL,
    "qtdContada" DOUBLE PRECISION,
    "diferenca" DOUBLE PRECISION,
    "observacao" TEXT,

    CONSTRAINT "InventarioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromPlanId" TEXT,
    "toPlanId" TEXT NOT NULL,
    "fromStatus" "SubscriptionStatus",
    "toStatus" "SubscriptionStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "feedback" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "status" "CancellationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "CancellationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigPdv" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taxaServico" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "taxaServicoAtiva" BOOLEAN NOT NULL DEFAULT false,
    "couvert" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxaEntrega" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "formasPagamento" JSONB NOT NULL DEFAULT '["DINHEIRO","DEBITO","CREDITO","PIX"]',

    CONSTRAINT "ConfigPdv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ambiente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Ambiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mesa" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ambienteId" TEXT,
    "numero" INTEGER NOT NULL,
    "identificacao" TEXT,
    "cadeiras" INTEGER NOT NULL DEFAULT 4,
    "status" "MesaStatus" NOT NULL DEFAULT 'LIVRE',
    "grupoId" TEXT,

    CONSTRAINT "Mesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mesaId" TEXT NOT NULL,
    "garcomId" TEXT NOT NULL,
    "status" "PedidoStatus" NOT NULL DEFAULT 'ABERTO',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxaServico" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoEm" TIMESTAMP(3),

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItem" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitario" DOUBLE PRECISION NOT NULL,
    "observacao" TEXT,
    "status" "PedidoItemStatus" NOT NULL DEFAULT 'PENDENTE',

    CONSTRAINT "PedidoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteNome" TEXT NOT NULL,
    "contato" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "numPessoas" INTEGER NOT NULL,
    "mesaIds" JSONB NOT NULL,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoCaixa" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "abertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoEm" TIMESTAMP(3),
    "valorInicial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorFinal" DOUBLE PRECISION,
    "sangrias" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "SessaoCaixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "severidade" "Severidade" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "status" "StatusAlerta" NOT NULL DEFAULT 'NAO_LIDO',
    "insumoId" TEXT,
    "produtoId" TEXT,
    "metadata" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidoEm" TIMESTAMP(3),
    "resolvidoEm" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipoAlerta" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "threshold" JSONB NOT NULL,
    "canais" JSONB NOT NULL,
    "horarioSilencioInicio" TEXT,
    "horarioSilencioFim" TEXT,

    CONSTRAINT "AlertConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "totalVendas" DECIMAL(65,30) NOT NULL,
    "totalPedidos" INTEGER NOT NULL,
    "ticketMedio" DECIMAL(65,30) NOT NULL,
    "cmvTotal" DECIMAL(65,30) NOT NULL,
    "cmvPercentual" DECIMAL(65,30) NOT NULL,
    "produtoMaisVendidoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KdsDevice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "nomeDispositivo" TEXT NOT NULL,
    "ultimaConexao" TIMESTAMP(3) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "KdsDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatorioSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "emails" TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatorioSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inventario_tenantId_idx" ON "Inventario"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InventarioItem_inventarioId_ingredientId_key" ON "InventarioItem"("inventarioId", "ingredientId");

-- CreateIndex
CREATE INDEX "PlanHistory_tenantId_idx" ON "PlanHistory"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationRequest_tenantId_key" ON "CancellationRequest"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigPdv_tenantId_key" ON "ConfigPdv"("tenantId");

-- CreateIndex
CREATE INDEX "Ambiente_tenantId_idx" ON "Ambiente"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Ambiente_nome_tenantId_key" ON "Ambiente"("nome", "tenantId");

-- CreateIndex
CREATE INDEX "Mesa_tenantId_idx" ON "Mesa"("tenantId");

-- CreateIndex
CREATE INDEX "Mesa_ambienteId_idx" ON "Mesa"("ambienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_numero_tenantId_key" ON "Mesa"("numero", "tenantId");

-- CreateIndex
CREATE INDEX "Pedido_tenantId_idx" ON "Pedido"("tenantId");

-- CreateIndex
CREATE INDEX "Pedido_mesaId_idx" ON "Pedido"("mesaId");

-- CreateIndex
CREATE INDEX "Pedido_garcomId_idx" ON "Pedido"("garcomId");

-- CreateIndex
CREATE INDEX "Pedido_tenantId_status_idx" ON "Pedido"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PedidoItem_pedidoId_idx" ON "PedidoItem"("pedidoId");

-- CreateIndex
CREATE INDEX "PedidoItem_productId_idx" ON "PedidoItem"("productId");

-- CreateIndex
CREATE INDEX "Reserva_tenantId_idx" ON "Reserva"("tenantId");

-- CreateIndex
CREATE INDEX "Reserva_tenantId_dataHora_idx" ON "Reserva"("tenantId", "dataHora");

-- CreateIndex
CREATE INDEX "Pagamento_pedidoId_idx" ON "Pagamento"("pedidoId");

-- CreateIndex
CREATE INDEX "SessaoCaixa_tenantId_idx" ON "SessaoCaixa"("tenantId");

-- CreateIndex
CREATE INDEX "SessaoCaixa_usuarioId_idx" ON "SessaoCaixa"("usuarioId");

-- CreateIndex
CREATE INDEX "Alert_tenantId_status_idx" ON "Alert"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Alert_tenantId_tipo_insumoId_idx" ON "Alert"("tenantId", "tipo", "insumoId");

-- CreateIndex
CREATE INDEX "AlertConfig_tenantId_idx" ON "AlertConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertConfig_tenantId_tipoAlerta_key" ON "AlertConfig"("tenantId", "tipoAlerta");

-- CreateIndex
CREATE INDEX "DashboardSnapshot_tenantId_data_idx" ON "DashboardSnapshot"("tenantId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardSnapshot_tenantId_data_key" ON "DashboardSnapshot"("tenantId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "KdsDevice_pushToken_key" ON "KdsDevice"("pushToken");

-- CreateIndex
CREATE INDEX "KdsDevice_tenantId_idx" ON "KdsDevice"("tenantId");

-- CreateIndex
CREATE INDEX "RelatorioSchedule_tenantId_idx" ON "RelatorioSchedule"("tenantId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "AdminLog_adminUserId_idx" ON "AdminLog"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminPasswordResetToken_adminUserId_idx" ON "AdminPasswordResetToken"("adminUserId");

-- CreateIndex
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");

-- CreateIndex
CREATE INDEX "Category_tenantId_type_idx" ON "Category"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Ingredient_tenantId_idx" ON "Ingredient"("tenantId");

-- CreateIndex
CREATE INDEX "Ingredient_categoryId_idx" ON "Ingredient"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_codigoInterno_tenantId_key" ON "Ingredient"("codigoInterno", "tenantId");

-- CreateIndex
CREATE INDEX "IngredientMovement_tenantId_idx" ON "IngredientMovement"("tenantId");

-- CreateIndex
CREATE INDEX "IngredientMovement_ingredientId_idx" ON "IngredientMovement"("ingredientId");

-- CreateIndex
CREATE INDEX "IngredientMovement_tenantId_createdAt_idx" ON "IngredientMovement"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Invite_tenantId_idx" ON "Invite"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "UserAccessLog_userId_idx" ON "UserAccessLog"("userId");

-- CreateIndex
CREATE INDEX "UserAccessLog_tenantId_idx" ON "UserAccessLog"("tenantId");

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_fornecedorSecundarioId_fkey" FOREIGN KEY ("fornecedorSecundarioId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventario" ADD CONSTRAINT "Inventario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventarioItem" ADD CONSTRAINT "InventarioItem_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "Inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventarioItem" ADD CONSTRAINT "InventarioItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanHistory" ADD CONSTRAINT "PlanHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigPdv" ADD CONSTRAINT "ConfigPdv_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ambiente" ADD CONSTRAINT "Ambiente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mesa" ADD CONSTRAINT "Mesa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mesa" ADD CONSTRAINT "Mesa_ambienteId_fkey" FOREIGN KEY ("ambienteId") REFERENCES "Ambiente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_garcomId_fkey" FOREIGN KEY ("garcomId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoCaixa" ADD CONSTRAINT "SessaoCaixa_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoCaixa" ADD CONSTRAINT "SessaoCaixa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertConfig" ADD CONSTRAINT "AlertConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardSnapshot" ADD CONSTRAINT "DashboardSnapshot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KdsDevice" ADD CONSTRAINT "KdsDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioSchedule" ADD CONSTRAINT "RelatorioSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

