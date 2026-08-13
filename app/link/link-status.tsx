"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function LinkStatus({ code }: { code: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"waiting" | "linked" | "error">("waiting");

  useEffect(() => {
    let active = true;
    const check = async () => {
      const response = await fetch(`/api/device/status?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const result = await response.json() as { status?: string };
      if (!active) return;
      if (result.status === "linked") {
        setStatus("linked");
        router.replace("/tokens");
        return;
      }
      setStatus(response.ok ? "waiting" : "error");
    };
    void check();
    const timer = window.setInterval(() => void check(), 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [code, router]);

  if (status === "linked") return <p role="status">Hands Diff is linked. <Link href="/tokens">Manage linked devices</Link></p>;
  if (status === "error") return <p role="alert">We could not confirm this device. Start linking again from OBS.</p>;
  return <p role="status">Device approved. Waiting for Hands Diff to confirm the link…</p>;
}
