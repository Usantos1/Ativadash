import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { TrustedBy } from "@/components/TrustedBy";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { ForWhom } from "@/components/ForWhom";
import { Differentials } from "@/components/Differentials";
import { ContactSection } from "@/components/ContactSection";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";

export function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <TrustedBy />
        <Features />
        <HowItWorks />
        <ForWhom />
        <Differentials />
        <ContactSection />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
