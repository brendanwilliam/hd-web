import "./styles.css";
import "./profile-styles.css";
import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Handscheck", description: "Privacy-safe League of Legends input recaps" };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><header><Link href="/">Handscheck</Link></header>{children}</body></html>; }
