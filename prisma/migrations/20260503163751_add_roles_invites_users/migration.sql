-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "customRoleId" TEXT,
ADD COLUMN     "pin" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "ultimoAcesso" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "action" TEXT NOT NULL DEFAULT 'login',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roleId" TEXT,
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_tenantId_key" ON "Role"("name", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_email_tenantId_key" ON "Invite"("email", "tenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessLog" ADD CONSTRAINT "UserAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessLog" ADD CONSTRAINT "UserAccessLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
