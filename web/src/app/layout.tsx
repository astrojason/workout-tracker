import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ErrorProvider } from "@/components/providers/ErrorProvider";
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
        </ErrorProvider>
      </body>
    </html>
  );
}
