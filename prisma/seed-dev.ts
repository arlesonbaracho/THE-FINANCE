/**
 * Seed de CONTA DEV completa — "Churrascaria Gaúcha".
 * Cria um tenant pronto para testar TODAS as funcionalidades, SEM bloqueios:
 *  - Plano Enterprise ilimitado + todas as features (sem feature-gate / limites)
 *  - Assinatura ACTIVE (sem trial expirado / plano-bloqueado)
 *  - CNPJ válido no tenant (sem o CnpjGate)
 *  - ConsentRecord para todos os usuários (sem o gate de re-consentimento LGPD)
 *  - Admin/Gerente por e-mail; Caixa/Cozinheiro/Estoquista/Garçom com PIN 1234
 *  - Categorias, fornecedores, insumos, produtos, fichas técnicas
 *  - Ambientes + mesas (para o painel do garçom / PDV)
 *
 * Idempotente: pode rodar várias vezes. Rodar:  npx ts-node --skip-project prisma/seed-dev.ts
 */
import { PrismaClient, CategoryType, Unit } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// Versões vigentes dos documentos LGPD (mantidas em sync com src/lib/legal.ts)
const POLITICA_VERSAO = '2026-06-22'
const TERMOS_VERSAO = '2026-06-22'
// CNPJ sintético que passa no algoritmo de dígitos verificadores (uso em dev)
const CNPJ_DEV = '11222333000181'

