// Vercel Serverless Function (Node 18+) — GET /api/scan?domain=example.com
// Works with package.json "type": "module" (the Vite default).

const DOMAIN_RE =
  /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const domain = String(req.query.domain || "")
    .trim()
    .toLowerCase();

  if (!DOMAIN_RE.test(domain)) {
    return res.status(400).json({ error: "Invalid domain", subdomains: [] });
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 9000);

  try {
    const upstream = await fetch(
      `https://crt.name/v1/search?apex=${encodeURIComponent(domain)}`,
      {
        signal: ac.signal,
        headers: {
          "User-Agent": "subdomain-finder/1.0",
          Accept: "application/json, text/plain, */*",
        },
      }
    );

    if (!upstream.ok) {
      return res
        .status(502)
        .json({ error: `Upstream responded ${upstream.status}`, subdomains: [] });
    }

    const body = await upstream.text();

    // Format-agnostic: if the body is JSON, collect every string value;
    // otherwise treat it as plain text. Then pull out hostnames with a regex.
    let text = body;
    try {
      const strings = [];
      (function walk(v) {
        if (typeof v === "string") strings.push(v);
        else if (v && typeof v === "object") Object.values(v).forEach(walk);
      })(JSON.parse(body));
      text = strings.join("\n");
    } catch {
      /* not JSON — use raw text */
    }

    const esc = domain.replace(/\./g, "\\.");
    const re = new RegExp(
      `(?<![a-z0-9_*.-])(?:[a-z0-9_*-]+\\.)*${esc}(?![a-z0-9_-]|\\.[a-z0-9])`,
      "gi"
    );

    const found = new Set();
    for (const m of text.match(re) || []) {
      const host = m.toLowerCase().replace(/^\*\./, "");
      if (host === domain || host.includes("*")) continue;
      found.add(host);
    }

    const subdomains = [...found].sort();

    res.setHeader(
      "Cache-Control",
      "s-maxage=3600, stale-while-revalidate=86400"
    );
    return res.status(200).json({ domain, count: subdomains.length, subdomains });
  } catch (err) {
    const timedOut = err?.name === "AbortError";
    return res.status(timedOut ? 504 : 500).json({
      error: timedOut ? "Upstream timeout" : "Scan failed",
      subdomains: [],
    });
  } finally {
    clearTimeout(timer);
  }
}
