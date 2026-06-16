-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "cnpj" TEXT;

-- CreateTable
CREATE TABLE "TenantFiscal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "nomeFantasia" TEXT,
    "situacaoCadastral" TEXT,
    "cnpjVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantFiscal_tenantId_key" ON "TenantFiscal"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_cnpj_key" ON "Tenant"("cnpj");

-- AddForeignKey
ALTER TABLE "TenantFiscal" ADD CONSTRAINT "TenantFiscal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
