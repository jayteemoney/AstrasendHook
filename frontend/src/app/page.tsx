"use client";

import { Header } from "@/components/header";
import {
  Hero,
  HowItWorks,
  Features,
  Comparison,
  TechStack,
  FAQ,
  CTA,
  Footer,
} from "@/components/landing";

export default function Home() {
  return (
    <>
      <Header />
      <Hero />
      <HowItWorks />
      <Features />
      <Comparison />
      <TechStack />
      <FAQ />
      <CTA />
      <Footer />
    </>
  );
}
