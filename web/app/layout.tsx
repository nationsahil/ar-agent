import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AR Agent",
  description: "EOB analysis and AR next-action assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
