export type FuncaoOperacao = 'caixa' | 'cozinha' | 'garcom'

const PALETAS: Record<FuncaoOperacao, Record<string, string>> = {
  caixa: {
    pageBg: '#131009', surface: '#1a1608', surface2: '#130f07', border: '#2e2410', borderLight: '#1e1808',
    txt: '#f0ece8', txt2: '#dcd4c8', muted: '#604830', dim: '#503a20', subtle: '#7a6040',
    accent: '#b48a2a', accentLight: '#d4a84b', accentBg: '#2b1f0d',
    red: '#e05252', green: '#2a9d6f', amber: '#d97706', purple: '#6d4fc2',
  },
  cozinha: {
    pageBg: '#0f1714', surface: '#111a16', surface2: '#0d1410', border: '#1e2e26', borderLight: '#141e19',
    txt: '#e8f0ec', txt2: '#c8dcd2', muted: '#3d6050', dim: '#2d5040', subtle: '#5a7a6a',
    green: '#2a9d6f', greenLight: '#4bc994', greenBg: '#0d2b1f',
    red: '#e05252', redBg: '#1f0a0a',
  },
  garcom: {
    pageBg: '#0f0d18', surface: '#131020', surface2: '#0f0c1a', border: '#2a2550',
    txt: '#ede8f8', txt2: '#b8b0d8', muted: '#4a4570',
    accent: '#6d4fc2', accentLight: '#8b6fd4', accentBg: '#1a1530',
    green: '#2a9d6f', amber: '#d97706', purple: '#6d4fc2', red: '#e05252',
  },
}

const META: Record<FuncaoOperacao, { label: string; avatar: string }> = {
  caixa: { label: 'Caixa', avatar: '/Caixa.png' },
  cozinha: { label: 'Cozinha', avatar: '/Cozinheiro.png' },
  garcom: { label: 'Garçom', avatar: '/Garçom.png' },
}

export function temaOperacao(funcao: FuncaoOperacao): Record<string, string> {
  return PALETAS[funcao]
}

export function funcaoMeta(funcao: FuncaoOperacao): { label: string; avatar: string } {
  return META[funcao]
}
