import type { Metadata } from "next";
import { ThemeProvider } from "@/lib/theme";
import { LoadingBarProvider } from "@/components/LoadingBar";
import { NotificationProvider } from "@/components/Notifications";
import "./globals.css";

export const metadata: Metadata = {
  title: "Makina Pulse",
  description: "Your feedback shapes what we build next. Powered by Makina.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-makina-bg text-makina-text antialiased">
        <ThemeProvider>
          <LoadingBarProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </LoadingBarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
