-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'OVERDUE', 'CANCELLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PAID', 'PENDING', 'OVERDUE');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DOUBLE PRECISION NOT NULL,
    "annualPrice" DOUBLE PRECISION NOT NULL,
    "maxUsers" INTEGER NOT NULL DEFAULT 5,
    "maxProducts" INTEGER NOT NULL DEFAULT 100,
    "maxOrdersMonth" INTEGER NOT NULL DEFAULT 1000,
    "features" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "contractedPrice" DOUBLE PRECISION NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecret" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "role" "AdminRole" NOT NULL DEFAULT 'SUPER_ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSubscription_tenantId_key" ON "TenantSubscription"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminLog" ADD CONSTRAINT "AdminLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
