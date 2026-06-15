import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

// Mock do Prisma antes de importar o service
vi.mock('@/lib/prisma', () => ({
  prisma: {
    stripeCustomer: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    tenantSubscription: {
      update: vi.fn(),
    },
  },
}))

// Mock do Stripe SDK (o service cria uma instância no módulo via `new Stripe()`)
vi.mock('stripe', () => {
  class MockStripe {
    customers = { create: vi.fn() }
    subscriptions = { update: vi.fn() }
    checkout = { sessions: { create: vi.fn() } }
    webhooks = { constructEvent: vi.fn() }
  }
  return { default: MockStripe }
})

import { handleWebhook } from '../stripe.service'
import { prisma } from '@/lib/prisma'

const mockPrisma = prisma as unknown as {
  stripeCustomer: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  tenantSubscription: { update: ReturnType<typeof vi.fn> }
}

describe('handleWebhook — checkout.session.completed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
        object: {
          customer: 'cus_unknown',
          subscription: 'sub_456',
          metadata: {},
        },
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
        object: {
          customer: 'cus_123',
          subscription: null,
          metadata: {},
        },
      },
    } as unknown as Stripe.Event

    await handleWebhook(event)

    expect(mockPrisma.stripeCustomer.update).not.toHaveBeenCalled()
    expect(mockPrisma.tenantSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) })
    )
  })
})