async function main() {
  console.log('🥩 Seed DEV — Churrascaria Gaúcha (conta completa, sem bloqueios)\n')

  // ── Plano Enterprise ilimitado + todas as features ───────────────────────
  const plan = await prisma.plan.upsert({
    where: { name: 'Enterprise' },
    update: {
      maxUsers: 999999, maxProducts: 999999, maxOrdersMonth: 999999, active: true,
      features: { aiAgent: true, advancedReports: true, multiUnit: true, prioritySupport: true, exportReports: true },
    },
    create: {
      name: 'Enterprise', description: 'Plano dev — tudo liberado',
      monthlyPrice: 599, annualPrice: 5990,
      maxUsers: 999999, maxProducts: 999999, maxOrdersMonth: 999999, active: true,
      features: { aiAgent: true, advancedReports: true, multiUnit: true, prioritySupport: true, exportReports: true },
    },
  })
  console.log(`✅ Plano: ${plan.name} (ilimitado, todas as features)`)

  // ── Tenant + assinatura ACTIVE + CNPJ ─────────────────────────────────────
  let tenant = await prisma.tenant.findFirst({ where: { slug: 'churrascaria-gaucha' } })
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: 'Churrascaria Gaúcha', slug: 'churrascaria-gaucha', active: true, cnpj: CNPJ_DEV },
    })
    console.log(`🆕 Tenant criado: ${tenant.name}`)
  } else {
    tenant = await prisma.tenant.update({ where: { id: tenant.id }, data: { active: true, cnpj: tenant.cnpj ?? CNPJ_DEV } })
  }
  const tid = tenant.id

  // Assinatura ACTIVE (1 ano) — upsert por tenantId (relação 1:1)
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  await prisma.tenantSubscription.upsert({
    where: { tenantId: tid },
    update: { planId: plan.id, status: 'ACTIVE', expiresAt, contractedPrice: 599 },
    create: { tenantId: tid, planId: plan.id, status: 'ACTIVE', expiresAt, contractedPrice: 599 },
  })
  console.log(`✅ Tenant: ${tenant.name} — assinatura ACTIVE, CNPJ ${CNPJ_DEV}`)

  // ── Cargos (roles) ────────────────────────────────────────────────────────
  const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
    ADMIN_RESTAURANTE: ['estoque.ver','estoque.criar','estoque.editar','estoque.deletar','estoque.movimentar','produtos.ver','produtos.criar','produtos.editar','produtos.deletar','usuarios.ver','usuarios.gerenciar','relatorios.ver','configuracoes.ver','configuracoes.editar','cozinha.ver','cozinha.gerenciar','pedidos.ver','pedidos.criar','pedidos.gerenciar','mesas.gerenciar','caixa.operar'],
    GERENTE:           ['estoque.ver','estoque.criar','estoque.editar','estoque.movimentar','produtos.ver','produtos.criar','produtos.editar','usuarios.ver','relatorios.ver','configuracoes.ver','cozinha.ver','cozinha.gerenciar','pedidos.ver','pedidos.gerenciar','mesas.gerenciar'],
    CAIXA:             ['produtos.ver','estoque.ver','cozinha.ver','caixa.operar','pedidos.ver','pedidos.gerenciar'],
    COZINHEIRO:        ['cozinha.ver','cozinha.gerenciar','estoque.ver','pedidos.ver'],
    ESTOQUISTA:        ['estoque.ver','estoque.criar','estoque.editar','estoque.movimentar','produtos.ver','relatorios.ver'],
    GARCOM:            ['pedidos.ver','pedidos.criar','produtos.ver'],
  }
  const roleIds: Record<string, string> = {}
  for (const [roleName, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    let role = await prisma.role.findFirst({ where: { name: roleName, tenantId: tid } })
    if (!role) role = await prisma.role.create({ data: { name: roleName, isDefault: true, permissions, tenantId: tid } })
    roleIds[roleName] = role.id
  }

  // ── Usuários ──────────────────────────────────────────────────────────────
  const demoPassword = await bcrypt.hash('Demo@1234', 12)
  const pinHash = await bcrypt.hash('1234', 12)
  const now = new Date()

  const usersToCreate = [
    { name: 'Admin Churrascaria',  email: 'admin@churrascaria-gaucha.com',      role: 'ADMIN'   as const, customRole: 'ADMIN_RESTAURANTE', pin: false },
    { name: 'Gerente Gaúcho',      email: 'gerente@churrascaria-gaucha.com',    role: 'MANAGER' as const, customRole: 'GERENTE',           pin: false },
    { name: 'Caixa Gaúcho',        email: 'caixa@churrascaria-gaucha.com',      role: 'STAFF'   as const, customRole: 'CAIXA',             pin: true  },
    { name: 'Cozinheiro Gaúcho',   email: 'cozinheiro@churrascaria-gaucha.com', role: 'STAFF'   as const, customRole: 'COZINHEIRO',        pin: true  },
    { name: 'Estoquista Gaúcho',   email: 'estoquista@churrascaria-gaucha.com', role: 'STAFF'   as const, customRole: 'ESTOQUISTA',        pin: true  },
    { name: 'Garçom Gaúcho',       email: 'garcom@churrascaria-gaucha.com',     role: 'STAFF'   as const, customRole: 'GARCOM',            pin: true  },
  ]

  const userIds: string[] = []
  for (const u of usersToCreate) {
    const data = {
      name: u.name, email: u.email, password: demoPassword, role: u.role,
      tenantId: tid, customRoleId: roleIds[u.customRole], status: 'ACTIVE' as const,
      emailVerified: now, ...(u.pin ? { pin: pinHash } : {}),
    }
    const user = await prisma.user.upsert({ where: { email: u.email }, update: data, create: data })
    userIds.push(user.id)
  }
  console.log(`✅ ${usersToCreate.length} usuários (4 operacionais com PIN 1234)`)

  // ── Consentimento LGPD (evita o gate de re-consentimento) ─────────────────
  let consentCount = 0
  for (const userId of userIds) {
    for (const documento of ['POLITICA', 'TERMOS'] as const) {
      const versao = documento === 'POLITICA' ? POLITICA_VERSAO : TERMOS_VERSAO
      const já = await prisma.consentRecord.findFirst({ where: { userId, documento, versao } })
      if (!já) {
        await prisma.consentRecord.create({ data: { userId, tenantId: tid, documento, versao, ip: '127.0.0.1' } })
        consentCount++
      }
    }
  }
  console.log(`✅ ${consentCount} registros de consentimento LGPD`)

  // ── Categorias ────────────────────────────────────────────────────────────
  const ingCatNames = ['Carnes e Proteínas', 'Temperos e Condimentos', 'Bebidas', 'Hortifrúti', 'Descartáveis']
  const ingCats: Record<string, string> = {}
  for (const name of ingCatNames) {
    const cat = await prisma.category.upsert({ where: { name_type_tenantId: { name, type: CategoryType.INGREDIENT, tenantId: tid } }, update: {}, create: { name, type: CategoryType.INGREDIENT, tenantId: tid } })
    ingCats[name] = cat.id
  }
  const prodCatNames = ['Carnes Grelhadas', 'Acompanhamentos', 'Bebidas', 'Sobremesas']
  const prodCats: Record<string, string> = {}
  for (const name of prodCatNames) {
    const cat = await prisma.category.upsert({ where: { name_type_tenantId: { name, type: CategoryType.PRODUCT, tenantId: tid } }, update: {}, create: { name, type: CategoryType.PRODUCT, tenantId: tid } })
    prodCats[name] = cat.id
  }
  console.log(`✅ ${ingCatNames.length + prodCatNames.length} categorias`)

  // ── Fornecedores ──────────────────────────────────────────────────────────
  const suppliersData = [
    { name: 'Frigorífico São João', cnpj: '12.345.678/0001-90', contact: 'Carlos Melo', phone: '(54) 99123-4567', email: 'vendas@frigorifico-sj.com.br', prazoEntregaDias: 3, endereco: 'Rodovia RS-122, Km 45, Caxias do Sul - RS' },
    { name: 'Distribuidora Verde Fresco', cnpj: '98.765.432/0001-10', contact: 'Ana Paula', phone: '(54) 98765-4321', email: 'contato@verdefresco.com.br', prazoEntregaDias: 2, endereco: 'Av. Brasil, 1200, Bento Gonçalves - RS' },
    { name: 'Bebidas & Cia Distribuidora', cnpj: '55.444.333/0001-22', contact: 'Pedro Souza', phone: '(51) 97654-3210', email: 'pedidos@bebidasecia.com.br', prazoEntregaDias: 1, endereco: 'Rua Flores, 890, Porto Alegre - RS' },
  ]
  const suppliers: Record<string, string> = {}
  for (const s of suppliersData) {
    let supplier = await prisma.supplier.findFirst({ where: { name: s.name, tenantId: tid } })
    if (!supplier) supplier = await prisma.supplier.create({ data: { ...s, tenantId: tid } })
    suppliers[s.name] = supplier.id
  }

  // ── Insumos ───────────────────────────────────────────────────────────────
  const frigId = suppliers['Frigorífico São João'], verdeId = suppliers['Distribuidora Verde Fresco'], bebId = suppliers['Bebidas & Cia Distribuidora']
  const insumos = [
    { code: 'INS-0001', name: 'Picanha', unit: Unit.KG, cost: 85.0, qty: 30, min: 10, cat: 'Carnes e Proteínas', sup: frigId },
    { code: 'INS-0002', name: 'Costela Bovina', unit: Unit.KG, cost: 45.0, qty: 20, min: 8, cat: 'Carnes e Proteínas', sup: frigId },
    { code: 'INS-0003', name: 'Maminha', unit: Unit.KG, cost: 55.0, qty: 15, min: 5, cat: 'Carnes e Proteínas', sup: frigId },
    { code: 'INS-0004', name: 'Contrafilé', unit: Unit.KG, cost: 60.0, qty: 25, min: 8, cat: 'Carnes e Proteínas', sup: frigId },
    { code: 'INS-0005', name: 'Frango (Coxa e Sobrecoxa)', unit: Unit.KG, cost: 18.0, qty: 20, min: 8, cat: 'Carnes e Proteínas', sup: frigId },
    { code: 'INS-0006', name: 'Coração de Frango', unit: Unit.KG, cost: 15.0, qty: 10, min: 4, cat: 'Carnes e Proteínas', sup: frigId },
    { code: 'INS-0007', name: 'Linguiça Toscana', unit: Unit.KG, cost: 22.0, qty: 15, min: 5, cat: 'Carnes e Proteínas', sup: frigId },
    { code: 'INS-0008', name: 'Queijo Coalho', unit: Unit.KG, cost: 35.0, qty: 8, min: 3, cat: 'Carnes e Proteínas', sup: frigId },
    { code: 'INS-0009', name: 'Sal Grosso', unit: Unit.KG, cost: 3.5, qty: 20, min: 5, cat: 'Temperos e Condimentos', sup: verdeId },
    { code: 'INS-0010', name: 'Alho', unit: Unit.KG, cost: 12.0, qty: 5, min: 2, cat: 'Temperos e Condimentos', sup: verdeId },
    { code: 'INS-0011', name: 'Pimenta-do-reino', unit: Unit.KG, cost: 45.0, qty: 2, min: 0.5, cat: 'Temperos e Condimentos', sup: verdeId },
    { code: 'INS-0012', name: 'Chimichurri', unit: Unit.KG, cost: 35.0, qty: 3, min: 1, cat: 'Temperos e Condimentos', sup: verdeId },
    { code: 'INS-0013', name: 'Carvão Vegetal', unit: Unit.KG, cost: 8.0, qty: 100, min: 30, cat: 'Temperos e Condimentos', sup: verdeId },
    { code: 'INS-0014', name: 'Tomate', unit: Unit.KG, cost: 6.0, qty: 10, min: 3, cat: 'Hortifrúti', sup: verdeId },
    { code: 'INS-0015', name: 'Cebola', unit: Unit.KG, cost: 4.5, qty: 10, min: 3, cat: 'Hortifrúti', sup: verdeId },
    { code: 'INS-0016', name: 'Pimentão Verde', unit: Unit.KG, cost: 8.0, qty: 5, min: 2, cat: 'Hortifrúti', sup: verdeId },
    { code: 'INS-0017', name: 'Mandioca', unit: Unit.KG, cost: 5.0, qty: 15, min: 5, cat: 'Hortifrúti', sup: verdeId },
    { code: 'INS-0018', name: 'Farinha de Mandioca', unit: Unit.KG, cost: 6.5, qty: 10, min: 3, cat: 'Hortifrúti', sup: verdeId },
    { code: 'INS-0019', name: 'Cerveja Pilsen 600ml', unit: Unit.UN, cost: 5.5, qty: 200, min: 60, cat: 'Bebidas', sup: bebId },
    { code: 'INS-0020', name: 'Refrigerante Cola 2L', unit: Unit.UN, cost: 7.0, qty: 100, min: 30, cat: 'Bebidas', sup: bebId },
    { code: 'INS-0021', name: 'Água Mineral 500ml', unit: Unit.UN, cost: 1.5, qty: 200, min: 60, cat: 'Bebidas', sup: bebId },
    { code: 'INS-0022', name: 'Cachaça 51 (garrafa 1L)', unit: Unit.L, cost: 18.0, qty: 10, min: 3, cat: 'Bebidas', sup: bebId },
  ]
  const ingredientIds: Record<string, string> = {}
  for (const ins of insumos) {
    let ing = await prisma.ingredient.findFirst({ where: { name: ins.name, tenantId: tid } })
    if (!ing) ing = await prisma.ingredient.create({ data: { codigoInterno: ins.code, name: ins.name, unit: ins.unit, currentQty: ins.qty, minimumQty: ins.min, pontoReposicao: ins.min, unitCost: ins.cost, custoMedioPonderado: ins.cost, tenantId: tid, categoryId: ingCats[ins.cat], supplierId: ins.sup } })
    ingredientIds[ins.name] = ing.id
  }
  console.log(`✅ ${insumos.length} insumos`)

  // ── Produtos ──────────────────────────────────────────────────────────────
  const produtos = [
    { name: 'Picanha no Espeto', price: 89.9, cat: 'Carnes Grelhadas' },
    { name: 'Costela na Brasa', price: 59.9, cat: 'Carnes Grelhadas' },
    { name: 'Maminha Grelhada', price: 69.9, cat: 'Carnes Grelhadas' },
    { name: 'Contrafilé Grelhado', price: 65.9, cat: 'Carnes Grelhadas' },
    { name: 'Frango Grelhado', price: 45.9, cat: 'Carnes Grelhadas' },
    { name: 'Coração de Frango (100g)', price: 35.9, cat: 'Carnes Grelhadas' },
    { name: 'Linguiça Artesanal', price: 39.9, cat: 'Carnes Grelhadas' },
    { name: 'Queijo Coalho Grelhado', price: 29.9, cat: 'Carnes Grelhadas' },
    { name: 'Farofa da Casa', price: 15.9, cat: 'Acompanhamentos' },
    { name: 'Vinagrete', price: 12.9, cat: 'Acompanhamentos' },
    { name: 'Mandioca Frita', price: 18.9, cat: 'Acompanhamentos' },
    { name: 'Pão de Alho (4 unidades)', price: 14.9, cat: 'Acompanhamentos' },
    { name: 'Cerveja 600ml', price: 14.9, cat: 'Bebidas' },
    { name: 'Refrigerante 2L', price: 16.9, cat: 'Bebidas' },
    { name: 'Água Mineral', price: 6.9, cat: 'Bebidas' },
    { name: 'Caipirinha de Limão', price: 22.9, cat: 'Bebidas' },
    { name: 'Pudim de Leite Condensado', price: 18.9, cat: 'Sobremesas' },
  ]
  const productIds: Record<string, string> = {}
  for (const p of produtos) {
    let product = await prisma.product.findFirst({ where: { name: p.name, tenantId: tid } })
    if (!product) product = await prisma.product.create({ data: { name: p.name, salePrice: p.price, active: true, tenantId: tid, categoryId: prodCats[p.cat] } })
    productIds[p.name] = product.id
  }
  console.log(`✅ ${produtos.length} produtos`)

  // ── Fichas técnicas ───────────────────────────────────────────────────────
  const fichas = [
    { product: 'Picanha no Espeto', ingredient: 'Picanha', quantity: 0.4 },
    { product: 'Picanha no Espeto', ingredient: 'Sal Grosso', quantity: 0.02 },
    { product: 'Costela na Brasa', ingredient: 'Costela Bovina', quantity: 0.5 },
    { product: 'Maminha Grelhada', ingredient: 'Maminha', quantity: 0.35 },
    { product: 'Contrafilé Grelhado', ingredient: 'Contrafilé', quantity: 0.3 },
    { product: 'Frango Grelhado', ingredient: 'Frango (Coxa e Sobrecoxa)', quantity: 0.3 },
    { product: 'Coração de Frango (100g)', ingredient: 'Coração de Frango', quantity: 0.1 },
    { product: 'Linguiça Artesanal', ingredient: 'Linguiça Toscana', quantity: 0.2 },
    { product: 'Queijo Coalho Grelhado', ingredient: 'Queijo Coalho', quantity: 0.15 },
    { product: 'Farofa da Casa', ingredient: 'Farinha de Mandioca', quantity: 0.15 },
    { product: 'Vinagrete', ingredient: 'Tomate', quantity: 0.1 },
    { product: 'Mandioca Frita', ingredient: 'Mandioca', quantity: 0.2 },
    { product: 'Cerveja 600ml', ingredient: 'Cerveja Pilsen 600ml', quantity: 1 },
    { product: 'Refrigerante 2L', ingredient: 'Refrigerante Cola 2L', quantity: 1 },
    { product: 'Água Mineral', ingredient: 'Água Mineral 500ml', quantity: 1 },
    { product: 'Caipirinha de Limão', ingredient: 'Cachaça 51 (garrafa 1L)', quantity: 0.1 },
  ]
  let fichasCreated = 0
  for (const f of fichas) {
    const productId = productIds[f.product], ingredientId = ingredientIds[f.ingredient]
    if (!productId || !ingredientId) continue
    const exists = await prisma.productIngredient.findUnique({ where: { productId_ingredientId: { productId, ingredientId } } })
    if (!exists) { await prisma.productIngredient.create({ data: { productId, ingredientId, quantity: f.quantity } }); fichasCreated++ }
  }
  console.log(`✅ ${fichasCreated} fichas técnicas vinculadas`)

  // ── Ambientes + Mesas ─────────────────────────────────────────────────────
  const ambientesData = [{ nome: 'Salão Principal', ordem: 0 }, { nome: 'Varanda', ordem: 1 }]
  const ambienteIds: Record<string, string> = {}
  for (const a of ambientesData) {
    const amb = await prisma.ambiente.upsert({ where: { nome_tenantId: { nome: a.nome, tenantId: tid } }, update: {}, create: { nome: a.nome, ordem: a.ordem, tenantId: tid } })
    ambienteIds[a.nome] = amb.id
  }
  const mesasData = [
    { numero: 1, cadeiras: 4, ambiente: 'Salão Principal' },
    { numero: 2, cadeiras: 4, ambiente: 'Salão Principal' },
    { numero: 3, cadeiras: 6, ambiente: 'Salão Principal' },
    { numero: 4, cadeiras: 2, ambiente: 'Salão Principal' },
    { numero: 5, cadeiras: 8, ambiente: 'Salão Principal' },
    { numero: 6, cadeiras: 4, ambiente: 'Varanda' },
    { numero: 7, cadeiras: 4, ambiente: 'Varanda' },
    { numero: 8, cadeiras: 6, ambiente: 'Varanda' },
  ]
  let mesasCreated = 0
  for (const m of mesasData) {
    const exists = await prisma.mesa.findFirst({ where: { numero: m.numero, tenantId: tid } })
    if (!exists) { await prisma.mesa.create({ data: { numero: m.numero, cadeiras: m.cadeiras, status: 'LIVRE', ambienteId: ambienteIds[m.ambiente], tenantId: tid } }); mesasCreated++ }
  }
  console.log(`✅ ${ambientesData.length} ambientes + ${mesasCreated} mesas`)

  // ── Vendas históricas (popula os RELATÓRIOS) ──────────────────────────────
  // Cria pedidos FINALIZADOS nos últimos 30 dias + movimentações OUT de estoque
  // (drive: relatórios de vendas, produtos, cozinha, delivery e CMV/giro).
  const jaTemVendas = await prisma.pedido.count({ where: { tenantId: tid, status: 'FINALIZADO' } })
  if (jaTemVendas > 0) {
    console.log(`ℹ️  ${jaTemVendas} pedidos finalizados já existem — pulando geração de vendas`)
  } else {
    const precoPorProduto: Record<string, number> = Object.fromEntries(produtos.map((p) => [p.name, p.price]))
    const cmpPorInsumo: Record<string, number> = Object.fromEntries(insumos.map((i) => [i.name, i.cost]))
    const fichasPorProduto: Record<string, Array<{ ingredient: string; quantity: number }>> = {}
    for (const f of fichas) (fichasPorProduto[f.product] ||= []).push({ ingredient: f.ingredient, quantity: f.quantity })
    const nomesProdutos = produtos.map((p) => p.name).filter((n) => productIds[n])
    const mesas = await prisma.mesa.findMany({ where: { tenantId: tid }, select: { id: true } })
    const garcomUserId = userIds[5] // ordem de usersToCreate: o garçom é o 6º

    const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
    const pick = <T,>(arr: T[]): T => arr[rnd(0, arr.length - 1)]
    const TAXA = 0.10
    const TOTAL_PEDIDOS = 55

    let vendas = 0, movimentos = 0
    for (let i = 0; i < TOTAL_PEDIDOS; i++) {
      // origem ponderada: MESA 60% · BALCAO 25% · IFOOD 15%
      const r = Math.random()
      const origem = r < 0.6 ? 'MESA' : r < 0.85 ? 'BALCAO' : 'IFOOD'

      // data: dia aleatório nos últimos 30, em horário de almoço/jantar
      const diasAtras = rnd(0, 29)
      const criadoEm = new Date()
      criadoEm.setDate(criadoEm.getDate() - diasAtras)
      criadoEm.setHours(Math.random() < 0.5 ? rnd(11, 14) : rnd(18, 22), rnd(0, 59), 0, 0)
      const fechadoEm = new Date(criadoEm.getTime() + rnd(20, 75) * 60_000)

      // 1 a 4 produtos distintos
      const qtdItens = rnd(1, 4)
      const escolhidos = [...new Set(Array.from({ length: qtdItens }, () => pick(nomesProdutos)))]
      const itens = escolhidos.map((nome) => ({ nome, quantidade: rnd(1, 3), preco: precoPorProduto[nome] }))
      const subtotal = itens.reduce((s, it) => s + it.preco * it.quantidade, 0)
      const taxaServico = Math.round(subtotal * TAXA * 100) / 100
      const total = Math.round((subtotal + taxaServico) * 100) / 100

      await prisma.pedido.create({
        data: {
          tenantId: tid, status: 'FINALIZADO', origem: origem as 'MESA' | 'BALCAO' | 'IFOOD',
          criadoEm, fechadoEm, subtotal, taxaServico, total,
          ...(origem === 'MESA' && mesas.length ? { mesaId: pick(mesas).id, garcomId: garcomUserId } : {}),
          itens: { create: itens.map((it) => ({ productId: productIds[it.nome], quantidade: it.quantidade, precoUnitario: it.preco, status: 'ENTREGUE' as const })) },
          pagamentos: { create: { formaPagamento: pick(['DINHEIRO', 'DEBITO', 'CREDITO', 'PIX'] as const), valor: total } },
        },
      })
      vendas++

      // Movimentações OUT de estoque (CMV/giro) — a partir das fichas dos produtos
      for (const it of itens) {
        for (const fi of fichasPorProduto[it.nome] ?? []) {
          const ingredientId = ingredientIds[fi.ingredient]
          const cmp = cmpPorInsumo[fi.ingredient] ?? 0
          if (!ingredientId) continue
          const quantity = Math.round(fi.quantity * it.quantidade * 1000) / 1000
          await prisma.ingredientMovement.create({
            data: {
              ingredientId, tenantId: tid, type: 'OUT', quantity,
              unitCost: cmp, totalCost: Math.round(quantity * cmp * 100) / 100,
              reason: 'venda', note: 'Baixa por venda (seed dev)', createdAt: criadoEm,
            },
          })
          movimentos++
        }
      }
    }
    console.log(`✅ ${vendas} pedidos finalizados (30 dias) + ${movimentos} movimentações OUT — relatórios populados`)
  }

  // ── Pedidos EM ABERTO (KDS / caixa / garçom não começam vazios) ───────────
  const jaTemAtivos = await prisma.pedido.count({ where: { tenantId: tid, status: { in: ['ABERTO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE'] } } })
  if (jaTemAtivos > 0) {
    console.log(`ℹ️  ${jaTemAtivos} pedidos ativos já existem — pulando geração de abertos`)
  } else {
    const precoPorProduto2: Record<string, number> = Object.fromEntries(produtos.map((p) => [p.name, p.price]))
    const nomesProds = produtos.map((p) => p.name).filter((n) => productIds[n])
    const mesasLivres = await prisma.mesa.findMany({ where: { tenantId: tid }, select: { id: true, numero: true }, orderBy: { numero: 'asc' } })
    const garcom = userIds[5]
    const rnd2 = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
    const pick2 = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
    const itemStatusDe: Record<string, 'PENDENTE' | 'EM_PREPARO' | 'PRONTO' | 'ENTREGUE'> = { ABERTO: 'PENDENTE', EM_PREPARO: 'EM_PREPARO', PRONTO: 'PRONTO', ENTREGUE: 'ENTREGUE' }

    // status variados: 2 na cozinha (ABERTO/EM_PREPARO), 1 PRONTO, 1 ENTREGUE (pronto p/ pagar no caixa)
    const statusesAbertos = ['ABERTO', 'EM_PREPARO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE'] as const
    let abertos = 0
    for (let i = 0; i < statusesAbertos.length && i < mesasLivres.length; i++) {
      const st = statusesAbertos[i]
      const mesa = mesasLivres[i]
      const minutosAtras = rnd2(5, 70)
      const criadoEm = new Date(Date.now() - minutosAtras * 60_000)
      const escolhidos = [...new Set(Array.from({ length: rnd2(1, 3) }, () => pick2(nomesProds)))]
      const itens = escolhidos.map((nome) => ({ nome, quantidade: rnd2(1, 2), preco: precoPorProduto2[nome] }))
      const subtotal = itens.reduce((s, it) => s + it.preco * it.quantidade, 0)
      const taxaServico = Math.round(subtotal * 0.10 * 100) / 100
      const total = Math.round((subtotal + taxaServico) * 100) / 100

      await prisma.pedido.create({
        data: {
          tenantId: tid, status: st, origem: 'MESA', criadoEm, mesaId: mesa.id, garcomId: garcom,
          subtotal, taxaServico, total,
          itens: { create: itens.map((it) => ({ productId: productIds[it.nome], quantidade: it.quantidade, precoUnitario: it.preco, status: itemStatusDe[st] })) },
        },
      })
      await prisma.mesa.update({ where: { id: mesa.id }, data: { status: 'OCUPADA' } })
      abertos++
    }
    console.log(`✅ ${abertos} pedidos em aberto (mesas ocupadas) — KDS/caixa/garçom com dados ao vivo`)
  }

  // ── Reservas de exemplo ───────────────────────────────────────────────────
  const jaTemReservas = await prisma.reserva.count({ where: { tenantId: tid } })
  if (jaTemReservas > 0) {
    console.log(`ℹ️  ${jaTemReservas} reservas já existem — pulando`)
  } else {
    const mesasParaReserva = await prisma.mesa.findMany({ where: { tenantId: tid }, select: { id: true }, orderBy: { numero: 'desc' }, take: 4 })
    const reservas = [
      { clienteNome: 'Família Oliveira', contato: '(54) 99111-2233', numPessoas: 6, emDias: 1, hora: 20, obs: 'Aniversário — mesa perto da janela' },
      { clienteNome: 'João e Maria',     contato: '(51) 98222-3344', numPessoas: 2, emDias: 1, hora: 21, obs: 'Comemoração de noivado' },
      { clienteNome: 'Equipe Tech RS',   contato: '(54) 99333-4455', numPessoas: 8, emDias: 2, hora: 19, obs: 'Confraternização da empresa' },
      { clienteNome: 'Carlos Mendes',    contato: '(54) 99444-5566', numPessoas: 4, emDias: 3, hora: 20, obs: null },
    ]
    let reservasCriadas = 0
    for (let i = 0; i < reservas.length; i++) {
      const r = reservas[i]
      const dataHora = new Date()
      dataHora.setDate(dataHora.getDate() + r.emDias)
      dataHora.setHours(r.hora, 0, 0, 0)
      await prisma.reserva.create({
        data: {
          tenantId: tid, clienteNome: r.clienteNome, contato: r.contato, dataHora,
          numPessoas: r.numPessoas, mesaIds: mesasParaReserva[i] ? [mesasParaReserva[i].id] : [],
          ...(r.obs ? { observacao: r.obs } : {}),
        },
      })
      reservasCriadas++
    }
    console.log(`✅ ${reservasCriadas} reservas de exemplo (próximos dias)`)
  }

  console.log('\n🎉 Conta DEV pronta — sem bloqueios!\n')
  console.log('───────────────────────────────────────────────────────────')
  console.log('Painel (login e-mail):  http://localhost:3000/auth/login')
  console.log('  ADMIN     → admin@churrascaria-gaucha.com      / Demo@1234')
  console.log('  GERENTE   → gerente@churrascaria-gaucha.com    / Demo@1234')
  console.log('  (todos os e-mails acima usam a senha Demo@1234)')
  console.log('')
  console.log('Painéis operacionais (PIN 1234):')
  console.log('  Caixa     → http://localhost:3000/churrascaria-gaucha/caixa')
  console.log('  Cozinha   → http://localhost:3000/churrascaria-gaucha/cozinha')
  console.log('  Estoque   → http://localhost:3000/churrascaria-gaucha/estoque')
  console.log('  Garçom    → http://localhost:3000/churrascaria-gaucha/garcom')
  console.log('───────────────────────────────────────────────────────────\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
