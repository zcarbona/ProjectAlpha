import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./naql.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LangProvider } from "@/contexts/LangContext";
import Shell from "@/components/Shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Naql - Logistics Marketplace",
  description: "Book trucks and manage logistics",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <LangProvider>
      <AuthProvider>
        <html
          lang="en"
          dir="ltr"
          className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
          <body className="min-h-full flex flex-col">
            <Shell>{children}</Shell>
          </body>
        </html>
      </AuthProvider>
    </LangProvider>
  );
}