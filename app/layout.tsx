import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rental Manager",
  description: "Sistema de gestión de alquileres",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="bg-white">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white`}>
        <AuthProvider>
          <ToastProvider>
            <Nav />
            <main className="bg-white">{children}</main>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
