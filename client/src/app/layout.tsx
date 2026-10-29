import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthProvider } from "@/contexts/auth-context";
import { MeetingProvider } from "@/contexts/meeting-context";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "AI Meeting Platform | Enterprise Agentic Meetings",
  description:
    "Enterprise agentic meeting platform with Jitsi integration, Linear-style team roster, interactive calendar, and live meetings.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("h-full", "antialiased", "font-sans", inter.variable)}>
      <body className="min-h-full flex flex-col bg-[#fbf9f8] text-[#161513]">
        <AuthProvider>
          <MeetingProvider>
            {children}
            <Toaster position="top-right" />
          </MeetingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
