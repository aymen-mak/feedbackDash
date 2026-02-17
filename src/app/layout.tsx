import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Makina Feedback",
  description: "Community feedback dashboard for Makina vaults",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-makina-bg text-makina-text antialiased">
        {children}
      </body>
    </html>
  );
}
