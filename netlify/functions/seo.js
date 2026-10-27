// Netlify Function: nadaje każdej ofercie własne meta tagi (podgląd na Facebooku/Google),
// oraz generuje /sitemap.xml i /robots.txt. Dane czyta na żywo z Supabase.
// Adres i klucz publiczny są domyślnie wpisane poniżej (to klucz publiczny - bezpieczny).
// Możesz je nadpisać zmiennymi środowiskowymi SUPABASE_URL i SUPABASE_ANON_KEY w Netlify.

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jmnjgzzpztebayacyplp.supabase.co").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptbmpnenpwenRlYmF5YWN5cGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzMTEwMzIsImV4cCI6MjEwNzg4NzAzMn0.aqMlY-OvQbHKxOpE_xES_Q-l1WhNpuE3Ux3XiyGQeFY";

const fs = require("fs");
const nodePath = require("path");

// Szablon strony: najpierw z pliku dołączonego do funkcji (netlify.toml → included_files), potem z internetu.
async function loadBase(origin) {
  const dirs = [nodePath.join(__dirname, "..", "..", "public"), nodePath.join(__dirname, "public"),
    nodePath.join(process.env.LAMBDA_TASK_ROOT || "/var/task", "public"), nodePath.join(process.cwd(), "public")];
  for (const d of dirs) {
    try { const t = fs.readFileSync(nodePath.join(d, "index.html"), "utf8"); if (t.indexOf("<html") !== -1) return { html: t, source: "plik" }; } catch (e) {}
  }
  const r = await fetch(origin + "/index.html");
  if (!r.ok) throw new Error("index.html " + r.status);
  return { html: await r.text(), source: "http" };
}

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function sb(path) {
  const headers = { apikey: SUPABASE_ANON_KEY };
  if (SUPABASE_ANON_KEY.indexOf("eyJ") === 0) headers.Authorization = "Bearer " + SUPABASE_ANON_KEY;
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, { headers });
  if (!r.ok) throw new Error("supabase " + r.status);
  return r.json();
}

const fmtPrice = (n, cur) => {
  if (typeof n !== "number") return "";
  const sym = { PLN: "zł", EUR: "€", USD: "$", GBP: "£" }[cur] || cur || "zł";
  const v = Math.round(n).toLocaleString("pl-PL");
  return cur === "EUR" || cur === "USD" || cur === "GBP" ? sym + v : v + " " + sym;
};
const fmtDate = (iso) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Warsaw" });
};

// Szkice i oferty zaplanowane na później nie są publiczne
function isLive(o) { return !!o && o.status !== "draft" && !(o.publishAt && Date.parse(o.publishAt) > Date.now()); }

