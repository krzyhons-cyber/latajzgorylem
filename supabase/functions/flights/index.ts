// Supabase Edge Function "flights": ceny lotów z Travelpayouts dla panelu admina.
// Token Travelpayouts jest tajny - trzymany w Secrets, nigdy w przeglądarce.
// Działa tylko dla zalogowanego administratora.
//
// Secrets (Edge Functions → Secrets):
//   TRAVELPAYOUTS_TOKEN   - token API z profilu Travelpayouts (obowiązkowy)
//   TRAVELPAYOUTS_MARKER  - Twój identyfikator partnera (marker) (obowiązkowy do linków)
//   TRAVELPAYOUTS_TRS    - opcjonalnie: ID projektu (trs) z Travelpayouts - potrzebne do automatycznej
//                           zamiany zwykłych linków (np. Trip.com) na Twoje linki partnerskie (action "convert")
//   TP_LINK_TEMPLATE      - opcjonalnie: własny szablon linku, np.
//                           https://tp.media/r?marker={marker}&trs=XXXX&p=4114&u={url}
//                           ({url} = zakodowany adres wyszukiwania Aviasales, {rawurl} = niezakodowany)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // 1) tylko zalogowany użytkownik (klucz anon nie wystarczy)
    const supaUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const who = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { apikey: anon || (req.headers.get("apikey") ?? ""), Authorization: req.headers.get("Authorization") ?? "" },
    });
    if (!who.ok) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));

    // 1b) diagnostyka: czy sekrety są ustawione i czy Travelpayouts przyjmuje token
    if (body.action === "status") {
      const tk = Deno.env.get("TRAVELPAYOUTS_TOKEN") ?? "";
      const mk = Deno.env.get("TRAVELPAYOUTS_MARKER") ?? "";
      let tp = "brak tokenu";
      if (tk) {
        try {
          const r = await fetch("https://api.travelpayouts.com/aviasales/v3/prices_for_dates?origin=WAW&destination=BCN&one_way=true&limit=1&currency=pln&market=pl", { headers: { "X-Access-Token": tk } });
          tp = r.ok ? "ok" : (r.status === 401 || r.status === 403 ? "token odrzucony (" + r.status + ")" : "błąd " + r.status);
        } catch (_e) { tp = "brak połączenia z Travelpayouts"; }
      }
      return json({ ok: true, token: !!tk, marker: !!mk, trs: !!(Deno.env.get("TRAVELPAYOUTS_TRS") ?? ""), travelpayouts: tp });
    }

    // 1c) zamiana zwykłego linku (np. Trip.com) na Twój link partnerski Travelpayouts
    if (body.action === "convert") {
      const token = Deno.env.get("TRAVELPAYOUTS_TOKEN") ?? "";
      const marker = (Deno.env.get("TRAVELPAYOUTS_MARKER") ?? "").trim();
      const trs = (Deno.env.get("TRAVELPAYOUTS_TRS") ?? "").trim();
      if (!token || !marker) return json({ error: "Brak sekretów TRAVELPAYOUTS_TOKEN / TRAVELPAYOUTS_MARKER w Supabase (Edge Functions → Secrets)." }, 500);
      if (!trs) return json({ error: "Brak sekretu TRAVELPAYOUTS_TRS (ID projektu w Travelpayouts) — dodaj go w Supabase → Edge Functions → Secrets." }, 500);
      const src = String(body.url ?? "").trim();
      if (!/^https?:\/\/[^\s]+$/i.test(src) || src.length > 2000) return json({ error: "Wklej pełny link (https://…) do strony oferty." }, 400);
      const num = (v: string) => (/^\d+$/.test(v) ? Number(v) : v);
      const link: Record<string, string> = { url: src };
      if (body.sub_id) link.sub_id = String(body.sub_id).slice(0, 60);
      let r: Response;
      try {
        r = await fetch("https://api.travelpayouts.com/links/v1/create", {
          method: "POST",
          headers: { "X-Access-Token": token, "Content-Type": "application/json" },
          body: JSON.stringify({ trs: num(trs), marker: num(marker), shorten: true, links: [link] }),
        });
      } catch (_e) { return json({ error: "Brak połączenia z Travelpayouts." }, 502); }
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) return json({ error: "Travelpayouts odrzucił token (sprawdź TRAVELPAYOUTS_TOKEN)." }, 502);
      if (!r.ok) {
        const m = String(data?.error ?? data?.message ?? r.status);
        if (/traffic source/i.test(m)) return json({ error: "Nieprawidłowe TRAVELPAYOUTS_TRS (ID projektu) — sprawdź je w Travelpayouts." }, 502);
        if (/marker/i.test(m)) return json({ error: "Nieprawidłowy TRAVELPAYOUTS_MARKER." }, 502);
        return json({ error: "Travelpayouts: " + m }, 502);
      }
      const item = data?.result?.links?.[0];
      if (item?.code === "success" && item?.partner_url) return json({ ok: true, partner_url: String(item.partner_url) });
      const msg = String(item?.message ?? "");
      if (/not subscribed/i.test(msg)) return json({ error: "Ten program partnerski nie jest włączony w Twoim projekcie Travelpayouts — dołącz do programu (np. Trip.com) w panelu Travelpayouts i spróbuj ponownie." }, 422);
      return json({ error: "Travelpayouts nie utworzył linku dla tego adresu. Użyj pełnego linku do strony oferty (nie skróconego) i upewnij się, że ten partner jest obsługiwany." }, 422);
    }

    // 2) podpowiedzi miast/lotnisk
    if (body.action === "suggest") {
      const term = String(body.term ?? "").trim().slice(0, 60);
      if (term.length < 2) return json([]);
      const u = `https://autocomplete.travelpayouts.com/places2?term=${encodeURIComponent(term)}&locale=pl&types[]=city&types[]=airport`;
      const r = await fetch(u);
      if (!r.ok) return json({ error: "autocomplete " + r.status }, 502);
      const data = await r.json();
      return json((Array.isArray(data) ? data : []).slice(0, 8).map((p: any) => ({
        code: p.code, name: p.name, country: p.country_name ?? "", type: p.type,
      })));
    }

    // 3) najtańsze loty
    if (body.action === "prices") {
      const token = Deno.env.get("TRAVELPAYOUTS_TOKEN");
      const marker = Deno.env.get("TRAVELPAYOUTS_MARKER") ?? "";
      if (!token) return json({ error: "Brak sekretu TRAVELPAYOUTS_TOKEN w Supabase (Edge Functions → Secrets)." }, 500);
      const code = /^[A-Za-z]{3}$/;
      if (!code.test(body.origin ?? "") || !code.test(body.destination ?? "")) return json({ error: "Nieprawidłowy kod lotniska." }, 400);
      const month = /^\d{4}-\d{2}(-\d{2})?$/;
      if (!month.test(body.departure_at ?? "")) return json({ error: "Nieprawidłowa data wylotu." }, 400);

      const p = new URLSearchParams({
        origin: String(body.origin).toUpperCase(),
        destination: String(body.destination).toUpperCase(),
        departure_at: body.departure_at,
        one_way: body.return_at ? "false" : "true",
        direct: body.direct ? "true" : "false",
        sorting: "price",
        currency: "pln",
        market: "pl",
        limit: "12",
        unique: "false",
      });
      if (body.return_at && month.test(body.return_at)) p.set("return_at", body.return_at);

      const r = await fetch("https://api.travelpayouts.com/aviasales/v3/prices_for_dates?" + p.toString(), {
        headers: { "X-Access-Token": token, "Accept-Encoding": "gzip, deflate" },
      });
      if (!r.ok) return json({ error: "Travelpayouts " + r.status }, 502);
      const data = await r.json();
      if (data.success === false) return json({ error: String(data.error ?? "Błąd Travelpayouts") }, 502);

      const template = Deno.env.get("TP_LINK_TEMPLATE") ?? "";
      const out = (data.data ?? []).map((it: any) => {
        const raw = "https://www.aviasales.com" + (it.link ?? "");
        let url: string;
        if (template) {
          url = template.replace("{marker}", encodeURIComponent(marker)).replace("{url}", encodeURIComponent(raw)).replace("{rawurl}", raw);
        } else {
          url = raw + (raw.includes("?") ? "&" : "?") + "marker=" + encodeURIComponent(marker);
        }
        return {
          price: it.price, currency: "PLN", airline: it.airline, departure_at: it.departure_at, return_at: it.return_at,
          transfers: it.transfers, return_transfers: it.return_transfers, origin: it.origin, destination: it.destination, url,
        };
      });
      return json(out);
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
