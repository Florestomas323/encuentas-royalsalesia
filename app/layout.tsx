import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  // metadataBase convierte las rutas de imágenes en URLs absolutas en el <head>.
  // Imprescindible: WhatsApp/Facebook ignoran og:image con rutas relativas.
  metadataBase: new URL("https://royal-sales-is.vercel.app"),
  title: "Royal Sales AI",
  description: "Asistente comercial con IA para cada visita presencial.",
  manifest: "/manifest.webmanifest",
  applicationName: "Royal Sales AI",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Royal Sales AI",
    description: "Tu asistente inteligente de ventas.",
    url: "https://royal-sales-is.vercel.app",
    siteName: "Royal Sales AI",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Royal Sales AI" }],
    locale: "es_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Royal Sales AI",
    description: "Tu asistente inteligente de ventas.",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Royal Sales AI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#052e16",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${sora.variable} bg-surface`}>
      <body className="font-sans antialiased text-ink">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
