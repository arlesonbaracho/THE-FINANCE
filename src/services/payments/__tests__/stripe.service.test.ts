import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

// Mock do Prisma antes de importar o service
vi.mock('@/lib/prisma', () => ({
  prisma: {
    stripeCustomer: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tenantSubscription: {
      update: vi.fn(),
    },
  },
}))

// Instância do Stripe inspecionável (hoisted para estar disponível no factory do mock)
const stripeMock = vi.hoisted(() => ({
  customers: { create: vi.fn(), update: vi.fn() },
  setupIntents: { create: vi.fn() },
  paymentMethods: { attach: vi.fn() },
  subscriptions: { create: vi.fn(), update: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  webhooks: { constructEvent: vi.fn() },
}))

vi.mock('stripe', () => ({
  default: class {
    constructor() {
      return stripeMock
    }
  },
}))

import {
  handleWebhook,
  createSetupIntent,
  createSubscriptionFromPaymentMethod,
} from '../stripe.service'
import { prisma } from '@/lib/prisma'

const mockPrisma = prisma as unknown as {
  stripeCustomer: {
    findFirst: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  tenantSubscription: { update: ReturnType<typeof vi.fn> }
}

describe('handleWebhook — checkout.session.completed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock' // construtor Stripe é mockado; chave só p/ passar a guarda do getStripe lazy
    mockPrisma.stripeCustomer.findFirst.mockResolvedValue({
      tenantId: 'tenant_abc',
      stripeCustomerId: 'cus_123',
      stripeSubId: null,
    })
    mockPrisma.stripeCustomer.update.mockResolvedValue({})
    mockPrisma.tenantSubscription.update.mockResolvedValue({})
  })

  it('ativa a assinatura e salva stripeSubId quando checkout é concluído', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_123',
          subscription: 'sub_456',
          metadata: { tenantId: 'tenant_abc' },
        },
      },
    } as unknown as Stripe.Event

    await handleWebhook(event)

    expect(mockPrisma.stripeCustomer.findFirst).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_123' },
    })

    expect(mockPrisma.stripeCustomer.update).toHaveBeenCalledWith({
      where: { tenantId: 'tenant_abc' },
      data: { stripeSubId: 'sub_456' },
    })

    expect(mockPrisma.tenantSubscription.update).toHaveBeenCalledWith({
      where: { tenantId: 'tenant_abc' },
      data: expect.objectContaining({ status: 'ACTIVE' }),
    })
  })

  it('não chama update se customer não for encontrado no banco', async () => {
    mockPrisma.stripeCustomer.findFirst.mockResolvedValue(null)

    const event = {
      type: 'checkout.session.completed',
      data: {
        object: { customer: 'cus_unknown', subscription: 'sub_456', metadata: {} },
      },
    } as unknown as Stripe.Event

    await handleWebhook(event)

    expect(mockPrisma.stripeCustomer.update).not.toHaveBeenCalled()
    expect(mockPrisma.tenantSubscription.update).not.toHaveBeenCalled()
  })

  it('não chama stripeCustomer.update quando não há subscription no evento', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: { customer: 'cus_123', subscription: null, metadata: {} },
      },
    } as unknown as Stripe.Event

    await handleWebhook(event)

    expect(mockPrisma.stripeCustomer.update).not.toHaveBeenCalled()
    expect(mockPrisma.tenantSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) })
    )
  })
})

describe('createSetupIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // customer já existe → getOrCreateStripeCustomer retorna o id existente
    mockPrisma.stripeCustomer.findUnique.mockResolvedValue({
      tenantId: 'tenant_x',
      stripeCustomerId: 'cus_x',
    })
    stripeMock.setupIntents.create.mockResolvedValue({ client_secret: 'seti_secret_123' })
  })

  it('retorna o clientSecret do SetupIntent', async () => {
    const r = await createSetupIntent('tenant_x', 'a@b.com', 'Tenant X')
    expect(stripeMock.setupIntents.create).toHaveBeenCalled()
    expect(r.clientSecret).toBe('seti_secret_123')
  })
})

describe('createSubscriptionFromPaymentMethod', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stripeMock.paymentMethods.attach.mockResolvedValue({})
    stripeMock.customers.update.mockResolvedValue({})
    stripeMock.subscriptions.create.mockResolvedValue({ id: 'sub_1', status: 'active' })
    mockPrisma.stripeCustomer.update.mockResolvedValue({})
  })

  it('lança erro se não houver StripeCustomer', async () => {
    mockPrisma.stripeCustomer.findUnique.mockResolvedValue(null)
    await expect(
      createSubscriptionFromPaymentMethod('tenant_x', 'price_1', 'pm_1')
    ).rejects.toThrow('Cliente Stripe não encontrado')
  })

  it('grava stripeSubId e retorna o status após criar a subscription', async () => {
    mockPrisma.stripeCustomer.findUnique.mockResolvedValue({
      tenantId: 'tenant_x',
      stripeCustomerId: 'cus_x',
    })

    const result = await createSubscriptionFromPaymentMethod('tenant_x', 'price_1', 'pm_1')

    expect(stripeMock.paymentMethods.attach).toHaveBeenCalledWith('pm_1', { customer: 'cus_x' })
    expect(stripeMock.subscriptions.create).toHaveBeenCalled()
    expect(mockPrisma.stripeCustomer.update).toHaveBeenCalledWith({
      where: { tenantId: 'tenant_x' },
      data: { stripeSubId: 'sub_1' },
    })
    expect(result.status).toBe('active')
  })
})
