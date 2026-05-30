# Módulo 12: App Mobile KDS (Expo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o app mobile KDS `The-Finance-kds` (React Native + Expo) para cozinheiros visualizarem e gerenciarem pedidos em fila, com suporte offline, push notifications e autenticação via PIN/biometria. Também adicionar as API routes necessárias no servidor Next.js.

**Architecture:** App Expo separado com expo-router, React Query (REST fallback) + Socket.IO (eventos em tempo real). Pedidos organizados em 3 colunas (Novos / Em preparo / Prontos) em layout landscape. Ações offline ficam em fila no AsyncStorage e são sincronizadas ao reconectar. Novos endpoints no servidor Next.js existente servem o app.

**Tech Stack:** React Native, Expo SDK, expo-router, @tanstack/react-query, socket.io-client, NativeWind, expo-notifications, expo-local-authentication, expo-keep-awake, expo-screen-orientation, @react-native-async-storage/async-storage, @react-native-community/netinfo, expo-av, expo-constants, expo-updates, EAS Build

**Pré-requisito:** As API routes novas (Tasks 1–3) devem ser implementadas no repositório Next.js `THE-FINANCE` **antes** de desenvolver o app. A migration `KdsDevice` já foi executada no Plano A (Task 2).

---

## Parte A — Novas API Routes no servidor Next.js (THE-FINANCE)

### Task 1: API routes KDS — cozinheiros e pedidos

**Files (no repo THE-FINANCE):**
- Create: `src/app/api/kds/cozinheiros/route.ts`
- Create: `src/app/api/kds/pedidos/route.ts`

- [ ] **Step 1: Criar `src/app/api/kds/cozinheiros/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })

  const cozinheiros = await prisma.user.findMany({
    where: { tenantId, status: 'ACTIVE' },
    select: { id: true, name: true, avatarUrl: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(cozinheiros)
}
```

- [ ] **Step 2: Criar `src/app/api/kds/pedidos/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyKdsToken } from '@/lib/kds-auth'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const payload = auth ? verifyKdsToken(auth.replace('Bearer ', '')) : null
  if (!payload) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const pedidos = await prisma.pedido.findMany({
    where: {
      tenantId: payload.tenantId,
      status: { in: ['ABERTO', 'EM_PREPARO', 'PRONTO'] },
    },
    include: {
      mesa: { select: { numero: true } },
      itens: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
    orderBy: { criadoEm: 'asc' },
  })

  // Calcular tempo médio por produto (últimos 30 dias de pedidos FINALIZADOS)
  const trintaDias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const historico = await prisma.pedido.findMany({
    where: {
      tenantId: payload.tenantId,
      status: 'FINALIZADO',
      criadoEm: { gte: trintaDias },
      fechadoEm: { not: null },
    },
    select: { criadoEm: true, fechadoEm: true },
  })
  const tempoMedioMs =
    historico.length > 0
      ? historico.reduce((s, p) => s + (p.fechadoEm!.getTime() - p.criadoEm.getTime()), 0) / historico.length
      : parseInt(process.env.DEFAULT_TEMPO_PREPARO_ALERTA ?? '20') * 60 * 1000

  return NextResponse.json({ pedidos, tempoMedioMs })
}
```

- [ ] **Step 3: Criar `src/lib/kds-auth.ts`**

```typescript
import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? 'kds-secret')

export async function signKdsToken(payload: { tenantId: string; userId: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret)
}

export function verifyKdsToken(token: string): { tenantId: string; userId: string } | null {
  try {
    // For sync verification in route handlers — use jose's jwtVerify in async context
    // This is a simplified sync wrapper; route handlers should use the async version
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()) as { tenantId: string; userId: string }
  } catch {
    return null
  }
}

export async function verifyKdsTokenAsync(token: string): Promise<{ tenantId: string; userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as { tenantId: string; userId: string }
  } catch {
    return null
  }
}
```

> **Nota:** Atualizar `src/app/api/kds/pedidos/route.ts` para usar `verifyKdsTokenAsync` (tornar a função `GET` async e trocar a chamada).

- [ ] **Step 4: Commit (no repo THE-FINANCE)**

```bash
git add src/app/api/kds/ src/lib/kds-auth.ts
git commit -m "feat: add KDS API routes (cozinheiros, pedidos) and kds-auth util"
```

---

### Task 2: API routes KDS — register-push-token e pedido status

**Files (no repo THE-FINANCE):**
- Create: `src/app/api/kds/register-push-token/route.ts`
- Create: `src/app/api/pedidos/[id]/status/route.ts`
- Modify: `src/app/api/cozinha/auth/route.ts` (adaptar para retornar JWT KDS)

