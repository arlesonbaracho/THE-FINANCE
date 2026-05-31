'use client'

import { useEffect, useRef } from 'react'

interface Particle { x: number; y: number; vx: number; vy: number; r: number; a: number; green: boolean }
interface Ring     { r: number; base: number; maxR: number; speed: number }
interface NNode    { x: number; y: number; vx: number; vy: number }

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const vpy = h * 0.65
  const vpx = w * 0.5
  ctx.save()
  ctx.lineWidth = 0.5
  // linhas horizontais
  for (let i = 1; i <= 14; i++) {
    const t = i / 14
    const y = vpy + (h - vpy) * (t * t)
    ctx.globalAlpha = t * 0.18
    ctx.strokeStyle = 'rgba(45,183,106,1)'
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
  // linhas radiais do ponto de fuga
  for (let i = 0; i <= 18; i++) {
    const x = (i / 18) * w
    ctx.globalAlpha = 0.07
    ctx.strokeStyle = 'rgba(45,183,106,1)'
    ctx.beginPath(); ctx.moveTo(vpx, vpy); ctx.lineTo(x, h); ctx.stroke()
  }
  ctx.restore()
}

function drawNeural(ctx: CanvasRenderingContext2D, nodes: NNode[], w: number, h: number, dt: number) {
  nodes.forEach(n => {
    n.x += n.vx * dt; n.y += n.vy * dt
    if (n.x < 0 || n.x > w) n.vx *= -1
    if (n.y < 0 || n.y > h) n.vy *= -1
  })
  ctx.lineWidth = 0.5
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x
      const dy = nodes[i].y - nodes[j].y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < 200) {
        ctx.globalAlpha = (1 - d / 200) * 0.1
        ctx.strokeStyle = '#4ADE80'
        ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke()
      }
    }
  }
  nodes.forEach(n => {
    ctx.globalAlpha = 0.2
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2); ctx.fill()
  })
}

function drawRings(ctx: CanvasRenderingContext2D, rings: Ring[], cx: number, cy: number, dt: number) {
  rings.forEach(ring => {
    ring.r += ring.speed * dt
    if (ring.r > ring.maxR) ring.r = ring.base
    const prog = (ring.r - ring.base) / (ring.maxR - ring.base)
    ctx.globalAlpha = (1 - prog) * 0.22
    ctx.strokeStyle = '#4ADE80'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx, cy, ring.r, 0, Math.PI * 2); ctx.stroke()
  })
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], w: number, h: number, dt: number) {
  particles.forEach(p => {
    p.x += p.vx * dt; p.y += p.vy * dt
    if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
    if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
    ctx.globalAlpha = p.a
    ctx.fillStyle = p.green ? '#4ADE80' : '#ffffff'
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
  })
}

export function CanvasBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0, h = 0, raf = 0, last = 0

    const resize = () => {
      w = canvas.width  = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })

    const P: Particle[] = Array.from({ length: 70 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r:  Math.random() * 1.5 + 0.4,
      a:  Math.random() * 0.4 + 0.08,
      green: Math.random() > 0.72,
    }))

    const R: Ring[] = [0, 1, 2].map(i => ({
      r:     70  + i * 80,
      base:  70  + i * 80,
      maxR:  290 + i * 60,
      speed: 0.6 + i * 0.3,
    }))

    const N: NNode[] = Array.from({ length: 15 }, () => ({
      x:  Math.random() * window.innerWidth,
      y:  Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    }))

    const loop = (ts: number) => {
      const dt = Math.min((ts - last) / 16, 3)
      last = ts
      ctx.clearRect(0, 0, w, h)

      drawGrid(ctx, w, h)
      drawNeural(ctx, N, w, h, dt)
      drawRings(ctx, R, w * 0.5, h * 0.65, dt)
      drawParticles(ctx, P, w, h, dt)

      ctx.globalAlpha = 1
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        zIndex: -1, pointerEvents: 'none',
      }}
    />
  )
}
