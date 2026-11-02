// Layout gốc: nạp font qua next/font (tự host → html-to-image nhúng được khi xuất ảnh) + metadata SEO
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans, Space_Grotesk, DM_Serif_Display } from "next/font/google";
import "./globals.css";

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
    <html lang="en" className={`${inter.variable} ${mono.variable} ${jakarta.variable} ${grotesk.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