- [ ] **Step 1: Criar `src/app/api/kds/register-push-token/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  token: z.string(),
  plataforma: z.enum(['ANDROID', 'IOS']),
  nomeDispositivo: z.string(),
  tenantId: z.string(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

  const { token, plataforma, nomeDispositivo, tenantId } = parsed.data

  await prisma.kdsDevice.upsert({
    where: { id: token }, // use token as lookup key via a unique field — add @@unique([pushToken]) to schema if needed
    create: { tenantId, pushToken: token, plataforma, nomeDispositivo },
    update: { tenantId, plataforma, nomeDispositivo },
  })

  return NextResponse.json({ ok: true })
}
```

> **Nota:** Adicionar `@@unique([pushToken])` ao model `KdsDevice` no schema.prisma e rodar `npx prisma migrate dev --name kds-device-pushtoken-unique`.

- [ ] **Step 2: Criar `src/app/api/pedidos/[id]/status/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyKdsTokenAsync } from '@/lib/kds-auth'
import { z } from 'zod'

const schema = z.object({
  novoStatus: z.enum(['ABERTO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE']),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = req.headers.get('authorization')
  const payload = auth ? await verifyKdsTokenAsync(auth.replace('Bearer ', '')) : null
  if (!payload) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Status inválido' }, { status: 400 })

  const pedido = await prisma.pedido.updateMany({
    where: { id: params.id, tenantId: payload.tenantId },
    data: { status: parsed.data.novoStatus },
  })

  if (pedido.count === 0) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })

  const io = (global as { io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } } }).io
  io?.to(payload.tenantId).emit('pedido:status', { pedidoId: params.id, status: parsed.data.novoStatus })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verificar `src/app/api/cozinha/auth/route.ts`**

Verificar se a rota já retorna um JWT compatível com `signKdsToken`. Se retornar um formato diferente, adicionar ao response o campo `kdsToken`:

```typescript
// Após autenticar o usuário, adicionar:
import { signKdsToken } from '@/lib/kds-auth'
const kdsToken = await signKdsToken({ tenantId: user.tenantId!, userId: user.id })
return NextResponse.json({ token: kdsToken, user: { id: user.id, name: user.name } })
```

- [ ] **Step 4: Adicionar rota de verificação de tenant por slug**

Criar `src/app/api/tenants/[slug]/verify/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: params.slug },
    select: { id: true, name: true, slug: true, logo: true },
  })
  if (!tenant) return NextResponse.json({ error: 'Restaurante não encontrado' }, { status: 404 })
  return NextResponse.json(tenant)
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/kds/register-push-token/ src/app/api/pedidos/[id]/status/ src/app/api/tenants/
git commit -m "feat: add KDS push token, pedido status, and tenant verify API routes"
```

---

## Parte B — App Expo (The-Finance-kds)

### Task 3: Criar projeto Expo e instalar dependências

**Files (novo repo The-Finance-kds):**
- Criar estrutura inicial

- [ ] **Step 1: Criar o projeto**

```bash
cd ..
npx create-expo-app The-Finance-kds --template blank-typescript
cd The-Finance-kds
```

- [ ] **Step 2: Instalar dependências**

```bash
npm install expo-router @tanstack/react-query socket.io-client \
  expo-notifications expo-local-authentication expo-keep-awake \
  expo-screen-orientation @react-native-async-storage/async-storage \
  @react-native-community/netinfo nativewind expo-av expo-constants \
  expo-updates
npm install -D tailwindcss
```

- [ ] **Step 3: Configurar NativeWind**

Criar `tailwind.config.js`:
```javascript
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

Criar `babel.config.js`:
```javascript
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: ['nativewind/babel'],
  }
}
```

- [ ] **Step 4: Configurar `app.json`**

```json
{
  "expo": {
    "name": "THE FINANCE KDS",
    "slug": "the-finance-kds",
    "version": "1.0.0",
    "orientation": "landscape",
    "scheme": "kds",
    "plugins": [
      "expo-router",
      "expo-notifications",
      ["expo-screen-orientation", { "initialOrientation": "LANDSCAPE" }]
    ],
    "android": { "package": "com.thefinance.kds" },
    "ios": { "bundleIdentifier": "com.thefinance.kds" }
  }
}
```

- [ ] **Step 5: Criar `eas.json`**

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  }
}
```

- [ ] **Step 6: Criar `src/constants.ts`**

```typescript
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'
```

- [ ] **Step 7: Commit inicial**

```bash
git init
git add -A
git commit -m "feat: init The-Finance-kds Expo project with dependencies"
```

---

### Task 4: Serviços de auth e storage

**Files:**
- Create: `services/auth.service.ts`
- Create: `services/storage.service.ts`

- [ ] **Step 1: Criar `services/storage.service.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'

