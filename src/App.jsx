import { useState, useRef, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  animate,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  Radar, Globe2, Layers, Search, UploadCloud, FileText, Download,
  Square, Loader2, CheckCircle2, AlertTriangle, X,
} from "lucide-react";

/* ───────────── helpers ───────────── */
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cleanDomain = (s) =>
  s.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^\*\./, "")
    .replace(/^www\./, "").split(/[/?#:\s]/)[0];

const parseDomains = (text) => [
  ...new Set(text.split(/\r?\n/).map(cleanDomain).filter((d) => DOMAIN_RE.test(d))),
];

const downloadTxt = (lines, name) => {
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

async function fetchSubs(domain, signal) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`/api/scan?domain=${encodeURIComponent(domain)}`, { signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()).subdomains || [];
    } catch (e) {
      if (signal.aborted || i === 2) throw e;
      await sleep(900 * (i + 1));
    }
  }
}

/* ───────────── UI primitives ───────────── */
const glass =
  "border border-white/20 bg-white/[0.08] backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.35)]";

function Counter({ value }) {
  const mv = useMotionValue(0);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.7, ease: "easeOut", onUpdate: (v) => setShown(Math.round(v)) });
    return () => c.stop();
  }, [value, mv]);
  return <span className="tabular-nums">{shown.toLocaleString()}</span>;
}

function GlowButton({ children, onClick, disabled, variant = "primary", className = "" }) {
  const palette =
    variant === "danger"
      ? "from-rose-500 via-red-500 to-orange-500 shadow-rose-500/40"
      : "from-sky-400 via-indigo-500 to-fuchsia-500 shadow-indigo-500/40";
  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.04, y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`group relative inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <span className={`absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r ${palette} opacity-80 blur-xl transition-opacity group-hover:opacity-100 ${disabled ? "" : "animate-pulse"}`} />
      <span className={`absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r ${palette} shadow-lg`} />
      <span className="absolute inset-x-3 top-0.5 h-1/2 rounded-full bg-gradient-to-b from-white/40 to-transparent" />
      <span className="relative flex items-center gap-2">{children}</span>
    </motion.button>
  );
}

function Stat({ label, children }) {
  return (
    <div className={`rounded-2xl p-4 ${glass}`}>
      <div className="text-[11px] font-medium uppercase tracking-widest text-white/50">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-white">{children}</div>
    </div>
  );
}

function ResultList({ list }) {
  const MAX = 1000;
  return (
    <div className={`max-h-64 overflow-y-auto rounded-2xl p-3 font-mono text-sm text-sky-100/90 [scrollbar-width:thin] ${glass}`}>
      {list.length === 0 ? (
        <p className="p-4 text-center text-white/40">No subdomains found.</p>
      ) : (
        <>
          {list.slice(0, MAX).map((s) => (
            <div key={s} className="rounded-lg px-3 py-1 transition-colors hover:bg-white/10">{s}</div>
          ))}
          {list.length > MAX && (
            <p className="px-3 py-2 text-xs text-white/40">+{(list.length - MAX).toLocaleString()} more — included in the download.</p>
          )}
        </>
      )}
    </div>
  );
}

/* ───────────── Single scan ───────────── */
function SingleMode() {
  const [input, setInput] = useState("");
  const [st, setSt] = useState({ status: "idle", list: [], domain: "", error: "" });

  const scan = async () => {
    const domain = cleanDomain(input);
    if (!DOMAIN_RE.test(domain)) return setSt({ status: "error", list: [], domain, error: "Enter a valid domain, e.g. example.com" });
    setSt({ status: "loading", list: [], domain, error: "" });
    try {
      const list = await fetchSubs(domain, new AbortController().signal);
      setSt({ status: "done", list, domain, error: "" });
    } catch {
      setSt({ status: "error", list: [], domain, error: "Scan failed. Please try again." });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className={`flex flex-1 items-center gap-3 rounded-2xl px-4 py-1 transition focus-within:border-sky-300/60 focus-within:shadow-[0_0_30px_rgba(56,189,248,0.35)] ${glass}`}>
          <Globe2 className="h-5 w-5 text-white/50" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && st.status !== "loading" && scan()}
            placeholder="example.com"
            spellCheck={false}
            className="w-full bg-transparent py-3 text-lg text-white placeholder-white/30 outline-none"
          />
        </div>
        <GlowButton onClick={scan} disabled={st.status === "loading" || !input.trim()}>
          {st.status === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
          {st.status === "loading" ? "Scanning…" : "Start Scan"}
        </GlowButton>
      </div>

      <AnimatePresence mode="wait">
        {st.status === "error" && (
          <motion.p key="err" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-sm text-rose-300">
            <AlertTriangle className="h-4 w-4" /> {st.error}
          </motion.p>
        )}
        {st.status === "done" && (
          <motion.div key="done" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-white/50">Found for {st.domain}</div>
                <div className="text-4xl font-semibold text-white"><Counter value={st.list.length} /> <span className="text-lg font-normal text-white/50">subdomains</span></div>
              </div>
              <button
                onClick={() => downloadTxt(st.list, `${st.domain}-subdomains.txt`)}
                disabled={!st.list.length}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-40 ${glass}`}
              >
                <Download className="h-4 w-4" /> Download .txt
              </button>
            </div>
            <ResultList list={st.list} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────── Bulk scan ───────────── */
