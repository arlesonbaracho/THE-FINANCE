/**
 * Garante que todos os tenants tenham os roles padrão.
 * Seguro de re-executar: usa upsert, não duplica.
 *
 * Uso: npx ts-node --skip-project prisma/sync-roles.ts
 */
import * as dotenv from 'dotenv'
dotenv.config()

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN_RESTAURANTE: ['estoque.ver','estoque.criar','estoque.editar','estoque.deletar','estoque.movimentar','produtos.ver','produtos.criar','produtos.editar','produtos.deletar','usuarios.ver','usuarios.gerenciar','relatorios.ver','configuracoes.ver','configuracoes.editar','cozinha.ver','cozinha.gerenciar','pedidos.ver','pedidos.criar','pedidos.gerenciar','mesas.gerenciar','caixa.operar'],
  GERENTE: ['estoque.ver','estoque.criar','estoque.editar','estoque.movimentar','produtos.ver','produtos.criar','produtos.editar','usuarios.ver','relatorios.ver','configuracoes.ver','cozinha.ver','cozinha.gerenciar','pedidos.ver','pedidos.gerenciar','mesas.gerenciar'],
  CAIXA: ['produtos.ver','estoque.ver','cozinha.ver','caixa.operar','pedidos.ver','pedidos.gerenciar'],
  COZINHEIRO: ['cozinha.ver','cozinha.gerenciar','estoque.ver','pedidos.ver'],
  ESTOQUISTA: ['estoque.ver','estoque.criar','estoque.editar','estoque.movimentar','produtos.ver','relatorios.ver'],
  GARCOM: ['pedidos.ver','pedidos.criar','produtos.ver'],
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } })
  console.log(`Encontrados ${tenants.length} tenant(s).\n`)

  for (const tenant of tenants) {
    const existingRoles = await prisma.role.findMany({
      where: { tenantId: tenant.id },
      select: { name: true },
    })
    const existingNames = new Set(existingRoles.map((r) => r.name.toUpperCase()))

    let created = 0
    for (const [roleName, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      if (!existingNames.has(roleName)) {
        await prisma.role.create({
          data: { name: roleName, isDefault: true, permissions, tenantId: tenant.id },
        })
        console.log(`  ✅ [${tenant.name}] Criado: ${roleName}`)
        created++
      }
    }

    if (created === 0) {
      console.log(`  ⏭  [${tenant.name}] Todos os roles já existem`)
    }
  }

  console.log('\nConcluído.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
