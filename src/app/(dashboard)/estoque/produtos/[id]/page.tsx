'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ProductForm } from '@/components/products/product-form'
import { ProductIngredients } from '@/components/products/product-ingredients'
import { formatCurrency } from '@/lib/utils'
import {
  ArrowLeft,
  Pencil,
  TrendingUp,
  DollarSign,
  Tag,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ProductWithRelations } from '@/types'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [product, setProduct] = useState<ProductWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [cost, setCost] = useState(0)

  const fetchProduct = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${id}`)
      if (res.ok) {
        const data = await res.json()
        setProduct(data)
        const c = (data.ingredients ?? []).reduce(
          (sum: number, pi: { ingredient: { unitCost: number }; quantity: number }) =>
            sum + pi.ingredient.unitCost * pi.quantity,
          0
        )
        setCost(c)
      }
    } catch {
      toast.error('Erro ao carregar produto')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchProduct()
  }, [fetchProduct])

  async function toggleActive() {
    if (!product) return
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !product.active }),
      })
      if (res.ok) {
        toast.success(`Produto ${product.active ? 'desativado' : 'ativado'}`)
        fetchProduct()
      }
    } catch {
      toast.error('Erro ao alterar status')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Carregando...
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center text-zinc-500 py-12">
        <p>Produto não encontrado.</p>
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mt-4 border-zinc-700 text-zinc-300"
        >
          Voltar
        </Button>
      </div>
    )
  }

  const margin =
    product.salePrice > 0
      ? ((product.salePrice - cost) / product.salePrice) * 100
      : 0

  const marginColor =
    margin >= 60
      ? 'text-green-400'
      : margin >= 30
      ? 'text-yellow-400'
      : 'text-red-400'

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button
          onClick={() => router.back()}
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{product.name}</h1>
            <Badge
              className={
                product.active
                  ? 'bg-green-900/50 text-green-300 border border-green-800'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
              }
            >
              {product.active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          {product.category && (
            <p className="text-zinc-400 text-sm mt-1">{product.category.name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={toggleActive}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-2"
          >
            {product.active ? (
              <>
                <ToggleLeft className="w-4 h-4" />
                Desativar
              </>
            ) : (
              <>
                <ToggleRight className="w-4 h-4 text-green-400" />
                Ativar
              </>
            )}
          </Button>
          <Button
            onClick={() => setFormOpen(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Tag className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Preço de Venda</p>
                <p className="text-xl font-bold text-white">
                  {formatCurrency(product.salePrice)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <DollarSign className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Custo Calculado</p>
                <p className="text-xl font-bold text-white">{formatCurrency(cost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Margem de Lucro</p>
                <p className={`text-xl font-bold ${marginColor}`}>
                  {margin.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg">Composição do Produto</CardTitle>
          <p className="text-zinc-400 text-sm">
            Insumos utilizados na preparação deste produto
          </p>
        </CardHeader>
        <Separator className="bg-zinc-800" />
        <CardContent className="pt-4">
          <ProductIngredients
            productId={product.id}
            onCostChange={setCost}
          />
        </CardContent>
      </Card>

      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={product}
        onSuccess={fetchProduct}
      />
    </div>
  )
}
