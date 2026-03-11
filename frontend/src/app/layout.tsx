import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { AIAssistant } from "@/components/ai-assistant";
import "./globals.css";

export const metadata: Metadata = {
  title: "AstraSend - Low-Cost Cross-Border Remittances",
  description:
    "Send money anywhere with under 1% fees. Powered by Uniswap v4 hooks on Base.",
  openGraph: {
    title: "AstraSend",
    description: "Low-cost, compliant cross-border remittances on Base",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>
          {children}
          <AIAssistant />
        </Providers>
      </body>
    </html>
  );
}
