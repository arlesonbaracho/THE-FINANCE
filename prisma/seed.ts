import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN_RESTAURANTE: ['estoque.ver','estoque.criar','estoque.editar','estoque.deletar','estoque.movimentar','produtos.ver','produtos.criar','produtos.editar','produtos.deletar','usuarios.ver','usuarios.gerenciar','relatorios.ver','configuracoes.ver','configuracoes.editar','cozinha.ver','cozinha.gerenciar'],
  GERENTE: ['estoque.ver','estoque.criar','estoque.editar','estoque.movimentar','produtos.ver','produtos.criar','produtos.editar','usuarios.ver','relatorios.ver','configuracoes.ver','cozinha.ver','cozinha.gerenciar'],
  CAIXA: ['produtos.ver','estoque.ver','cozinha.ver'],
  COZINHEIRO: ['cozinha.ver','cozinha.gerenciar','estoque.ver'],
  ESTOQUISTA: ['estoque.ver','estoque.criar','estoque.editar','estoque.movimentar','produtos.ver','relatorios.ver'],
}
const DEFAULT_ROLE_NAMES = Object.keys(DEFAULT_ROLE_PERMISSIONS)

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  // ── Plans ─────────────────────────────────────────────────────────────────

  const basicFeatures = { aiAgent: false, advancedReports: false, multiUnit: false, prioritySupport: false, exportReports: false }
  const proFeatures   = { aiAgent: false, advancedReports: true,  multiUnit: false, prioritySupport: false, exportReports: true  }
  const entFeatures   = { aiAgent: true,  advancedReports: true,  multiUnit: true,  prioritySupport: true,  exportReports: true  }

  const [basic, pro, enterprise] = await Promise.all([
    prisma.plan.upsert({
      where: { name: 'Básico' },
      update: {},
      create: {
        name: 'Básico',
        description: 'Ideal para restaurantes que estão começando',
        monthlyPrice: 149,
        annualPrice: 1490,
        maxUsers: 3,
        maxProducts: 50,
        maxOrdersMonth: 500,
        features: basicFeatures,
      },
    }),
    prisma.plan.upsert({
      where: { name: 'Pro' },
      update: {},
      create: {
        name: 'Pro',
        description: 'Para restaurantes em crescimento com mais recursos',
        monthlyPrice: 299,
        annualPrice: 2990,
        maxUsers: 10,
        maxProducts: 300,
        maxOrdersMonth: 2000,
        features: proFeatures,
      },
    }),
    prisma.plan.upsert({
      where: { name: 'Enterprise' },
      update: {},
      create: {
        name: 'Enterprise',
        description: 'Sem limites — para grandes operações e redes',
        monthlyPrice: 599,
        annualPrice: 5990,
        maxUsers: 999,
        maxProducts: 9999,
        maxOrdersMonth: 999999,
        features: entFeatures,
      },
    }),
  ])

  console.log('✅ Plans: Básico, Pro, Enterprise')

  // ── Super Admin ───────────────────────────────────────────────────────────

  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@thefinance.app'
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin@123456'

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      totpEnabled: false,
    },
  })

  console.log(`✅ Admin user: ${adminEmail}`)

  // ── Demo Tenants ──────────────────────────────────────────────────────────

  const demoTenants = [
    { name: 'Sabor do Norte', slug: 'sabor-do-norte', plan: basic, status: 'ACTIVE' as const, price: 149 },
    { name: 'Bistrô Moderno', slug: 'bistro-moderno', plan: pro, status: 'TRIAL' as const, price: 299 },
    { name: 'Churrascaria Gaúcha', slug: 'churrascaria-gaucha', plan: enterprise, status: 'ACTIVE' as const, price: 599 },
  ]

  for (const demo of demoTenants) {
    const existing = await prisma.tenant.findUnique({ where: { slug: demo.slug } })
    if (existing) { console.log(`⏭  Tenant already exists: ${demo.name}`); continue }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const tenant = await prisma.tenant.create({
      data: {
        name: demo.name,
        slug: demo.slug,
        subscription: {
          create: {
            planId: demo.plan.id,
            status: demo.status,
            expiresAt,
            contractedPrice: demo.price,
            ...(demo.status === 'TRIAL' && { trialEndsAt: expiresAt }),
          },
        },
      },
    })

    // Create default roles for tenant
    const createdRoles: Record<string, string> = {}
    for (const roleName of DEFAULT_ROLE_NAMES) {
      const role = await prisma.role.create({
        data: {
          name: roleName,
          isDefault: true,
          permissions: DEFAULT_ROLE_PERMISSIONS[roleName],
          tenantId: tenant.id,
        },
      })
      createdRoles[roleName] = role.id
    }

    // Create 5 demo users per tenant
    const pinHash = await bcrypt.hash('1234', 12)
    const demoPassword = await bcrypt.hash('Demo@1234', 12)

    await prisma.user.createMany({
      data: [
        {
          name: `Admin ${demo.name}`,
          email: `admin@${demo.slug}.com`,
          password: demoPassword,
          role: 'ADMIN',
          tenantId: tenant.id,
          status: 'ACTIVE',
        },
        {
          name: `Gerente ${demo.name}`,
          email: `gerente@${demo.slug}.com`,
          password: demoPassword,
          role: 'MANAGER',
          tenantId: tenant.id,
          customRoleId: createdRoles['GERENTE'],
          status: 'ACTIVE',
        },
        {
          name: `Caixa ${demo.name}`,
          email: `caixa@${demo.slug}.com`,
          password: demoPassword,
          role: 'STAFF',
          tenantId: tenant.id,
          customRoleId: createdRoles['CAIXA'],
          status: 'ACTIVE',
        },
        {
          name: `Cozinheiro ${demo.name}`,
          email: `cozinheiro@${demo.slug}.com`,
          password: demoPassword,
          role: 'STAFF',
          tenantId: tenant.id,
          customRoleId: createdRoles['COZINHEIRO'],
          pin: pinHash,
          status: 'ACTIVE',
        },
        {
          name: `Estoquista ${demo.name}`,
          email: `estoquista@${demo.slug}.com`,
          password: demoPassword,
          role: 'STAFF',
          tenantId: tenant.id,
          customRoleId: createdRoles['ESTOQUISTA'],
          status: 'ACTIVE',
        },
      ],
    })

    // Demo invoice
    await prisma.invoice.create({
      data: {
        tenantId: tenant.id,
        planId: demo.plan.id,
        amount: demo.price,
        status: demo.status === 'ACTIVE' ? 'PAID' : 'PENDING',
        dueDate: expiresAt,
        paidAt: demo.status === 'ACTIVE' ? new Date() : null,
      },
    })

    console.log(`✅ Tenant: ${demo.name} (${demo.plan.name} / ${demo.status}) — 5 users + ${DEFAULT_ROLE_NAMES.length} roles`)
  }

  console.log('\n🎉 Seed complete!\n')
  console.log('─────────────────────────────────')
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`)
  console.log('URL: http://localhost:3000/admin/login')
  console.log('─────────────────────────────────\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