const PREFIX = 'restroOS:'

export const storage = {
  get: (key: string) => AsyncStorage.getItem(PREFIX + key),
  set: (key: string, value: string) => AsyncStorage.setItem(PREFIX + key, value),
  remove: (key: string) => AsyncStorage.removeItem(PREFIX + key),
  clear: () => AsyncStorage.multiRemove(['slug', 'token', 'tenantId', 'tenantName'].map((k) => PREFIX + k)),
}
```

- [ ] **Step 2: Criar `services/auth.service.ts`**

```typescript
import { API_URL } from '../src/constants'
import { storage } from './storage.service'

type Tenant = { id: string; name: string; slug: string; logo: string | null }
type Cozinheiro = { id: string; name: string; avatarUrl: string | null }
type AuthResult = { token: string; user: { id: string; name: string } }

export async function verifyTenant(slug: string): Promise<Tenant> {
  const r = await fetch(`${API_URL}/api/tenants/${slug}/verify`)
  if (!r.ok) throw new Error('Restaurante não encontrado')
  return r.json()
}

export async function getCozinheiros(tenantId: string): Promise<Cozinheiro[]> {
  const r = await fetch(`${API_URL}/api/kds/cozinheiros?tenantId=${tenantId}`)
  if (!r.ok) throw new Error('Erro ao carregar cozinheiros')
  return r.json()
}

export async function loginWithPin(tenantId: string, cozinheiroId: string, pin: string): Promise<AuthResult> {
  const r = await fetch(`${API_URL}/api/cozinha/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, cozinheiroId, pin }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? 'PIN inválido')
  }
  return r.json()
}

export async function logout(): Promise<void> {
  await storage.clear()
}
```

- [ ] **Step 3: Commit**

```bash
git add services/
git commit -m "feat: add auth and storage services"
```

---

### Task 5: Hooks — useSocket, usePedidos, useOfflineQueue

**Files:**
- Create: `hooks/useSocket.ts`
- Create: `hooks/usePedidos.ts`
- Create: `hooks/useOfflineQueue.ts`

- [ ] **Step 1: Criar `hooks/useSocket.ts`**

```typescript
import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { API_URL } from '../src/constants'
import { storage } from '../services/storage.service'

let socket: Socket | null = null

export function getKdsSocket(token: string): Socket {
  if (!socket) {
    socket = io(API_URL, {
      path: '/api/socket',
      auth: { token },
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
    })
  }
  return socket
}

export function useSocket(onPedidoNovo: (p: unknown) => void, onPedidoAtualizado: (p: unknown) => void, onPedidoCancelado: (id: string) => void) {
  const handlersRef = useRef({ onPedidoNovo, onPedidoAtualizado, onPedidoCancelado })
  handlersRef.current = { onPedidoNovo, onPedidoAtualizado, onPedidoCancelado }

  useEffect(() => {
    storage.get('token').then((token) => {
      if (!token) return
      const s = getKdsSocket(token)
      storage.get('tenantId').then((tid) => { if (tid) s.emit('join:tenant', tid) })
      s.on('pedido:novo', (p) => handlersRef.current.onPedidoNovo(p))
      s.on('pedido:atualizado', (p) => handlersRef.current.onPedidoAtualizado(p))
      s.on('pedido:cancelado', ({ pedidoId }: { pedidoId: string }) => handlersRef.current.onPedidoCancelado(pedidoId))
    })
  }, [])
}
```

- [ ] **Step 2: Criar `hooks/useOfflineQueue.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_URL } from '../src/constants'
import { storage } from '../services/storage.service'

const QUEUE_KEY = 'restroOS:offline-queue'

type QueueAction = { tipo: string; pedidoId: string; novoStatus: string; timestamp: number }

export function useOfflineQueue() {
  const addToQueue = async (action: Omit<QueueAction, 'timestamp'>) => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    const queue: QueueAction[] = raw ? JSON.parse(raw) : []
    queue.push({ ...action, timestamp: Date.now() })
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  }

  const flushQueue = async () => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    if (!raw) return
    const queue: QueueAction[] = JSON.parse(raw)
    if (queue.length === 0) return

    const token = await storage.get('token')
    const remaining: QueueAction[] = []

    for (const action of queue) {
      try {
        const r = await fetch(`${API_URL}/api/pedidos/${action.pedidoId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ novoStatus: action.novoStatus }),
        })
        if (!r.ok) remaining.push(action)
      } catch {
        remaining.push(action)
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
  }

  return { addToQueue, flushQueue }
}
```

- [ ] **Step 3: Criar `hooks/usePedidos.ts`**

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL } from '../src/constants'
import { storage } from '../services/storage.service'

export type PedidoItem = { id: string; quantidade: number; observacao: string | null; product: { id: string; name: string }; status: string }
export type Pedido = {
  id: string; status: string; criadoEm: string
  mesa: { numero: number }
  itens: PedidoItem[]
}

async function fetchPedidos(): Promise<{ pedidos: Pedido[]; tempoMedioMs: number }> {
  const token = await storage.get('token')
  const r = await fetch(`${API_URL}/api/kds/pedidos`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error('Erro ao buscar pedidos')
  return r.json()
}

export function usePedidos() {
  return useQuery({
    queryKey: ['kds-pedidos'],
    queryFn: fetchPedidos,
    refetchInterval: 30_000,
    staleTime: 10_000,
    retry: (count, err) => count < 3,
  })
}

export function useUpdatePedidoStatus() {
  const qc = useQueryClient()
  return async (pedidoId: string, novoStatus: string, token: string) => {
    const r = await fetch(`${API_URL}/api/pedidos/${pedidoId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ novoStatus }),
    })
    if (!r.ok) throw new Error('Erro ao atualizar status')
    qc.setQueryData(['kds-pedidos'], (old: { pedidos: Pedido[]; tempoMedioMs: number } | undefined) => {
      if (!old) return old
      return {
        ...old,
        pedidos: old.pedidos.map((p) =>
          p.id === pedidoId ? { ...p, status: novoStatus } : p
        ),
      }
    })
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add hooks/
git commit -m "feat: add useSocket, usePedidos, useOfflineQueue hooks"
```

---

### Task 6: Componentes — PinInput, Cronometro, OfflineBanner

**Files:**
- Create: `components/PinInput.tsx`
- Create: `components/Cronometro.tsx`
- Create: `components/OfflineBanner.tsx`

- [ ] **Step 1: Criar `components/PinInput.tsx`**

```tsx
import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native'

