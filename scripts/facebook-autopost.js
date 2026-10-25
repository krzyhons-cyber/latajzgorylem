#!/usr/bin/env node
// Automatycznie publikuje NOWE oferty TravelDeals na stronie Facebook (Graph API).
// Oferty czyta z Twojej bazy Supabase. Post zawiera link do konkretnej oferty na Twojej stronie
// (Facebook sam dociąga stamtąd miniaturkę i opis).
//
// Zmienne środowiskowe:
//   SUPABASE_URL, SUPABASE_ANON_KEY, SITE_URL (np. https://twoja-strona.netlify.app), FB_PAGE_ID, FB_PAGE_TOKEN
// Opcjonalne:
//   DRY_RUN=1          tylko pokazuje posty, nic nie wysyła i nie zapisuje stanu
//   MAX_PER_RUN=3      maks. liczba postów na jedno uruchomienie (domyślnie 3)
//   MAX_AGE_DAYS=7     pomija oferty starsze niż tyle dni (domyślnie 7)
//   POST_EXISTING=1    przy PIERWSZYM uruchomieniu opublikuj też istniejące oferty (domyślnie je tylko oznacza jako "już było")
//   STATE_FILE=.autopost/posted.json
//   FB_API=https://graph.facebook.com/v21.0   (tylko do testów)
const fs = require("fs");
const path = require("path");
const env = process.env;
const API = env.FB_API || "https://graph.facebook.com/v21.0";
const STATE_FILE = env.STATE_FILE || ".autopost/posted.json";
const MAX_PER_RUN = parseInt(env.MAX_PER_RUN || "3", 10);
const MAX_AGE_DAYS = parseInt(env.MAX_AGE_DAYS || "7", 10);
const DRY = !!env.DRY_RUN;

const need = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SITE_URL"].concat(DRY ? [] : ["FB_PAGE_ID", "FB_PAGE_TOKEN"]).filter((k) => !env[k]);
if (need.length) { console.error("Brakuje zmiennych: " + need.join(", ")); process.exit(1); }

const fmt = (n, c) => new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(n) + " " + (c || "PLN");
const tag = (s) => { const t = String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L").replace(/[^a-zA-Z0-9]/g, ""); return t ? "#" + t.charAt(0).toUpperCase() + t.slice(1) : ""; };
const ICON = { flights: "✈️", hotels: "🏨", packages: "🌴", carRental: "🚗", attractions: "🎟️" };
const CATTAGS = { flights: ["#TanieLoty"], hotels: ["#Noclegi"], packages: ["#Wakacje"], carRental: ["#WynajemAuta"], attractions: ["#Atrakcje"] };

function link(o) {
  const base = env.SITE_URL.replace(/[#?].*$/, "").replace(/\/+$/, "");
  return `${base}/oferta/${encodeURIComponent(o.slug)}?utm_source=facebook&utm_medium=autopost`;
}

function buildMessage(o, url) {
  const pct = o.originalPrice > o.currentPrice ? Math.round((1 - o.currentPrice / o.originalPrice) * 100) : 0;
  const dest = (o.destination || "").split(",")[0].trim();
  const when = new Date(o.createdAt || Date.now()).toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
  const excerpt = (o.description || "").split("\n")[0].slice(0, 180);
  const tags = [tag(dest)].concat(CATTAGS[o.category] || [], ["#Podroze", "#OfertaDnia"]).filter(Boolean).join(" ");
  return [
    `${ICON[o.category] || "✈️"} ${o.title}`,
    o.destination ? `📍 ${o.destination}` : "",
    `💰 ${fmt(o.currentPrice, o.currency)}${pct ? ` (-${pct}%)` : ""}`,
    `🕒 Cena z dnia ${when} — może się zmienić`,
    "",
    excerpt, excerpt ? "" : null,
    `👉 Szczegóły i rezerwacja: ${url}`,
    "",
    tags,
    "Wpis zawiera linki afiliacyjne."
  ].filter((x) => x !== null && x !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");
}

async function loadOffers() {
  const r = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/offers?select=data&order=created_at.asc&limit=1000`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, ...(env.SUPABASE_ANON_KEY.startsWith("eyJ") ? { Authorization: "Bearer " + env.SUPABASE_ANON_KEY } : {}) }
  });
  if (!r.ok) throw new Error("Błąd pobierania ofert: " + r.status + " " + (await r.text()));
  return (await r.json()).map((x) => x.data).filter((o) => o && o.slug && o.status !== "draft" && !(o.publishAt && Date.parse(o.publishAt) > Date.now()));
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) return null;
  try { const j = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); return Array.isArray(j) ? j : (j.posted || []); } catch (e) { return null; }
}
function writeState(list) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(list, null, 2) + "\n");
}

(async () => {
  const offers = await loadOffers();
  let posted = readState();

  if (posted === null) {           // pierwsze uruchomienie: nie zalewamy strony starymi ofertami
    if (!env.POST_EXISTING) {
      posted = offers.map((o) => o.slug);
      if (!DRY) writeState(posted);
      console.log(`Pierwsze uruchomienie: oznaczono ${posted.length} istniejących ofert jako już opublikowane (nic nie wysłano). Od teraz publikowane będą tylko nowe.`);
      return;
    }
    posted = [];
  }

  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  const todo = offers.filter((o) => !posted.includes(o.slug) && (!o.createdAt || new Date(o.createdAt).getTime() >= cutoff) && !o.noAutoPost).slice(0, MAX_PER_RUN);
  if (!todo.length) { console.log("Brak nowych ofert do opublikowania."); return; }

  let failed = 0;
  for (const o of todo) {
    const url = link(o);
    const message = buildMessage(o, url);
    if (DRY) { console.log("---", o.slug, "\n" + message + "\nLINK:", url); continue; }
    try {
      const res = await fetch(`${API}/${env.FB_PAGE_ID}/feed`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, link: url, access_token: env.FB_PAGE_TOKEN })
      });
      const j = await res.json();
      if (j.id) { posted.push(o.slug); writeState(posted); console.log("OK", o.slug, j.id); }
      else { failed++; console.error("BŁĄD", o.slug, JSON.stringify(j)); }
    } catch (e) { failed++; console.error("BŁĄD", o.slug, e.message); }
  }
  if (failed) process.exitCode = 1;
})().catch((e) => { console.error(e.message || e); process.exit(1); });
