// Unit tests for the Worker's pure logic. Run with: npm test  (node --test)
// No live API key needed — these never call Anthropic.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  corsHeaders,
  safeEqual,
  authorize,
  validateBody,
  buildAnthropicRequest,
  ALLOWED_ORIGINS,
  DEFAULT_MODEL,
} from "../src/handler.js";

function reqWith(headers = {}) {
  return { headers: new Headers(headers) };
}

test("corsHeaders echoes an allowed origin", () => {
  const h = corsHeaders("http://localhost:1313");
  assert.equal(h["Access-Control-Allow-Origin"], "http://localhost:1313");
  assert.match(h["Access-Control-Allow-Methods"], /POST/);
});

test("corsHeaders omits ACAO for an unknown origin", () => {
  const h = corsHeaders("https://evil.example.com");
  assert.equal(h["Access-Control-Allow-Origin"], undefined);
});

test("ALLOWED_ORIGINS includes the GitHub Pages and custom domains", () => {
  assert.ok(ALLOWED_ORIGINS.includes("https://devseviq.github.io"));
  assert.ok(ALLOWED_ORIGINS.includes("https://www.tokleperlen.com"));
});

test("safeEqual: matches equal, rejects different/length/type", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual(undefined, "abc"), false);
});

test("authorize: 500 when no passphrase configured", () => {
  const r = authorize(reqWith({ "X-Access-Code": "x" }), {});
  assert.equal(r.ok, false);
  assert.equal(r.status, 500);
});

test("authorize: 401 on wrong code", () => {
  const r = authorize(reqWith({ "X-Access-Code": "nope" }), {
    ASSISTANT_PASSPHRASE: "secret",
  });
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
});

test("authorize: ok on correct code", () => {
  const r = authorize(reqWith({ "X-Access-Code": "secret" }), {
    ASSISTANT_PASSPHRASE: "secret",
  });
  assert.equal(r.ok, true);
});

test("validateBody: rejects non-object and empty messages", () => {
  assert.equal(validateBody(null).ok, false);
  assert.equal(validateBody({}).ok, false);
  assert.equal(validateBody({ messages: [] }).ok, false);
});

test("validateBody: rejects bad role and non-string content", () => {
  assert.equal(validateBody({ messages: [{ role: "system", content: "hi" }] }).ok, false);
  assert.equal(validateBody({ messages: [{ role: "user", content: 5 }] }).ok, false);
});

test("validateBody: first message must be the user", () => {
  const r = validateBody({ messages: [{ role: "assistant", content: "hei" }] });
  assert.equal(r.ok, false);
});

test("validateBody: accepts a well-formed conversation", () => {
  const r = validateBody({
    messages: [
      { role: "user", content: "Hei" },
      { role: "assistant", content: "Hei Siri" },
      { role: "user", content: "Jeg vil endre forsiden" },
    ],
  });
  assert.equal(r.ok, true);
  assert.equal(r.messages.length, 3);
});

test("validateBody: rejects an over-long conversation", () => {
  const big = "x".repeat(25000);
  const r = validateBody({ messages: [{ role: "user", content: big }] });
  assert.equal(r.ok, false);
});

test("buildAnthropicRequest: correct endpoint, headers, and payload", () => {
  const env = { ANTHROPIC_API_KEY: "sk-test", ASSISTANT_PASSPHRASE: "p" };
  const messages = [{ role: "user", content: "Hei" }];
  const out = buildAnthropicRequest(messages, env);

  assert.equal(out.url, "https://api.anthropic.com/v1/messages");
  assert.equal(out.headers["x-api-key"], "sk-test");
  assert.equal(out.headers["anthropic-version"], "2023-06-01");

  const payload = JSON.parse(out.body);
  assert.equal(payload.model, DEFAULT_MODEL);
  assert.equal(payload.stream, true);
  assert.equal(payload.thinking.type, "disabled");
  assert.equal(payload.output_config.effort, "low");
  assert.ok(Array.isArray(payload.system));
  assert.equal(payload.system[0].cache_control.type, "ephemeral");
  assert.deepEqual(payload.messages, messages);
});

test("buildAnthropicRequest: MODEL env var overrides the default", () => {
  const out = buildAnthropicRequest([{ role: "user", content: "Hei" }], {
    ANTHROPIC_API_KEY: "sk-test",
    MODEL: "claude-opus-4-8",
  });
  assert.equal(JSON.parse(out.body).model, "claude-opus-4-8");
});
