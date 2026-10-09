import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ErrorProvider } from "@/components/providers/ErrorProvider";
import { APP_VERSION } from "@/lib/version";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workout Tracker",
  description: "Progressive overload strength training tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-white min-h-screen">
        <ErrorProvider>
          <AuthProvider>{children}</AuthProvider>
          <footer className="text-center text-xs text-gray-600 py-4">
            Workout Tracker v{APP_VERSION}
          </footer>
        </ErrorProvider>
      </body>
    </html>
  );
}
