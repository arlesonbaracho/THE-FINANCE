import type { Ingredient, Category, Supplier, Product, ProductIngredient, IngredientMovement, Tenant, User, UserRole, Unit, MovementType, CategoryType } from '@prisma/client'

export type { UserRole, Unit, MovementType, CategoryType }

export type IngredientWithRelations = Ingredient & {
  category?: Category | null
  supplier?: Supplier | null
  productItems?: ProductIngredient[]
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
    }
  }
}
