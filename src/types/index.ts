import type { Ingredient, Category, Supplier, Product, ProductIngredient, IngredientMovement, Tenant, User, UserRole, Unit, MovementType, CategoryType } from '@prisma/client'

export type { UserRole, Unit, MovementType, CategoryType }

export type StockStatus = 'ok' | 'low' | 'critical' | 'expiring' | 'expired'

export type IngredientWithRelations = Ingredient & {
  category?: Category | null
  supplier?: Supplier | null
  fornecedorSecundario?: Supplier | null
  productItems?: ProductIngredient[]
  stockStatus?: StockStatus
}

export type ProductWithRelations = Product & {
  category?: Category | null
  ingredients?: (ProductIngredient & {
    ingredient: Ingredient
  })[]
}

export type IngredientMovementWithRelations = IngredientMovement & {
  ingredient?: Ingredient
}

export type ProductIngredientWithRelations = ProductIngredient & {
  ingredient: Ingredient
}

export type UserWithTenant = User & {
  tenant?: Tenant | null
}

export type DashboardStats = {
  totalIngredients: number
  lowStockIngredients: number
  totalProducts: number
  totalCategories: number
}

export type ProductCost = {
  cost: number
  margin: number
}

export type UserWithRole = User & {
  customRole?: { id: string; name: string; permissions: unknown; tenantId: string; isDefault: boolean; createdAt: Date; updatedAt: Date } | null
  tenant?: Tenant | null
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      tenantId: string
      tenantName: string
      brandId?: string | null
      customRoleId?: string
      avatarUrl?: string
      subscriptionStatus?: string | null
      trialEndsAt?: string | null
      planFeatures?: unknown
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    tenantId?: string
    tenantName?: string
    brandId?: string | null
    customRoleId?: string
    avatarUrl?: string
    subscriptionStatus?: string | null
    trialEndsAt?: string | null
    planFeatures?: unknown
    passwordChangedAt?: string | null
  }
}
