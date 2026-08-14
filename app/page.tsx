import Link from "next/link";
import { requireAccount } from "@/features/auth/server/account";

export default async function Home() {
  const account = await requireAccount();
  return (
    <main className="home-page">
      <section className="home-hero">
        <p className="eyebrow">HANDS DIFF · PRIVATE LEAGUE RECAPS</p>
        <h1>Your game inputs, reviewed after the match.</h1>
        <p>
          Hands Diff keeps game capture private to your account and uploads derived
          gameplay metrics only.
        </p>
        <p>
          {account ? (
            <Link href="/reports">View your reports</Link>
          ) : (
            <Link href="/link">Link OBS to upload a report</Link>
          )}
        </p>
      </section>
    </main>
  );
}