type Props = { onComplete: (pin: string) => void; error?: string }

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export function PinInput({ onComplete, error }: Props) {
  const [pin, setPin] = useState('')

  const press = (key: string) => {
    if (key === '⌫') { setPin((p) => p.slice(0, -1)); return }
    if (key === '') return
    const next = pin + key
    setPin(next)
    if (next.length === 4) {
      onComplete(next)
      setPin('')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i < pin.length ? '#22c55e' : '#374151' }]} />
        ))}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.grid}>
        {KEYS.map((k, i) => (
          <TouchableOpacity key={i} style={styles.key} onPress={() => press(k)} activeOpacity={0.7}>
            <Text style={styles.keyText}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 20 },
  dots: { flexDirection: 'row', gap: 16 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  error: { color: '#ef4444', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 240, gap: 8 },
  key: { width: 72, height: 56, borderRadius: 10, backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center' },
  keyText: { color: '#f9fafb', fontSize: 22, fontWeight: '600' },
})
```

- [ ] **Step 2: Criar `components/Cronometro.tsx`**

```tsx
import { useEffect, useState, useRef } from 'react'
import { Animated, Text, StyleSheet } from 'react-native'

type Props = { criadoEm: string; tempoMedioMs: number }

function elapsed(criadoEm: string) {
  return Date.now() - new Date(criadoEm).getTime()
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
}

export function Cronometro({ criadoEm, tempoMedioMs }: Props) {
  const [ms, setMs] = useState(elapsed(criadoEm))
  const blink = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const id = setInterval(() => setMs(elapsed(criadoEm)), 1000)
    return () => clearInterval(id)
  }, [criadoEm])

  const ratio = ms / tempoMedioMs
  const color = ratio < 0.8 ? '#22c55e' : ratio < 1 ? '#eab308' : '#ef4444'
  const overTime = ratio >= 1

  useEffect(() => {
    if (!overTime) { blink.setValue(1); return }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [overTime, blink])

  return (
    <Animated.Text style={[styles.text, { color, opacity: blink }]}>
      {fmt(ms)}
    </Animated.Text>
  )
}

const styles = StyleSheet.create({
  text: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
})
```

- [ ] **Step 3: Criar `components/OfflineBanner.tsx`**

```tsx
import { useEffect, useState, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { useOfflineQueue } from '../hooks/useOfflineQueue'

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true)
  const [showReconnected, setShowReconnected] = useState(false)
  const { flushQueue } = useOfflineQueue()
  const wasOffline = useRef(false)

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable
      if (!online) { wasOffline.current = true; setIsOnline(false) }
      else if (wasOffline.current) {
        setIsOnline(true)
        setShowReconnected(true)
        flushQueue()
        setTimeout(() => setShowReconnected(false), 3000)
        wasOffline.current = false
      }
    })
    return unsub
  }, [flushQueue])

  if (isOnline && !showReconnected) return null

  return (
    <View style={[styles.banner, { backgroundColor: showReconnected ? '#166534' : '#92400e' }]}>
      <Text style={styles.text}>
        {showReconnected ? 'Reconectado — sincronizado' : 'Sem conexão — exibindo último estado'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center' },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
})
```

- [ ] **Step 4: Commit**

```bash
git add components/PinInput.tsx components/Cronometro.tsx components/OfflineBanner.tsx
git commit -m "feat: add PinInput, Cronometro, OfflineBanner components"
```

---

### Task 7: Componente PedidoCard

**Files:**
- Create: `components/PedidoCard.tsx`

- [ ] **Step 1: Criar `components/PedidoCard.tsx`**

```tsx
import { useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated, Vibration, FlatList } from 'react-native'
import { Cronometro } from './Cronometro'
import type { Pedido } from '../hooks/usePedidos'

