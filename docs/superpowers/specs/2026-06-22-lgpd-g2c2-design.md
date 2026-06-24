# Spec: LGPD — Ferramentas do operador sobre dados do cliente final (Sub-projeto G2c-2)

**Data:** 2026-06-22
**Status:** Aprovado (via brainstorming)

---

## Contexto

A plataforma é **operadora** dos dados dos clientes finais do restaurante; o **controlador** é o tenant. O G2c-2 dá ao restaurante a ferramenta para atender pedidos de **acesso/portabilidade** e **eliminação** dos dados de um cliente final, buscando por **telefone** (não há entidade "Cliente" canônica). Fontes cobertas: `Reserva` (clienteNome/contato), `WhatsAppContato` (nome/numero), `WhatsAppLog` (destinatario/conteudo).

## Decisões (confirmadas)

- **Fontes:** 3 tabelas limpas — `Reserva`, `WhatsAppContato`, `WhatsAppLog`. Endereço iFood (`IFoodPedido.enderecoEntrega` Json) **fora** (frágil + registro fiscal).
- **Exclusão = hard-delete** das 3 (nenhuma tem retenção fiscal; sem FK operacional apontando).
- **Busca:** por telefone normalizado (só dígitos), tenant-scoped; nome casa em `Reserva.clienteNome` como secundário.
- **Acesso:** admin/MANAGER.
- **Log de acesso a PII** dessas operações → **G2c-3** (não aqui).

## Componentes

### 1. Serviço `src/services/lgpd/cliente-dados.service.ts`
- `normalizarTelefone(tel: string): string` — remove tudo que não é dígito (puro, testável).
- `buscarDadosCliente(tenantId: string, telefone: string, nome?: string): Promise<DadosCliente>`:
  - Busca tenant-scoped: `prisma.reserva.findMany({ where: { tenantId } })`, `whatsAppContato.findMany({ where: { tenantId } })`, `whatsAppLog.findMany({ where: { tenantId } })` — então filtra em JS: registro casa se `normalizarTelefone(campoTelefone).includes(telNorm)` (campo: Reserva.contato, WhatsAppContato.numero, WhatsAppLog.destinatario). Reserva também casa se `nome` informado e `clienteNome` contém (case-insensitive). `telNorm` vazio (< 4 dígitos) → retorna vazio (evita casar tudo).
  - Retorna `{ reservas, contatosWhatsapp, logsWhatsapp }` (cada uma array dos registros casados, com `id`).
- `exportarDadosCliente(tenantId, telefone, nome?)` → o resultado de `buscarDadosCliente` como objeto serializável.
- `excluirDadosCliente(tenantId, telefone, nome?): Promise<{ reservas: number; contatos: number; logs: number }>`:
  - Reusa `buscarDadosCliente` para coletar os ids casados; `deleteMany({ where: { id: { in: ids }, tenantId } })` em cada tabela (tenant-scoped por garantia); retorna contagens. Se nenhum id, contagens 0 (não chama deleteMany sem ids ou chama com `in: []` — `in: []` apaga nada, seguro).

### 2. Rotas (admin/MANAGER; `getSession`, tenant-scoped)
- `GET /api/clientes/dados?telefone=...&nome=...` — 401/403 guards; retorna `buscarDadosCliente`.
- `GET /api/clientes/dados/exportar?telefone=...&nome=...` — JSON `Content-Disposition: attachment; filename="dados-cliente.json"`.
- `POST /api/clientes/dados/excluir` `{ telefone, nome? }` — chama `excluirDadosCliente`, retorna contagens.
- Guard `isAdminOuManager(role)` = role ∈ {SUPER_ADMIN, ADMIN, MANAGER}.

### 3. UI — `src/app/(dashboard)/configuracoes/dados-clientes/page.tsx`
Client component (admin/MANAGER): input telefone (+ nome opcional) → "Buscar" → preview agrupado (reservas / contatos WhatsApp / mensagens). Botões: **"Exportar (JSON)"** (download) e **"Excluir dados"** (confirmação digitando `EXCLUIR`; mostra contagens apagadas). Estados loading/erro/vazio. Link "Dados de Clientes" na sidebar (grupo Configurações).

### 4. Testes (vitest)
- `normalizarTelefone`: `'(11) 99999-8888'`→`'11999998888'`; vazio/símbolos.
- `buscarDadosCliente`: casa por telefone normalizado nas 3 fontes; ignora registros de telefone diferente; tenant-scoped (where inclui tenantId); telefone curto → vazio.
- `excluirDadosCliente`: `deleteMany` chamado com `{ id: { in: idsCasados }, tenantId }` nas 3 tabelas; retorna contagens.
- Rota `excluir`: 403 não-admin; 200 admin.
- Regressão: suíte verde; tsc/lint limpos.

## Arquivos afetados (previsto)
| Arquivo | Mudança |
|---|---|
| `src/services/lgpd/cliente-dados.service.ts` (+ teste) | busca/export/exclusão |
| `src/app/api/clientes/dados/route.ts` | preview |
| `src/app/api/clientes/dados/exportar/route.ts` | download JSON |
| `src/app/api/clientes/dados/excluir/route.ts` (+ teste) | exclusão |
| `src/app/(dashboard)/configuracoes/dados-clientes/page.tsx` | UI |
| `src/components/layout/sidebar.tsx` | link na navegação |

## Critérios de aceite
- [ ] Operador busca por telefone e vê reservas/contatos/mensagens do cliente (tenant-scoped).
- [ ] Exporta JSON; exclui (hard-delete) as 3 fontes, retornando contagens.
- [ ] Tenant-scoped + admin/MANAGER (sem vazar/excluir dados de outro tenant).
- [ ] Testes verdes; tsc/lint limpos.

## Fora de escopo
Endereço iFood (Json). Log de acesso a PII (G2c-3). Anonimização parcial (escolhido hard-delete). Busca difusa por nome avançada.
