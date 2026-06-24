import { expurgarDadosAntigos } from '@/services/lgpd/expurgo.service'

export async function processExpurgoJob(): Promise<void> {
  const retencaoLogsMeses = parseInt(process.env.RETENCAO_LOGS_MESES ?? '12', 10)
  const r = await expurgarDadosAntigos({ retencaoLogsMeses })
  console.log(
    `[lgpd-expurgo] códigos=${r.codigosVerificacao} tokens=${r.tokensReset} ` +
    `logsAcesso=${r.logsAcesso} logsWhatsapp=${r.logsWhatsapp} logsPii=${r.logsPii}`,
  )
}