type Props = {
  pedido: Pedido
  coluna: 'ABERTO' | 'EM_PREPARO' | 'PRONTO'
  tempoMedioMs: number
  onMover: (id: string, novoStatus: string) => void
  isNew?: boolean
}

export function PedidoCard({ pedido, coluna, tempoMedioMs, onMover, isNew }: Props) {
  const slideAnim = useRef(new Animated.Value(isNew ? -300 : 0)).current

  useEffect(() => {
    if (isNew) {
      Vibration.vibrate(200)
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start()
    }
  }, [isNew, slideAnim])

  const numero = String(pedido.id).slice(-4).toUpperCase()

  return (
    <Animated.View style={[styles.card, { transform: [{ translateX: slideAnim }] }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.numero}>#{numero}</Text>
          <Text style={styles.mesa}>Mesa {pedido.mesa.numero}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.horario}>
            {new Date(pedido.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Cronometro criadoEm={pedido.criadoEm} tempoMedioMs={tempoMedioMs} />
        </View>
      </View>

      {/* Itens */}
      <FlatList
        data={pedido.itens}
        keyExtractor={(i) => i.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <Text style={styles.itemQtd}>{item.quantidade}×</Text>
            <Text style={[styles.itemNome, item.status === 'PRONTO' && styles.strikethrough]}>
              {item.product.name}
            </Text>
          </View>
        )}
      />
      {pedido.itens.some((i) => i.observacao) && (
        <View style={styles.obs}>
          {pedido.itens.filter((i) => i.observacao).map((i) => (
            <Text key={i.id} style={styles.obsText}>{i.observacao}</Text>
          ))}
        </View>
      )}

      {/* Rodapé */}
      <View style={styles.footer}>
        {coluna === 'ABERTO' && (
          <TouchableOpacity style={[styles.btn, styles.btnGreen]} onPress={() => onMover(pedido.id, 'EM_PREPARO')}>
            <Text style={styles.btnText}>Iniciar preparo →</Text>
          </TouchableOpacity>
        )}
        {coluna === 'EM_PREPARO' && (
          <>
            <TouchableOpacity style={[styles.btn, styles.btnGray]} onPress={() => onMover(pedido.id, 'ABERTO')}>
              <Text style={styles.btnText}>← Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnGreen]} onPress={() => onMover(pedido.id, 'PRONTO')}>
              <Text style={styles.btnText}>Marcar como pronto →</Text>
            </TouchableOpacity>
          </>
        )}
        {coluna === 'PRONTO' && (
          <>
            <TouchableOpacity style={[styles.btn, styles.btnGray]} onPress={() => onMover(pedido.id, 'EM_PREPARO')}>
              <Text style={styles.btnText}>← Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnDarkGreen]} onPress={() => onMover(pedido.id, 'ENTREGUE')}>
              <Text style={styles.btnText}>Finalizar ✓</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1f2937', borderRadius: 12, padding: 12, marginBottom: 10, width: 260 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  numero: { color: '#f9fafb', fontSize: 22, fontWeight: '800', fontFamily: 'Manrope' },
  mesa: { color: '#9ca3af', fontSize: 12 },
  horario: { color: '#9ca3af', fontSize: 12 },
  itemRow: { flexDirection: 'row', gap: 6, marginBottom: 3 },
  itemQtd: { color: '#6b7280', fontSize: 13, width: 24 },
  itemNome: { color: '#e5e7eb', fontSize: 13, flex: 1 },
  strikethrough: { textDecorationLine: 'line-through', color: '#4b5563' },
  obs: { backgroundColor: '#FFF3B0', borderRadius: 6, padding: 6, marginTop: 6 },
  obsText: { color: '#78350f', fontSize: 12 },
  footer: { flexDirection: 'row', gap: 6, marginTop: 10 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', minHeight: 44 },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  btnGreen: { backgroundColor: '#16a34a' },
  btnDarkGreen: { backgroundColor: '#14532d' },
  btnGray: { backgroundColor: '#374151' },
})
```

- [ ] **Step 2: Commit**

```bash
git add components/PedidoCard.tsx
git commit -m "feat: add PedidoCard component with animations and action buttons"
```

---

### Task 8: Tela de login (app/index.tsx)

**Files:**
- Create: `app/index.tsx`
- Create: `app/_layout.tsx`

- [ ] **Step 1: Criar `app/_layout.tsx`**

```tsx
import { Stack } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export default function Layout() {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } }))
  return (
    <QueryClientProvider client={qc}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Criar `app/index.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { router } from 'expo-router'
import * as LocalAuthentication from 'expo-local-authentication'
import { verifyTenant, getCozinheiros, loginWithPin } from '../services/auth.service'
import { storage } from '../services/storage.service'
import { PinInput } from '../components/PinInput'

type Cozinheiro = { id: string; name: string; avatarUrl: string | null }

export default function LoginScreen() {
  const [slug, setSlug] = useState('')
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState('')
  const [cozinheiros, setCozinheiros] = useState<Cozinheiro[]>([])
  const [selected, setSelected] = useState<Cozinheiro | null>(null)
  const [pinError, setPinError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Auto-load slug from storage
    storage.get('slug').then((s) => { if (s) conectar(s) })
  }, [])

  async function conectar(slugInput?: string) {
    const s = slugInput ?? slug.trim()
    if (!s) return
    setLoading(true)
    try {
      const tenant = await verifyTenant(s)
      await storage.set('slug', s)
      await storage.set('tenantId', tenant.id)
      await storage.set('tenantName', tenant.name)
      setTenantId(tenant.id)
      setTenantName(tenant.name)
      const lista = await getCozinheiros(tenant.id)
      setCozinheiros(lista)
    } catch (e) {
      Alert.alert('Erro', (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function selecionarCozinheiro(c: Cozinheiro) {
    setSelected(c)
    // Tenta biometria
    const biometriaKey = `biometria:${c.id}`
    const temBiometria = await storage.get(biometriaKey)
    if (temBiometria === 'true') {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: `Entrar como ${c.name}` })
      if (result.success) {
        const token = await storage.get('token')
        if (token) { router.replace('/kds'); return }
      }
    }
  }

  async function handlePin(pin: string) {
    if (!selected || !tenantId) return
    setPinError('')
    try {
      const result = await loginWithPin(tenantId, selected.id, pin)
      await storage.set('token', result.token)
      await storage.set('biometria:' + selected.id, 'true')
      router.replace('/kds')
    } catch (e) {
      setPinError((e as Error).message)
    }
  }

  if (!tenantId) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>THE FINANCE KDS</Text>
        <TextInput
          style={styles.input}
          placeholder="Slug do restaurante"
          placeholderTextColor="#6b7280"
          value={slug}
          onChangeText={setSlug}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.btn} onPress={() => conectar()}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Conectar</Text>}
        </TouchableOpacity>
      </View>
    )
  }

  if (selected) {
    return (
      <View style={styles.center}>
        <Text style={styles.subtitle}>{selected.name}</Text>
        <PinInput onComplete={handlePin} error={pinError} />
        <TouchableOpacity onPress={() => setSelected(null)} style={{ marginTop: 20 }}>
          <Text style={{ color: '#9ca3af', fontSize: 13 }}>← Voltar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{tenantName}</Text>
      <Text style={styles.subtitle}>Selecione o cozinheiro</Text>
      <FlatList
        data={cozinheiros}
        keyExtractor={(c) => c.id}
        numColumns={3}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => selecionarCozinheiro(item)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.cardName}>{item.name.split(' ')[0]}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', padding: 24 },
  center: { flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', gap: 20 },
  title: { color: '#f9fafb', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#9ca3af', fontSize: 16, marginBottom: 16 },
  input: { backgroundColor: '#1f2937', color: '#f9fafb', padding: 14, borderRadius: 10, width: 280, fontSize: 15 },
  btn: { backgroundColor: '#16a34a', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { alignItems: 'center', margin: 12, width: 100 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  avatarText: { color: '#f9fafb', fontSize: 24, fontWeight: '700' },
  cardName: { color: '#e5e7eb', fontSize: 13 },
})
```

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx app/index.tsx
git commit -m "feat: add login screen (slug + cozinheiro list + PIN + biometria)"
```

---

### Task 9: Tela principal KDS (app/kds/index.tsx)

**Files:**
- Create: `app/kds/_layout.tsx`
- Create: `app/kds/index.tsx`
- Create: `components/ColunaKDS.tsx`

- [ ] **Step 1: Criar `app/kds/_layout.tsx`**

```tsx
import { Stack } from 'expo-router'

export default function KdsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
```

- [ ] **Step 2: Criar `components/ColunaKDS.tsx`**

```tsx
import { View, Text, FlatList, StyleSheet } from 'react-native'
import { PedidoCard } from './PedidoCard'
import type { Pedido } from '../hooks/usePedidos'

type Props = {
  titulo: string
  status: 'ABERTO' | 'EM_PREPARO' | 'PRONTO'
  pedidos: Pedido[]
  tempoMedioMs: number
  onMover: (id: string, novoStatus: string) => void
  novosIds: Set<string>
}

export function ColunaKDS({ titulo, status, pedidos, tempoMedioMs, onMover, novosIds }: Props) {
  return (
    <View style={styles.coluna}>
      <View style={styles.header}>
        <Text style={styles.titulo}>{titulo}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pedidos.length}</Text>
        </View>
      </View>
      <FlatList
        data={pedidos}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PedidoCard
            pedido={item}
            coluna={status}
            tempoMedioMs={tempoMedioMs}
            onMover={onMover}
            isNew={novosIds.has(item.id)}
          />
        )}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  coluna: { flex: 1, backgroundColor: '#0f172a', borderRightWidth: 1, borderRightColor: '#1e293b', paddingHorizontal: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 4 },
  titulo: { color: '#f9fafb', fontSize: 16, fontWeight: '700' },
  badge: { backgroundColor: '#374151', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
})
```

- [ ] **Step 3: Criar `app/kds/index.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import * as ScreenOrientation from 'expo-screen-orientation'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { usePedidos, useUpdatePedidoStatus } from '../../hooks/usePedidos'
import { useSocket } from '../../hooks/useSocket'
import { useOfflineQueue } from '../../hooks/useOfflineQueue'
import { storage } from '../../services/storage.service'
import { ColunaKDS } from '../../components/ColunaKDS'
import { OfflineBanner } from '../../components/OfflineBanner'
import { useQueryClient } from '@tanstack/react-query'
import type { Pedido } from '../../hooks/usePedidos'

