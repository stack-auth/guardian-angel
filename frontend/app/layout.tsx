import type { Metadata } from "next";
import { VT323 } from "next/font/google";
import "./globals.css";

const gameFont = VT323({
  weight: "400",
  variable: "--font-game",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Guardian Angel - Guide Your Pookie",
  description: "Become a Guardian Angel and guide your Pookie through the Pookieverse. A multiplayer pixel-art adventure game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${gameFont.variable} font-game antialiased`}>
        {children}
      </body>
    </html>
  );
}
