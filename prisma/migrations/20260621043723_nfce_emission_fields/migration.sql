-- Add new enum type RegimeTributario
-- Note: CREATE TYPE cannot run inside a transaction block when adding to existing enums,
-- but CREATE TYPE itself is fine in a transaction. We use DO block for idempotency.
DO $$ BEGIN
    CREATE TYPE "RegimeTributario" AS ENUM ('SIMPLES_NACIONAL', 'NORMAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new enum values to NfStatus
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block in PostgreSQL
ALTER TYPE "NfStatus" ADD VALUE IF NOT EXISTS 'AUTORIZADA';
ALTER TYPE "NfStatus" ADD VALUE IF NOT EXISTS 'REJEITADA';
ALTER TYPE "NfStatus" ADD VALUE IF NOT EXISTS 'CANCELADA';

-- AlterTable TenantFiscal: add NFC-e emission fields
ALTER TABLE "TenantFiscal"
    ADD COLUMN IF NOT EXISTS "regimeTributario"       "RegimeTributario",
    ADD COLUMN IF NOT EXISTS "inscricaoEstadual"      TEXT,
    ADD COLUMN IF NOT EXISTS "cscNfce"                TEXT,
    ADD COLUMN IF NOT EXISTS "cscIdNfce"              TEXT,
    ADD COLUMN IF NOT EXISTS "serieNfce"              INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "proximoNumeroNfce"      INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "nfceAutomatica"         BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "ncmPadrao"              TEXT,
    ADD COLUMN IF NOT EXISTS "cfopPadrao"             TEXT,
    ADD COLUMN IF NOT EXISTS "cstCsosnPadrao"         TEXT,
    ADD COLUMN IF NOT EXISTS "origemMercadoriaPadrao" TEXT DEFAULT '0';

-- AlterTable Product: add fiscal classification fields
ALTER TABLE "Product"
    ADD COLUMN IF NOT EXISTS "ncm"               TEXT,
    ADD COLUMN IF NOT EXISTS "cfop"              TEXT,
    ADD COLUMN IF NOT EXISTS "cstCsosn"          TEXT,
    ADD COLUMN IF NOT EXISTS "origemMercadoria"  TEXT,
    ADD COLUMN IF NOT EXISTS "unidadeTributavel" TEXT;

-- AlterTable NfProcessada: add NFC-e emission tracking fields
ALTER TABLE "NfProcessada"
    ADD COLUMN IF NOT EXISTS "pedidoId"             TEXT,
    ADD COLUMN IF NOT EXISTS "danfeUrl"             TEXT,
    ADD COLUMN IF NOT EXISTS "qrCode"               TEXT,
    ADD COLUMN IF NOT EXISTS "protocoloAutorizacao" TEXT,
    ADD COLUMN IF NOT EXISTS "motivoRejeicao"       TEXT,
    ADD COLUMN IF NOT EXISTS "refExterna"           TEXT;

-- CreateIndex for pedidoId unique constraint (one NFC-e per order)
CREATE UNIQUE INDEX IF NOT EXISTS "NfProcessada_pedidoId_key" ON "NfProcessada"("pedidoId");

-- AddForeignKey NfProcessada -> Pedido
ALTER TABLE "NfProcessada"
    DROP CONSTRAINT IF EXISTS "NfProcessada_pedidoId_fkey";

ALTER TABLE "NfProcessada"
    ADD CONSTRAINT "NfProcessada_pedidoId_fkey"
    FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
