import { ShieldX } from 'lucide-react'

export default function PlanoBloqueadoPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
        <ShieldX className="h-8 w-8 text-red-600" />
      </div>
      <h1 className="text-2xl font-bold">Acesso Bloqueado</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Sua assinatura está suspensa ou cancelada. Entre em contato com o suporte para regularizar e reativar o acesso.
      </p>
      <a
        href="mailto:suporte@thefinance.app"
        className="mt-6 inline-block rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
      >
        Falar com o suporte
      </a>
    </div>
  )
}
