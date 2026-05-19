import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { StatCard } from '@/components/ui/stat-card'
import { Package, AlertTriangle, ShoppingBasket, Tag } from 'lucide-react'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.tenantId) {
    redirect('/auth/login')
  }

  const tenantId = session.user.tenantId

  const [totalIngredients, allIngredients, totalProducts, totalCategories] = await Promise.all([
    prisma.ingredient.count({ where: { tenantId } }),
    prisma.ingredient.findMany({
      where: { tenantId },
      select: { currentQty: true, minimumQty: true },
    }),
    prisma.product.count({ where: { tenantId } }),
    prisma.category.count({ where: { tenantId } }),
  ])

  const lowStockIngredients = allIngredients.filter(
    (i: { currentQty: number; minimumQty: number }) => i.currentQty <= i.minimumQty
  ).length

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--tf-txt)', margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--tf-txt3)', marginTop: 3 }}>
          Visão geral do seu estabelecimento
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Insumos"
          value={totalIngredients}
          description="Ingredientes cadastrados"
          icon={ShoppingBasket}
          variant="default"
        />
        <StatCard
          title="Estoque Baixo"
          value={lowStockIngredients}
          description="Insumos abaixo do mínimo"
          icon={AlertTriangle}
          variant={lowStockIngredients > 0 ? 'danger' : 'success'}
        />
        <StatCard
          title="Total de Produtos"
          value={totalProducts}
          description="Itens no cardápio"
          icon={Package}
          variant="default"
        />
        <StatCard
          title="Categorias"
          value={totalCategories}
          description="Categorias cadastradas"
          icon={Tag}
          variant="default"
        />
      </div>

      {lowStockIngredients > 0 && (
        <div
          style={{
            borderRadius: 10,
            border: '1px solid var(--tf-red-bd)',
            background: 'var(--tf-red-bg)',
            padding: 16,
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-5 h-5 mt-0.5 flex-shrink-0"
              style={{ color: 'var(--tf-red)' }}
            />
            <div>
              <p className="font-medium text-sm" style={{ color: 'var(--tf-red)' }}>
                Alerta de Estoque Baixo
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--tf-txt2)' }}>
                {lowStockIngredients} insumo{lowStockIngredients !== 1 ? 's' : ''} está{lowStockIngredients !== 1 ? 'o' : ''} abaixo do estoque mínimo.{' '}
                <a href="/estoque/insumos" className="underline" style={{ color: 'var(--tf-red)' }}>
                  Ver insumos
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
