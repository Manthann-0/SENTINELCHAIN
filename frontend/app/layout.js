import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { DashboardProvider } from "@/components/DashboardProvider";
import AppShell from "@/components/AppShell";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "SentinelChain — Energy Supply Chain Risk Command Center",
  description:
    "AI-driven geopolitical risk monitoring for India's critical crude oil shipping corridors. Live disruption scores for Strait of Hormuz, Red Sea, and Strait of Malacca.",
  keywords: [
    "energy security",
    "supply chain risk",
    "geopolitical intelligence",
    "crude oil",
    "shipping corridor",
    "India",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} ${spaceGrotesk.variable}`}
    >
      <body>
        <DashboardProvider>
          <AppShell>{children}</AppShell>
        </DashboardProvider>
      </body>
    </html>
  );
}
