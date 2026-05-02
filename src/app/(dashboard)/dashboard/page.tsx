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
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">
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
        <div className="rounded-xl border border-red-800/50 bg-red-950/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-300 font-medium text-sm">
                Alerta de Estoque Baixo
              </p>
              <p className="text-red-400/70 text-xs mt-1">
                {lowStockIngredients} insumo{lowStockIngredients !== 1 ? 's' : ''} está{lowStockIngredients !== 1 ? 'o' : ''} abaixo do estoque mínimo.{' '}
                <a href="/estoque/insumos" className="underline hover:text-red-300">
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
