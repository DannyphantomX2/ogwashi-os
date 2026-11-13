import type { Metadata, Viewport } from "next";
import "./globals.css";
import LeavesBackground from "@/components/LeavesBackground";

export const metadata: Metadata = {
  title: "Ogwashi Farmers Registry",
  description: "Register and manage farmers",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#166534",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LeavesBackground />
        {children}
      </body>
    </html>
  );
}
