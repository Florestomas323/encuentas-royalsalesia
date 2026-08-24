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
  title: "Royal Sales AI",
  description: "Asistente comercial con IA para cada visita presencial.",
  manifest: "/manifest.webmanifest",
  applicationName: "Royal Sales AI",
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
