import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ErrorProvider } from "@/components/providers/ErrorProvider";
import { AppNav } from "@/components/ui/AppNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workout Tracker",
  description: "Progressive overload strength training tracker",
};

// Lets the page use the area under the iPhone home indicator; the bottom nav pads for it itself.
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-white min-h-screen">
        <ErrorProvider>
          <AuthProvider>
            <div className="app-shell">{children}</div>
            <AppNav />
          </AuthProvider>
        </ErrorProvider>
      </body>
    </html>
  );
}
