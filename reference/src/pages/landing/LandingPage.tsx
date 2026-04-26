import { useEffect, useState } from 'react';
import { LandingHeader } from './LandingHeader';
import { LandingHero } from './LandingHero';
import { LandingProblem } from './LandingProblem';
import { LandingModulos } from './LandingModulos';
import { LandingVisualSistema } from './LandingVisualSistema';
import { LandingFeatures } from './LandingFeatures';
import { LandingBenefits } from './LandingBenefits';
import { LandingDemonstracao } from './LandingDemonstracao';
import { LandingCTA } from './LandingCTA';
import { LandingFooter } from './LandingFooter';
import { APP_URL, CTA_WHATSAPP, CTA_MSG } from './constants';
import { DemoFullscreenModalLP } from '@/components/DemoFullscreenModalLP';

export default function LandingPage() {
  const [showDemoModal, setShowDemoModal] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('landing-page');
    document.body.classList.add('landing-page');
    return () => {
      document.documentElement.classList.remove('landing-page');
      document.body.classList.remove('landing-page');
    };
  }, []);

  const handleAssinar = () => {
    if (typeof window === 'undefined') return;
    window.open(`${CTA_WHATSAPP}?text=${encodeURIComponent(CTA_MSG)}`, '_blank', 'noopener,noreferrer');
  };

  const openDemo = () => setShowDemoModal(true);

  return (
    <div className="min-h-screen bg-[#030504] text-[#F5F7F6] overflow-x-hidden font-sans antialiased">
      <LandingHeader onOpenDemo={openDemo} />
      <main>
        <LandingHero onOpenDemo={openDemo} />
        <LandingProblem onOpenDemo={openDemo} />
        <LandingModulos onOpenDemo={openDemo} />
        <LandingVisualSistema onOpenDemo={openDemo} />
        <LandingFeatures onOpenDemo={openDemo} />
        <LandingDemonstracao onOpenDemo={openDemo} />
        <LandingBenefits onOpenDemo={openDemo} />
        <LandingCTA onOpenDemo={openDemo} />
        <LandingFooter />
      </main>
      <DemoFullscreenModalLP
        open={showDemoModal}
        onClose={() => setShowDemoModal(false)}
        onAssinar={handleAssinar}
      />
    </div>
  );
}
