import "./styles.css";
import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Hands Diff",
  description: "Private League of Legends input recaps",
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/">Hands Diff</Link>
          <Link href="/reports">Reports</Link>
        </header>
        {children}
      </body>
    </html>
  );
}