export default function KdsScreen() {
  const { data, isLoading } = usePedidos()
  const updateStatus = useUpdatePedidoStatus()
  const { addToQueue } = useOfflineQueue()
  const qc = useQueryClient()
  const [novosIds, setNovosIds] = useState<Set<string>>(new Set())
  const knownIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
    activateKeepAwakeAsync()
    storage.get('token').then((token) => { if (!token) router.replace('/') })
    return () => { deactivateKeepAwake() }
  }, [])

  useEffect(() => {
    if (!data) return
    const novas = new Set<string>()
    for (const p of data.pedidos) {
      if (!knownIds.current.has(p.id)) novas.add(p.id)
      knownIds.current.add(p.id)
    }
    if (novas.size > 0) setNovosIds(novas)
    setTimeout(() => setNovosIds(new Set()), 500)
  }, [data])

  useSocket(
    (pedido) => {
      qc.setQueryData(['kds-pedidos'], (old: { pedidos: Pedido[]; tempoMedioMs: number } | undefined) => {
        if (!old) return old
        const exists = old.pedidos.some((p) => p.id === (pedido as Pedido).id)
        if (exists) return old
        return { ...old, pedidos: [pedido as Pedido, ...old.pedidos] }
      })
    },
    (pedido) => {
      qc.setQueryData(['kds-pedidos'], (old: { pedidos: Pedido[]; tempoMedioMs: number } | undefined) => {
        if (!old) return old
        return { ...old, pedidos: old.pedidos.map((p) => p.id === (pedido as Pedido).id ? pedido as Pedido : p) }
      })
    },
    (pedidoId) => {
      qc.setQueryData(['kds-pedidos'], (old: { pedidos: Pedido[]; tempoMedioMs: number } | undefined) => {
        if (!old) return old
        return { ...old, pedidos: old.pedidos.filter((p) => p.id !== pedidoId) }
      })
    }
  )

  async function mover(pedidoId: string, novoStatus: string) {
    const token = await storage.get('token')
    try {
      await updateStatus(pedidoId, novoStatus, token ?? '')
    } catch {
      await addToQueue({ tipo: 'status', pedidoId, novoStatus })
    }
  }

  const pedidos = data?.pedidos ?? []
  const tempoMedioMs = data?.tempoMedioMs ?? 20 * 60 * 1000

  const abertos = pedidos.filter((p) => p.status === 'ABERTO')
  const emPreparo = pedidos.filter((p) => p.status === 'EM_PREPARO')
  const prontos = pedidos.filter((p) => p.status === 'PRONTO')

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <View style={styles.columns}>
        <ColunaKDS titulo="Novos" status="ABERTO" pedidos={abertos} tempoMedioMs={tempoMedioMs} onMover={mover} novosIds={novosIds} />
        <ColunaKDS titulo="Em preparo" status="EM_PREPARO" pedidos={emPreparo} tempoMedioMs={tempoMedioMs} onMover={mover} novosIds={novosIds} />
        <ColunaKDS titulo="Prontos" status="PRONTO" pedidos={prontos} tempoMedioMs={tempoMedioMs} onMover={mover} novosIds={novosIds} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  columns: { flex: 1, flexDirection: 'row' },
})
```

- [ ] **Step 4: Commit**

```bash
git add app/kds/ components/ColunaKDS.tsx
git commit -m "feat: add main KDS screen with 3-column layout and real-time updates"
```

---

### Task 10: Serviço de push notifications

**Files:**
- Create: `services/push.service.ts`

- [ ] **Step 1: Criar `services/push.service.ts`**

```typescript
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { API_URL } from '../src/constants'
import { storage } from './storage.service'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function registerForPushNotifications(tenantId: string): Promise<void> {
  const { status } = await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  })

  const plataforma = Constants.platform?.ios ? 'IOS' : 'ANDROID'
  const nomeDispositivo = Constants.deviceName ?? 'KDS Device'

  await fetch(`${API_URL}/api/kds/register-push-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: token.data, plataforma, nomeDispositivo, tenantId }),
  })
}
```

Chamar `registerForPushNotifications(tenantId)` em `app/kds/index.tsx` dentro do `useEffect` após confirmar o token.

- [ ] **Step 2: Commit**

```bash
git add services/push.service.ts
git commit -m "feat: add Expo push notification registration service"
```

---

### Task 11: Tela de configurações (app/kds/settings.tsx)

**Files:**
- Create: `app/kds/settings.tsx`

- [ ] **Step 1: Criar `app/kds/settings.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { View, Text, Switch, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { router } from 'expo-router'
import Constants from 'expo-constants'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { logout } from '../../services/auth.service'
import { storage } from '../../services/storage.service'

export default function SettingsScreen() {
  const [keepAwake, setKeepAwake] = useState(true)
  const [tenantName, setTenantName] = useState('')

  useEffect(() => {
    storage.get('tenantName').then((n) => setTenantName(n ?? ''))
  }, [])

  async function trocarRestaurante() {
    await logout()
    router.replace('/')
  }

  async function trocarCozinheiro() {
    await storage.remove('token')
    router.replace('/')
  }

  async function toggleKeepAwake(value: boolean) {
    setKeepAwake(value)
    if (value) await activateKeepAwakeAsync()
    else deactivateKeepAwake()
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Configurações</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Restaurante conectado</Text>
        <Text style={styles.value}>{tenantName}</Text>
        <TouchableOpacity style={styles.btn} onPress={trocarRestaurante}>
          <Text style={styles.btnText}>Trocar restaurante</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.btn} onPress={trocarCozinheiro}>
          <Text style={styles.btnText}>Trocar cozinheiro</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Manter tela sempre ligada</Text>
          <Switch value={keepAwake} onValueChange={toggleKeepAwake} trackColor={{ true: '#16a34a' }} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Versão do app</Text>
        <Text style={styles.value}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24 },
  title: { color: '#f9fafb', fontSize: 22, fontWeight: '800', marginBottom: 24 },
  section: { backgroundColor: '#1f2937', borderRadius: 12, padding: 16, marginBottom: 12, gap: 8 },
  label: { color: '#9ca3af', fontSize: 13 },
  value: { color: '#f9fafb', fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btn: { backgroundColor: '#374151', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#f9fafb', fontSize: 14, fontWeight: '600' },
})
```

- [ ] **Step 2: Commit**

```bash
git add app/kds/settings.tsx
git commit -m "feat: add KDS settings screen"
```

---

### Task 12: Build EAS e OTA

- [ ] **Step 1: Instalar EAS CLI**

```bash
npm install -g eas-cli
eas login
```

- [ ] **Step 2: Configurar projeto no EAS**

```bash
eas build:configure
```

- [ ] **Step 3: Build de desenvolvimento (APK com QR Code)**

```bash
eas build --profile development --platform android
```

- [ ] **Step 4: Build de produção (APK direto)**

```bash
eas build --profile production --platform android
```

- [ ] **Step 5: Configurar OTA updates**

```bash
eas update --channel production --message "Initial release"
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: complete KDS app — ready for EAS build"
```
