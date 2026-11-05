// Layout gốc: nạp font qua next/font (tự host → html-to-image nhúng được khi xuất ảnh) + metadata SEO
import type { Metadata } from "next";
import { Fustat, Nunito, Inter, JetBrains_Mono, Plus_Jakarta_Sans, Space_Grotesk, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import "./skin.css"; // lớp style theo kit UI8 Nexus + Refina (đè lên globals.css)

// Fustat: font giao diện theo kit Nexus (chỉ cho UI, không dùng trong slide)
const ui = Fustat({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-ui" });
const nunito = Nunito({ subsets: ["latin", "vietnamese"], weight: ["700", "800", "900"], variable: "--font-nunito" });
const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "vietnamese"], weight: ["500", "700", "800"], variable: "--font-jakarta" });
const grotesk = Space_Grotesk({ subsets: ["latin", "vietnamese"], weight: ["500", "700"], variable: "--font-grotesk" });
const serif = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Pixstall — App Store & Google Play screenshot builder",
  description: "Drop your app screens, get store-ready screenshots and a Google Play feature graphic — every size, every language, right in your browser.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${inter.variable} ${nunito.variable} ${mono.variable} ${jakarta.variable} ${grotesk.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
