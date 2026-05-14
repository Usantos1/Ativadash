import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { TrustedBy } from "@/components/TrustedBy";
import { ProductTour } from "@/components/ProductTour";
import { HowItWorks } from "@/components/HowItWorks";
import { ForWhom } from "@/components/ForWhom";
import { Differentials } from "@/components/Differentials";
import { ContactSection } from "@/components/ContactSection";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";
import { LeadModalProvider } from "@/components/LeadModalContext";
import { LeadFormModal } from "@/components/LeadFormModal";

export function LandingPage() {
  return (
    <LeadModalProvider>
      <Header />
      <main>
        <Hero />
        <TrustedBy />
        <ProductTour />
        <HowItWorks />
        <ForWhom />
        <Differentials />
        <ContactSection />
        <FAQ />
      </main>
      <Footer />
      <LeadFormModal />
    </LeadModalProvider>
  );
}
