'use client'

import { useState } from 'react'
import { CanvasBackground }    from './CanvasBackground'
import { Navbar }              from './Navbar'
import { HeroSection }         from './HeroSection'
import { ModulesSection }      from './ModulesSection'
import { PricingSection }      from './PricingSection'
import { TestimonialsSection } from './TestimonialsSection'
import { CTASection }          from './CTASection'
import { Footer }              from './Footer'
import { DemoModal }           from './DemoModal'

export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <div className="lp-noise" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff' }}>
      <CanvasBackground />
      <Navbar />
      <HeroSection       onDemoClick={() => setDemoOpen(true)} />
      <ModulesSection />
      <PricingSection    onContactClick={() => setDemoOpen(true)} />
      <TestimonialsSection />
      <CTASection        onDemoClick={() => setDemoOpen(true)} />
      <Footer />
      {demoOpen && <DemoModal onClose={() => setDemoOpen(false)} />}
    </div>
  )
}
