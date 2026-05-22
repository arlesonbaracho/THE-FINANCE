// Client-safe: no server imports here

export const PERMISSIONS = {
  // Estoque
  ESTOQUE_VER: 'estoque.ver',
  ESTOQUE_CRIAR: 'estoque.criar',
  ESTOQUE_EDITAR: 'estoque.editar',
  ESTOQUE_DELETAR: 'estoque.deletar',
  ESTOQUE_MOVIMENTAR: 'estoque.movimentar',
  // Produtos
  PRODUTOS_VER: 'produtos.ver',
  PRODUTOS_CRIAR: 'produtos.criar',
  PRODUTOS_EDITAR: 'produtos.editar',
  PRODUTOS_DELETAR: 'produtos.deletar',
  // Usuários
  USUARIOS_VER: 'usuarios.ver',
  USUARIOS_GERENCIAR: 'usuarios.gerenciar',
  // Relatórios
  RELATORIOS_VER: 'relatorios.ver',
  // Configurações
  CONFIGURACOES_VER: 'configuracoes.ver',
  CONFIGURACOES_EDITAR: 'configuracoes.editar',
  // Pedidos / Cozinha
  COZINHA_VER: 'cozinha.ver',
  COZINHA_GERENCIAR: 'cozinha.gerenciar',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

const ALL: Permission[] = Object.values(PERMISSIONS)

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN_RESTAURANTE: ALL,
  GERENTE: [
    PERMISSIONS.ESTOQUE_VER,
    PERMISSIONS.ESTOQUE_CRIAR,
    PERMISSIONS.ESTOQUE_EDITAR,
    PERMISSIONS.ESTOQUE_MOVIMENTAR,
    PERMISSIONS.PRODUTOS_VER,
    PERMISSIONS.PRODUTOS_CRIAR,
    PERMISSIONS.PRODUTOS_EDITAR,
    PERMISSIONS.USUARIOS_VER,
    PERMISSIONS.RELATORIOS_VER,
    PERMISSIONS.CONFIGURACOES_VER,
    PERMISSIONS.COZINHA_VER,
    PERMISSIONS.COZINHA_GERENCIAR,
  ],
  CAIXA: [
    PERMISSIONS.PRODUTOS_VER,
    PERMISSIONS.ESTOQUE_VER,
    PERMISSIONS.COZINHA_VER,
  ],
  COZINHEIRO: [
    PERMISSIONS.COZINHA_VER,
    PERMISSIONS.COZINHA_GERENCIAR,
    PERMISSIONS.ESTOQUE_VER,
  ],
  ESTOQUISTA: [
    PERMISSIONS.ESTOQUE_VER,
    PERMISSIONS.ESTOQUE_CRIAR,
    PERMISSIONS.ESTOQUE_EDITAR,
    PERMISSIONS.ESTOQUE_MOVIMENTAR,
    PERMISSIONS.PRODUTOS_VER,
    PERMISSIONS.RELATORIOS_VER,
  ],
}

export const DEFAULT_ROLE_NAMES = Object.keys(DEFAULT_ROLE_PERMISSIONS)
