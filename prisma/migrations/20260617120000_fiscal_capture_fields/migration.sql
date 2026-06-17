-- Add new enum values to NfOrigem
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in PostgreSQL
ALTER TYPE "NfOrigem" ADD VALUE IF NOT EXISTS 'SEFAZ';
ALTER TYPE "NfOrigem" ADD VALUE IF NOT EXISTS 'EMISSAO';

-- Add new enum value to NfStatus
ALTER TYPE "NfStatus" ADD VALUE IF NOT EXISTS 'CAPTURADA';

-- CreateEnum NfTipo
DO $$ BEGIN
    CREATE TYPE "NfTipo" AS ENUM ('ENTRADA', 'SAIDA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable NfProcessada: make rawResponseIa nullable, add new columns
ALTER TABLE "NfProcessada"
    ALTER COLUMN "rawResponseIa" DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS "chaveAcesso" TEXT,
    ADD COLUMN IF NOT EXISTS "xml" TEXT,
    ADD COLUMN IF NOT EXISTS "modelo" TEXT,
    ADD COLUMN IF NOT EXISTS "tipo" "NfTipo",
    ADD COLUMN IF NOT EXISTS "importadoEstoqueEm" TIMESTAMP(3);

-- CreateIndex for chaveAcesso unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "NfProcessada_chaveAcesso_key" ON "NfProcessada"("chaveAcesso");

-- AlterTable TenantFiscal: add new columns
ALTER TABLE "TenantFiscal"
    ADD COLUMN IF NOT EXISTS "certificadoCifrado" TEXT,
    ADD COLUMN IF NOT EXISTS "certificadoSenhaCifrada" TEXT,
    ADD COLUMN IF NOT EXISTS "certificadoValidade" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "certificadoStatus" TEXT,
    ADD COLUMN IF NOT EXISTS "focusEmpresaId" TEXT,
    ADD COLUMN IF NOT EXISTS "ultimaSincronizacaoNf" TIMESTAMP(3);
