import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthContext";
import { UiFeedbackProvider } from "@/components/ui/UiFeedbackProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Where2Watt",
  description: "Where 2 Watt",
  icons: {
    icon: "/logo_square.svg",
    shortcut: "/logo_square.svg",
    apple: "/logo_square.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UiFeedbackProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </UiFeedbackProvider>
      </body>
    </html>
  );
}