function BulkMode() {
  const [file, setFile] = useState(null); // {name, domains}
  const [drag, setDrag] = useState(false);
  const [run, setRun] = useState(null);
  const abortRef = useRef(null);
  const allRef = useRef(new Set());
  const inputRef = useRef(null);

  const running = run?.status === "running";

  const loadFile = async (f) => {
    if (!f) return;
    const domains = parseDomains(await f.text());
    setFile({ name: f.name, domains });
    setRun(null);
  };

  const compile = () => [...allRef.current].map((s) => s.trim()).filter(Boolean).sort();

  const start = async () => {
    if (!file?.domains.length) return;
    const ac = new AbortController();
    abortRef.current = ac;
    allRef.current = new Set();
    const { domains } = file;
    let errors = 0;
    setRun({ status: "running", scanned: 0, errors: 0, found: 0, current: domains[0], last: null });

    for (let i = 0; i < domains.length; i++) {
      if (ac.signal.aborted) break;
      const d = domains[i];
      setRun((r) => ({ ...r, current: d }));
      let n = null;
      try {
        const subs = await fetchSubs(d, ac.signal);
        subs.forEach((s) => allRef.current.add(s));
        n = subs.length;
      } catch {
        if (ac.signal.aborted) break;
        errors++;
      }
      setRun((r) => ({ ...r, scanned: i + 1, errors, found: allRef.current.size, last: { d, n } }));
    }

    const list = compile();
    setRun((r) => ({ ...r, status: ac.signal.aborted ? "stopped" : "done", found: list.length, current: null }));
    if (list.length) downloadTxt(list, `bulk-subdomains-${Date.now()}.txt`);
  };

  const stop = () => abortRef.current?.abort();
  const total = file?.domains.length || 0;
  const pct = total && run ? (run.scanned / total) * 100 : 0;

  return (
    <div className="space-y-5">
      {!running && (
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); loadFile(e.dataTransfer.files?.[0]); }}
          onClick={() => inputRef.current?.click()}
          animate={{ scale: drag ? 1.02 : 1 }}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            drag ? "border-sky-300 bg-sky-400/10" : "border-white/25 bg-white/[0.04] hover:bg-white/[0.08]"
          }`}
        >
          <input ref={inputRef} type="file" accept=".txt,text/plain" hidden onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ""; }} />
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="rounded-2xl bg-gradient-to-br from-sky-400/30 to-fuchsia-500/30 p-4 shadow-lg">
            <UploadCloud className="h-8 w-8 text-white" />
          </motion.div>
          <p className="text-lg font-medium text-white">Drop your .txt file here</p>
          <p className="text-sm text-white/50">One domain per line — or click to browse</p>
        </motion.div>
      )}

      {file && !running && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex items-center justify-between gap-3 rounded-2xl p-4 ${glass}`}>
          <div className="flex min-w-0 items-center gap-3">
            <FileText className="h-5 w-5 shrink-0 text-sky-300" />
            <div className="min-w-0">
              <div className="truncate text-white">{file.name}</div>
              <div className="text-xs text-white/50">{file.domains.length.toLocaleString()} valid unique domains</div>
            </div>
          </div>
          <button onClick={() => { setFile(null); setRun(null); }} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </motion.div>
      )}

      {!running && (
        <div className="flex justify-center">
          <GlowButton onClick={start} disabled={!file?.domains.length}><Layers className="h-5 w-5" /> Start Bulk Scan</GlowButton>
        </div>
      )}

      {run && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className={`rounded-2xl p-4 ${glass}`}>
            <div className="flex items-center gap-2 text-sm text-white/60">
              {running ? <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
              {running ? "Current target" : run.status === "done" ? "Scan complete — file downloaded" : "Stopped — partial results downloaded"}
            </div>
            {running && <div className="mt-1 truncate font-mono text-lg text-white">Scanning: {run.current}...</div>}
            {run.last && <div className="mt-1 text-xs text-white/40">Last: {run.last.d} → {run.last.n ?? "failed"}{run.last.n != null && " found"}</div>}
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="relative h-full rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400 shadow-[0_0_20px_rgba(129,140,248,0.8)]"
                animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 80, damping: 18 }}
              >
                {running && <motion.span className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                  animate={{ x: ["-100%", "600%"] }} transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }} />}
              </motion.div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Scanned">{run.scanned} <span className="text-lg text-white/40">/ {total}</span></Stat>
            <Stat label="Extracted"><Counter value={run.found} /></Stat>
            <Stat label="Failed"><span className={run.errors ? "text-rose-300" : ""}>{run.errors}</span></Stat>
          </div>

          <div className="flex justify-center gap-3">
            {running ? (
              <GlowButton variant="danger" onClick={stop}><Square className="h-4 w-4 fill-current" /> Stop &amp; Download</GlowButton>
            ) : (
              <button onClick={() => downloadTxt(compile(), `bulk-subdomains-${Date.now()}.txt`)} disabled={!run.found}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-40 ${glass}`}>
                <Download className="h-4 w-4" /> Download again
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ───────────── App ───────────── */
const TABS = [
  { id: "single", label: "Single Domain Scan", icon: Globe2 },
  { id: "bulk", label: "Bulk TXT Scan", icon: Layers },
];

export default function App() {
  const [tab, setTab] = useState("single");
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const spring = { stiffness: 120, damping: 20 };
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [4, -4]), spring);
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-5, 5]), spring);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { mx.set(0); my.set(0); };

  const blobs = [
    { c: "bg-indigo-600/50", s: "-top-40 -left-32 h-[34rem] w-[34rem]", x: [0, 120, 0], y: [0, 80, 0] },
    { c: "bg-fuchsia-600/40", s: "top-1/3 -right-40 h-[32rem] w-[32rem]", x: [0, -100, 0], y: [0, 120, 0] },
    { c: "bg-sky-500/40", s: "-bottom-48 left-1/4 h-[30rem] w-[30rem]", x: [0, 90, 0], y: [0, -90, 0] },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06060f] p-4 font-sans text-white">
      {blobs.map((b, i) => (
        <motion.div key={i} className={`pointer-events-none absolute rounded-full blur-[110px] ${b.c} ${b.s}`}
          animate={{ x: b.x, y: b.y, scale: [1, 1.15, 1] }} transition={{ duration: 18 + i * 4, repeat: Infinity, ease: "easeInOut" }} />
      ))}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_60%)]" />

      <div onMouseMove={onMove} onMouseLeave={onLeave} className="relative w-full max-w-2xl" style={{ perspective: 1400 }}>
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 90, damping: 16 }}
          style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
          className={`rounded-[2.25rem] p-6 sm:p-8 ${glass} shadow-[0_30px_100px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.4)]`}
        >
          <div className="pointer-events-none absolute inset-0 rounded-[2.25rem] bg-gradient-to-br from-white/15 via-transparent to-transparent" />

          <header className="relative mb-6 flex items-center gap-4" style={{ transform: "translateZ(40px)" }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
              className="rounded-2xl bg-gradient-to-br from-sky-400 to-fuchsia-500 p-3 shadow-lg shadow-indigo-500/40">
              <Radar className="h-6 w-6 text-white" />
            </motion.div>
            <div>
              <h1 className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">Subdomain Finder</h1>
              <p className="text-sm text-white/50">Certificate-transparency recon, in spatial glass.</p>
            </div>
          </header>

          <nav className={`relative mb-6 flex gap-1 rounded-2xl p-1 ${glass}`} style={{ transform: "translateZ(30px)" }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${tab === id ? "text-white" : "text-white/50 hover:text-white/80"}`}>
                {tab === id && (
                  <motion.span layoutId="tab-pill" transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-xl border border-white/25 bg-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
                )}
                <Icon className="relative h-4 w-4" />
                <span className="relative hidden sm:inline">{label}</span>
                <span className="relative sm:hidden">{id === "single" ? "Single" : "Bulk"}</span>
              </button>
            ))}
          </nav>

          <main className="relative" style={{ transform: "translateZ(20px)" }}>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 14, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -10, filter: "blur(6px)" }} transition={{ duration: 0.25 }}>
                {tab === "single" ? <SingleMode /> : <BulkMode />}
              </motion.div>
            </AnimatePresence>
          </main>
        </motion.div>
      </div>
    </div>
  );
}