function pickImage(o, origin) {
  const cands = [o.ogImage, o.image].concat((o.extras || []).map((x) => x && x.shot));
  for (const c of cands) if (typeof c === "string" && /^https?:\/\//i.test(c)) return c;
  return origin + "/og-default.png";
}

// Roboty serwisów społecznościowych dostają lekką stronę z samymi znacznikami podglądu (bez całej aplikacji).
const BOT_RE = /facebookexternalhit|facebot|meta-externalagent|twitterbot|whatsapp|linkedinbot|slackbot|telegrambot|discordbot|pinterest|skypeuripreview|redditbot|googlebot|bingbot|embedly/i;

const lightPage = (head, h1, p, img, link) =>
  '<!doctype html>\n<html lang="pl"><head><meta charset="utf-8">\n' + head +
  '<meta name="viewport" content="width=device-width,initial-scale=1">\n</head><body>\n<h1>' + esc(h1) + "</h1><p>" + esc(p) + "</p>" +
  (img ? '<p><img src="' + esc(img) + '" alt="" width="600"></p>' : "") +
  '<p><a href="' + esc(link) + '">Zobacz ofertę</a></p>\n</body></html>';

const html = (body, status) => ({
  statusCode: status || 200,
  headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
  body
});

exports.handler = async (event) => {
  const ua = String((event.headers && (event.headers["user-agent"] || event.headers["User-Agent"])) || "");
  const res = await handle(event, ua);
  // Ślad w „Function log” w Netlify: widać, czy robot Facebooka dotarł i jaki kod dostał
  try { console.log("[seo] " + (event.httpMethod || "GET") + " " + (event.rawUrl || event.path) + " -> " + res.statusCode + " | bot=" + BOT_RE.test(ua) + " | ua=" + ua.slice(0, 80)); } catch (e) {}
  return res;
};

async function handle(event, ua) {
  const isBot = BOT_RE.test(ua);
  const url = new URL(event.rawUrl || ("https://" + (event.headers && event.headers.host) + event.path));
  const origin = url.origin;
  let path = url.pathname;
  try { path = decodeURIComponent(path); } catch (e) {}
  path = path.replace(/\/+$/, "") || "/";

  try {
    // Diagnostyka: otwórz  https://TWOJA-STRONA/.netlify/functions/seo?ping=1
    if (url.searchParams.get("ping")) {
      const info = { ok: true, funkcja: "seo działa", twojaPrzegladarkaToBot: isBot, node: process.version, fetch: typeof fetch, origin };
      try { const b = await loadBase(origin); info.szablon = b.source; info.rozmiar = b.html.length; } catch (e) { info.szablon = "BŁĄD: " + e.message; info.ok = false; }
      try { const rows = await sb("offers?select=slug&limit=1000"); info.baza = "ok, ofert: " + rows.length; info.przykladowyAdres = rows[0] ? origin + "/oferta/" + encodeURIComponent(rows[0].slug) : null; }
      catch (e) { info.baza = "BŁĄD: " + e.message; info.ok = false; }
      return { statusCode: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(info, null, 2) };
    }

    if (path === "/robots.txt") {
      return { statusCode: 200, headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: "User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: " + origin + "/sitemap.xml\n" };
    }

    if (path === "/sitemap.xml") {
      const rows = (await sb("offers?select=slug,created_at,data&order=created_at.desc&limit=1000")).filter((r) => isLive(r.data));
      const urls = [{ loc: origin + "/", mod: rows[0] && rows[0].created_at }, { loc: origin + "/prywatnosc" }]
        .concat(rows.map((r) => ({ loc: origin + "/oferta/" + encodeURIComponent(r.slug), mod: r.created_at })));
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        urls.map((u) => "  <url><loc>" + esc(u.loc) + "</loc>" + (u.mod ? "<lastmod>" + esc(String(u.mod).slice(0, 10)) + "</lastmod>" : "") + "</url>").join("\n") + "\n</urlset>\n";
      return { statusCode: 200, headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" }, body: xml };
    }

    // /oferta/<slug>: the normal app page with offer-specific meta tags
    const base = (await loadBase(origin)).html;
    const m = path.match(/^\/oferta\/(.+)$/);
    if (!m) {
      // Strona główna i listy: ogólny podgląd (tytuł, opis, obrazek), gdy ktoś udostępni sam adres strony
      if (path !== "/" && path !== "/linki") return html(base);
      let siteName = "latajzgorylem.pl";
      try { const rows = await sb("site?select=id,data&id=eq.2&limit=1"); if (rows[0] && rows[0].data && rows[0].data.siteName && ["TravelDeals", "gorillatravel.pl"].indexOf(rows[0].data.siteName) === -1) siteName = rows[0].data.siteName; } catch (e) {}
      const t = path === "/linki" ? siteName + " — najnowsze oferty" : siteName + " — oferty wyjazdów";
      const d = "Najnowsze okazje na loty, noclegi i wyjazdy. Przy każdej ofercie widać, z jakiego dnia jest cena.";
      const img = origin + "/og-default.png";
      const homeHead =
        "<title>" + esc(t) + "</title>\n" +
        '<meta name="description" content="' + esc(d) + '">\n' +
        '<meta property="og:type" content="website">\n' +
        '<meta property="og:site_name" content="' + esc(siteName) + '">\n' +
        '<meta property="og:title" content="' + esc(t) + '">\n' +
        '<meta property="og:description" content="' + esc(d) + '">\n' +
        '<meta property="og:url" content="' + esc(origin + path) + '">\n' +
        '<meta property="og:image" content="' + esc(img) + '">\n' +
        '<meta name="twitter:card" content="summary_large_image">\n';
      if (isBot || url.searchParams.get("bot")) return html(lightPage(homeHead, t, d, img, origin + path));
      return html(base
        .replace(/<title>[\s\S]*?<\/title>/i, "")
        .replace(/<meta\s+(?:property="og:[^"]*"|name="description"|name="twitter:card")[^>]*>\s*/gi, "")
        .replace("</head>", () => homeHead + "</head>"));
    }

    const rows = await sb("offers?select=data&slug=eq." + encodeURIComponent(m[1]) + "&limit=1");
    const o = rows[0] && rows[0].data;
    if (!o || !isLive(o)) return html(base);

    const price = fmtPrice(o.currentPrice, o.currency);
    const added = fmtDate(o.createdAt);
    const priceDigits = price.replace(/\D/g, "");
    const title = o.title + (price && String(o.title).replace(/\D/g, "").indexOf(priceDigits) === -1 ? " — " + price : "");
    const todayIso = new Date().toISOString().slice(0, 10);
    const termList = (Array.isArray(o.terms) ? o.terms : []).filter((x) => x && x.from && (x.to || x.from) >= todayIso).sort((p, q) => (p.from < q.from ? -1 : 1)).slice(0, 4);
    const shortDay = (iso) => { const d = new Date(iso + "T12:00:00Z"); return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", timeZone: "Europe/Warsaw" }); };
    const termsTxt = termList.length > 1 || (termList.length === 1 && !o.dateFrom) ? "terminy: " + termList.map((x) => shortDay(x.from) + (x.to ? "–" + shortDay(x.to) : "")).join(", ") : "";
    // rozbicie ceny: "na osobę" / "dla 2 osób"
    let priceNote = "";
    const pr = o.pricing && Array.isArray(o.pricing.items) ? o.pricing : null;
    if (pr) {
      const people = Math.max(1, Math.round(Number(pr.people)) || 1);
      let sum = 0;
      pr.items.forEach((x) => { if (x && typeof x.amount === "number" && x.amount >= 0) sum += x.basis === "person" ? x.amount * people : x.amount; });
      if (sum > 0) {
        if (pr.headline === "person") priceNote = " na osobę" + (people > 1 ? " (" + fmtPrice(sum, o.currency) + " dla " + people + " osób)" : "");
        else if (pr.headline === "total" && people > 1) priceNote = " dla " + people + " osób (" + fmtPrice(sum / people, o.currency) + " na osobę)";
      }
    }
    const descBits = [o.destination, price && "cena " + price + priceNote + (added ? " z dnia " + added : ""), termsTxt].filter(Boolean).join(" · ");
    const excerpt = String(o.description || "").split("\n")[0].slice(0, 160);
    const desc = (descBits + (excerpt ? ". " + excerpt : "")).slice(0, 300);
    const image = pickImage(o, origin);
    const pageUrl = origin + "/oferta/" + encodeURIComponent(o.slug);
    const ld = {
      "@context": "https://schema.org", "@type": "Product", name: o.title, description: desc, image: [image],
      offers: { "@type": "Offer", url: pageUrl, price: o.currentPrice, priceCurrency: o.currency || "PLN" }
    };

    const head =
      "<title>" + esc(title) + "</title>\n" +
      '<meta name="description" content="' + esc(desc) + '">\n' +
      '<link rel="canonical" href="' + esc(pageUrl) + '">\n' +
      '<meta property="og:type" content="article">\n' +
      '<meta property="og:site_name" content="latajzgorylem.pl">\n' +
      '<meta property="og:title" content="' + esc(title) + '">\n' +
      '<meta property="og:description" content="' + esc(desc) + '">\n' +
      '<meta property="og:url" content="' + esc(pageUrl) + '">\n' +
      '<meta property="og:image" content="' + esc(image) + '">\n' +
      (o.ogImage && image === o.ogImage ? '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n' : "") +
      '<meta name="twitter:card" content="summary_large_image">\n' +
      '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, "\\u003c") + "</script>\n";

    if (isBot || url.searchParams.get("bot")) return html(lightPage(head, o.title, desc, image, pageUrl));
    let out = base
      .replace(/<title>[\s\S]*?<\/title>/i, "")
      .replace(/<meta\s+(?:property="og:[^"]*"|name="description"|name="twitter:card")[^>]*>\s*/gi, "")
      .replace("</head>", () => head + "</head>")
      .replace(/<body>/i, () => "<body>\n<noscript><h1>" + esc(o.title) + "</h1><p>" + esc(desc) + "</p></noscript>");
    return html(out);
  } catch (err) {
    // On any problem fall back to the plain app page so the site keeps working.
    try { return html((await loadBase(origin)).html); }
    catch (e) { return { statusCode: 500, body: "Błąd serwera" }; }
  }
}
