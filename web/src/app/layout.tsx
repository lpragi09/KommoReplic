import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3000"),
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: `${BRAND.name} — ${BRAND.tagline} Funil de vendas, conversas e tarefas no mesmo lugar.`,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: "Funil de vendas, conversas e tarefas no mesmo lugar. Mensal, sem fidelidade.",
    images: [{ url: "/produto-funil.png", width: 1440, height: 900, alt: `Funil de vendas do ${BRAND.name}` }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0a0a0b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
