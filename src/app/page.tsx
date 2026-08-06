export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-20">
      <p className="mb-5 text-sm font-semibold tracking-[0.25em] text-cyan-700">HANDSCHECK</p>
      <h1 className="max-w-3xl text-5xl font-bold tracking-tight text-slate-950 sm:text-7xl">
        Your League games, thoughtfully replayed.
      </h1>
      <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
        Handscheck turns the privacy-safe recap from Input Activity OBS into a shareable game report. It never
        receives or displays key contents.
      </p>
      <div className="mt-10 flex gap-4">
        <a className="rounded-full bg-slate-950 px-5 py-3 font-semibold text-white" href="https://github.com/brendanwilliam/handscheck-obs">
          Get the OBS plugin
        </a>
        <a className="rounded-full border border-slate-300 px-5 py-3 font-semibold text-slate-800" href="/api/health">
          Service status
        </a>
      </div>
    </main>
  );
}
