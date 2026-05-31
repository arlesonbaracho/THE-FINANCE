'use client'

import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { toast } from 'sonner'
import { Check, X, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Insumo {
  id: string
  name: string
}

interface Fornecedor {
  id: string
  name: string
}

interface ItemForm {
  descricao: string
  insumoId: string
  insumoNome: string
  scoreConfianca: number
  quantidade: number
  unidade: string
  custoUnitario: number
  incluir: boolean
}

interface FormValues {
  fornecedorNome: string
  numeroNf: string
  dataRecebimento: string
  itens: ItemForm[]
}

interface TabelaRevisaoNFProps {
  nfId: string
  dados: {
    fornecedor: string | null
    numeroNf: string | null
    dataEmissao: string | null
    valorTotal: number | null
    itensEnriquecidos: Array<{
      descricao: string
      quantidade: number
      unidade: string
      custoUnitario: number
      custoTotal: number
      insumoId: string | null
      insumoNome: string | null
      scoreConfianca: number
    }>
  }
  onConfirmed: () => void
}

function BadgeConfianca({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-green-100 text-green-800'
      : score >= 50
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-gray-100 text-gray-600'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${color}`}>
      {score}%
    </span>
  )
}

export function TabelaRevisaoNF({ nfId, dados, onConfirmed }: TabelaRevisaoNFProps) {
  const router = useRouter()
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [submitting, setSubmitting] = useState(false)

  const { register, control, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      fornecedorNome: dados.fornecedor ?? '',
      numeroNf: dados.numeroNf ?? '',
      dataRecebimento: new Date().toISOString().split('T')[0],
      itens: dados.itensEnriquecidos.map((item) => ({
        descricao: item.descricao,
        insumoId: item.insumoId ?? '',
        insumoNome: item.insumoNome ?? '',
        scoreConfianca: item.scoreConfianca,
        quantidade: item.quantidade,
        unidade: item.unidade,
        custoUnitario: item.custoUnitario,
        incluir: item.insumoId !== null,
      })),
    },
  })

  const { fields } = useFieldArray({ control, name: 'itens' })
  const itens = watch('itens')

  useEffect(() => {
    Promise.all([
      fetch('/api/ingredients').then((r) => r.json() as Promise<{ id: string; name: string }[]>),
      fetch('/api/suppliers').then((r) => r.json() as Promise<{ id: string; name: string }[]>),
    ]).then(([ins, fors]) => {
      setInsumos(Array.isArray(ins) ? ins : [])
      setFornecedores(Array.isArray(fors) ? fors : [])
    }).catch(() => {
      // Non-critical — user can still proceed without dropdowns populated
    })
  }, [])

  const itensIncluidos = itens.filter((i) => i.incluir)
  const valorTotal = itensIncluidos.reduce(
    (sum, i) => sum + i.quantidade * i.custoUnitario,
    0
  )

  async function onSubmit(values: FormValues) {
    const itensPayload = values.itens
      .filter((i) => i.incluir)
      .map((i) => ({
        insumoId: i.insumoId,
        quantidade: i.quantidade,
        custoUnitario: i.custoUnitario,
        incluir: true,
      }))

    if (itensPayload.length === 0) {
      toast.error('Inclua ao menos um item')
      return
    }

    const semInsumo = itensPayload.filter((i) => !i.insumoId)
    if (semInsumo.length > 0) {
      toast.error('Todos os itens incluídos precisam ter um insumo mapeado')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/estoque/entrada-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfId,
          fornecedorNome: values.fornecedorNome,
          numeroNf: values.numeroNf,
          dataRecebimento: values.dataRecebimento,
          itens: itensPayload,
        }),
      })

      const json = await res.json() as { ok?: boolean; error?: string; itensCriados?: number }
      if (!res.ok) {
        toast.error(json.error ?? 'Erro ao confirmar lançamento')
        return
      }

      toast.success(`${json.itensCriados} itens lançados com sucesso!`)
      onConfirmed()
      router.push('/estoque/notas-fiscais')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Global fields */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-card border border-border rounded-lg">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Fornecedor</label>
          <select
            {...register('fornecedorNome')}
            className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
          >
            <option value="">Selecione ou digite</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.name}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Nº NF</label>
          <input
            {...register('numeroNf')}
            className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
            placeholder="000001"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Data Recebimento</label>
          <input
            type="date"
            {...register('dataRecebimento')}
            className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
          />
        </div>
      </div>

      {/* Items table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Descrição original</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Insumo no sistema</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Qtd</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Un</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Custo unit.</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
              <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Incluir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {fields.map((field, idx) => {
              const item = itens[idx]
              return (
                <tr key={field.id} className={item?.incluir ? '' : 'opacity-50'}>
                  <td className="px-3 py-2 text-muted-foreground max-w-[160px]">
                    <span className="truncate block" title={field.descricao}>{field.descricao}</span>
                  </td>
                  <td className="px-3 py-2 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <select
                        {...register(`itens.${idx}.insumoId`)}
                        className="flex-1 border border-border rounded px-1.5 py-1 text-xs bg-background"
                        onChange={(e) => {
                          setValue(`itens.${idx}.insumoId`, e.target.value)
                          const ing = insumos.find((i) => i.id === e.target.value)
                          setValue(`itens.${idx}.insumoNome`, ing?.name ?? '')
                        }}
                      >
                        <option value="">Selecione...</option>
                        {insumos.map((i) => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                      <BadgeConfianca score={item?.scoreConfianca ?? 0} />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.001"
                      {...register(`itens.${idx}.quantidade`, { valueAsNumber: true })}
                      className="w-20 border border-border rounded px-1.5 py-1 text-xs text-right bg-background"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{field.unidade}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      {...register(`itens.${idx}.custoUnitario`, { valueAsNumber: true })}
                      className="w-24 border border-border rounded px-1.5 py-1 text-xs text-right bg-background"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {((item?.quantidade ?? 0) * (item?.custoUnitario ?? 0)).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => setValue(`itens.${idx}.incluir`, !item?.incluir)}
                      className={`w-6 h-6 rounded-full border flex items-center justify-center mx-auto transition-colors ${
                        item?.incluir
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {item?.incluir ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-lg">
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>Total de itens: <strong className="text-foreground">{itens.length}</strong></span>
          <span>Incluídos: <strong className="text-foreground">{itensIncluidos.length}</strong></span>
          <span>
            Valor total:{' '}
            <strong className="text-foreground">
              {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </strong>
          </span>
        </div>
        <button
          type="submit"
          disabled={submitting || itensIncluidos.length === 0}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Confirmar lançamento
        </button>
      </div>
    </form>
  )
}
