// Pure, testable building blocks for the Tokleperlen assistant Worker.
// The Worker entry point (index.js) wires these together and streams the
// Anthropic response straight back to the browser.

// Origins allowed to call this Worker. Add the custom domain(s) once they go
// live; localhost:1313 is Hugo's dev server.
export const ALLOWED_ORIGINS = [
  "https://devseviq.github.io", // current GitHub Pages host (repo: devseviq/TokelePerlen)
  "https://tokeperlen.github.io", // kept in case the repo moves to the TokePerlen org
  "https://www.tokleperlen.com", // custom domains, once attached
  "https://tokleperlen.com",
  "http://localhost:1313", // hugo server, local dev
];

export const DEFAULT_MODEL = "claude-sonnet-4-6";
export const MAX_TOKENS = 4096;
export const MAX_MESSAGES = 60; // cap one conversation
export const MAX_CHARS = 24000; // total chars across the conversation (abuse guard)

// The assistant's behaviour. Norwegian, because Siri uses it. It interviews her
// one question at a time and, when she is done, writes a tidy "notat til Espen".
export const SYSTEM_PROMPT = [
  "Du er en vennlig assistent som hjelper Siri, som driver katteoppdrettet",
  "NO*Tokleperlen (sibirkatter). Oppgaven din er a hjelpe henne med a beskrive",
  "hva hun onsker pa nettsiden, slik at Espen (som lager siden) far et klart notat.",
  "",
  "Slik jobber du:",
  "- Snakk norsk, varmt og enkelt. Ingen tekniske faguttrykk.",
  "- Still ETT sporsmal av gangen, og vent pa svar.",
  "- Finn ut: HVA hun onsker (ny side, endre tekst, nytt bilde, ny funksjon, eller",
  "  en feil som skal rettes), HVOR pa siden det gjelder, HVORFOR / hva det skal",
  "  oppna, konkrete DETALJER eller tekst hun vil ha med, PRIORITET og evt. FRIST.",
  "- Hvis hun er vag, foresla mulige tolkninger og la henne velge.",
  "",
  "Sidene som finnes i dag:",
  "Forside, Om oppdrettet, Kattene i oppdrettet, Kattehotell, Kontakt, Kattunger,",
  "Planlagt kull, Utstyrsliste, Kattunger til salgs, Kjope katt (prisliste),",
  "Venteliste, Om rasen.",
  "",
  "Nar du har nok informasjon (eller hun sier hun er ferdig), skriv et notat med",
  "denne overskriften og disse punktene, i markdown:",
  "",
  "## Notat til Espen",
  "- Hva onsker du:",
  "- Hvor pa siden:",
  "- Hvorfor / mal:",
  "- Detaljer / tekst:",
  "- Prioritet:",
  "- Frist:",
  "- Apne sporsmal:",
  "",
  "Etter notatet: minn henne vennlig pa at hun kan trykke \"Last ned notat\" for a",
  "lagre det og sende det til Espen. Hold deg kort.",
].join("\n");

// CORS headers for a given request Origin. Only echoes the Origin back if it is
// on the allow-list, which is what actually gates cross-site use.
export function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Access-Code",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

// Length-aware, constant-time-ish string compare so the passphrase check does
// not leak via timing.
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Checks the shared passphrase sent in the X-Access-Code header.
export function authorize(request, env) {
  const expected = env && env.ASSISTANT_PASSPHRASE;
  if (!expected) {
    return { ok: false, status: 500, error: "Tjenesten er ikke konfigurert." };
  }
  const given = request.headers.get("X-Access-Code") || "";
  if (!safeEqual(given, expected)) {
    return { ok: false, status: 401, error: "Feil kode." };
  }
  return { ok: true };
}

// Validates the {messages:[...]} payload from the browser.
export function validateBody(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body ma vaere JSON." };
  }
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "messages ma vaere en ikke-tom liste." };
  }
  if (messages.length > MAX_MESSAGES) {
    return { ok: false, error: "Samtalen er for lang." };
  }
  let total = 0;
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) {
      return { ok: false, error: "Hver melding trenger role user|assistant." };
    }
    if (typeof m.content !== "string" || m.content.length === 0) {
      return { ok: false, error: "Hver melding trenger tekstinnhold." };
    }
    total += m.content.length;
  }
  if (total > MAX_CHARS) {
    return { ok: false, error: "Samtalen er for lang." };
  }
  if (messages[0].role !== "user") {
    return { ok: false, error: "Forste melding ma komme fra brukeren." };
  }
  return { ok: true, messages };
}

// Builds the request to the Anthropic Messages API. effort:low + thinking off
// keeps an intake chat fast and cheap; the system prompt is cached.
export function buildAnthropicRequest(messages, env) {
  return {
    url: "https://api.anthropic.com/v1/messages",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: (env && env.MODEL) || DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      stream: true,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages,
    }),
  };
}
