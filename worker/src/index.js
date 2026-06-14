// Tokleperlen assistant Worker.
// Holds the Anthropic API key as a secret, checks a shared passphrase, and
// streams Claude's reply straight back to the browser. See README.md to deploy.

import {
  corsHeaders,
  authorize,
  validateBody,
  buildAnthropicRequest,
} from "./handler.js";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    // CORS preflight.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Bruk POST." }, 405, cors);
    }
    // Reject origins not on the allow-list (no ACAO header was set for them).
    if (!cors["Access-Control-Allow-Origin"]) {
      return json({ error: "Ikke tillatt opphav." }, 403, cors);
    }

    const auth = authorize(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status, cors);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Ugyldig JSON." }, 400, cors);
    }

    const valid = validateBody(body);
    if (!valid.ok) return json({ error: valid.error }, 400, cors);

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "Mangler API-nokkel pa serveren." }, 500, cors);
    }

    const req = buildAnthropicRequest(valid.messages, env);
    let upstream;
    try {
      upstream = await fetch(req.url, {
        method: "POST",
        headers: req.headers,
        body: req.body,
      });
    } catch {
      return json({ error: "Kunne ikke na Claude." }, 502, cors);
    }

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      return json(
        { error: "Claude svarte med en feil.", detail: detail.slice(0, 500) },
        502,
        cors,
      );
    }

    // Pass the Server-Sent Events stream through unchanged.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...cors,
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8" },
  });
}
