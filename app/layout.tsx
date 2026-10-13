import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { Toaster } from "sonner";

import { I18nProvider } from "@/components/i18n/provider";
import { getLocale } from "@/lib/i18n/server";

import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FxP Tareas",
  description: "Gestión de tareas de Fútbol por mi País",
  icons: {
    icon: "/fxp-icon.png",
    apple: "/fxp-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1b2b57",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={nunito.variable}>
      <body className="font-sans antialiased">
        <I18nProvider locale={locale}>
          {children}
          <Toaster position="bottom-right" richColors />
        </I18nProvider>
      </body>
    </html>
  );
}
