import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth-context";
import Sidebar from "@/components/nav/Sidebar";
import BottomNav from "@/components/nav/BottomNav";
import MobileHeader from "@/components/nav/MobileHeader";
import StatusBarFill from "@/components/pwa/StatusBarFill";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import PullToRefresh from "@/components/pwa/PullToRefresh";
import OpenInAppHint from "@/components/pwa/OpenInAppHint";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import { Toaster } from "sonner";
import PageTransition from "@/components/ui/PageTransition";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "DARS - The Digital Attendance Recording System",
  description: "Seamless attendance tracking for UNIZIK Political Science Department",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DARS",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* use-credentials sends cookies with the manifest fetch, so tunnels that gate on a cookie (ngrok free interstitial) don't return HTML instead of JSON */}
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} font-sans bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white min-h-screen flex flex-col`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <StatusBarFill />
            <div className="flex flex-1">
              <Sidebar />
              <div className="flex-1 min-w-0 flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 md:pt-[env(safe-area-inset-top)]">
                <MobileHeader />
                <PageTransition>
                  <main className="flex-1 flex flex-col">{children}</main>
                </PageTransition>
              </div>
            </div>
            <BottomNav />
            <PullToRefresh />
            <InstallPrompt />
            <OpenInAppHint />
            <ServiceWorkerRegister />
            <Toaster
              position="top-center"
              richColors
              toastOptions={{
                classNames: {
                  toast: "rounded-xl font-sans text-sm shadow-lg",
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
