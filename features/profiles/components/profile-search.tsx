"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Result = { riotId: string; slug: string };

export function ProfileSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const value = query.trim();
    request.current?.abort();
    if (value.length < 2) { setResults([]); setLoading(false); return; }
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/profiles/search?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        const body = await response.json() as { profiles?: Result[] };
        if (!controller.signal.aborted) { setResults(body.profiles ?? []); setActive(-1); }
      } catch { if (!controller.signal.aborted) setResults([]); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [query]);
  const choose = (result: Result) => { router.push(`/${encodeURIComponent(result.slug)}`); };
  return <form className="profile-search" role="search" onSubmit={event => { event.preventDefault(); if (results[active] ?? results[0]) choose(results[active] ?? results[0]); }}>
    <label htmlFor="player-search">Find a player</label>
    <div className="profile-search-input"><input id="player-search" role="combobox" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setActive(value => Math.min(value + 1, results.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setActive(value => Math.max(value - 1, 0)); } if (event.key === "Escape") { setResults([]); setActive(-1); } }} placeholder="Riot ID or player page" autoComplete="off" aria-autocomplete="list" aria-controls="player-search-results" aria-expanded={query.trim().length >= 2} />{loading && <span aria-live="polite">Searching…</span>}</div>
    {query.trim().length >= 2 && <ul id="player-search-results" className="profile-search-results" role="listbox">{results.map((result, index) => <li key={result.slug} role="option" aria-selected={active === index}><button type="button" className={active === index ? "active" : ""} onMouseDown={() => choose(result)}>{result.riotId}</button></li>)}{!loading && !results.length && <li className="search-empty">No public player pages found.</li>}</ul>}
  </form>;
}
