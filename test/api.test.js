import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const freePort = async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
};

test("API supports authenticated investigation flows and isolates account data", async (t) => {
  const folder = await mkdtemp(path.join(tmpdir(), "trace-test-"));
  const port = await freePort();
  const googleUsers = new Map([
    [
      "google-new-token",
      {
        id: "google-new-user",
        email: "google@example.test",
        email_confirmed_at: "2026-11-09T12:00:00.000Z",
        user_metadata: { full_name: "Google Tester" },
        identities: [{ provider: "google" }],
      },
    ],
    [
      "google-existing-token",
      {
        id: "google-existing-user",
        email: "one@example.test",
        email_confirmed_at: "2026-11-09T12:00:00.000Z",
        user_metadata: { name: "Existing Account" },
        identities: [{ provider: "google" }],
      },
    ],
    [
      "google-conflict-token",
      {
        id: "google-conflict-user",
        email: "one@example.test",
        email_confirmed_at: "2026-11-09T12:00:00.000Z",
        identities: [{ provider: "google" }],
      },
    ],
    [
      "google-unverified-token",
      {
        id: "google-unverified-user",
        email: "unverified@example.test",
        identities: [{ provider: "google" }],
      },
    ],
    [
      "github-token",
      {
        id: "github-user",
        email: "github@example.test",
        email_confirmed_at: "2026-11-09T12:00:00.000Z",
        identities: [{ provider: "github" }],
      },
    ],
  ]);
  const supabaseServer = createHttpServer((req, res) => {
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    const user = token ? googleUsers.get(token) : undefined;
    res.setHeader("content-type", "application/json");
    if (
      req.method !== "GET" ||
      req.url !== "/auth/v1/user" ||
      req.headers.apikey !== "integration-anon-key" ||
      !user
    ) {
      res.writeHead(401);
      res.end(JSON.stringify({ message: "Invalid token" }));
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify(user));
  });
  await new Promise((resolve) =>
    supabaseServer.listen(0, "127.0.0.1", resolve),
  );
  const supabasePort = supabaseServer.address().port;
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        DATABASE_PATH: path.join(folder, "test.sqlite"),
        AUTH_SECRET: "integration-test-secret-at-least-32-characters-long",
        OPENAI_API_KEY: "",
        OPENAI_MODEL: "gpt-4.1-mini",
        SUPABASE_URL: `http://127.0.0.1:${supabasePort}`,
        SUPABASE_ANON_KEY: "integration-anon-key",
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }
    await new Promise((resolve, reject) =>
      supabaseServer.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(folder, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${port}/api`;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) assert.fail(`Server exited early: ${stderr}`);
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.equal(ready, true, `Server did not start. ${stderr}`);
  const send = async (route, method = "GET", payload, cookie) => {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: {
        ...(payload ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const data = await response.json();
    return {
      response,
      data,
      cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
  };

  const invalid = await send("/auth/register", "POST", {
    name: "A",
    email: "bad",
    password: "123",
  });
  assert.equal(invalid.response.status, 400);
  const first = await send("/auth/register", "POST", {
    name: "Trace Tester",
    email: "one@example.test",
    password: "secure-pass-123",
  });
  assert.equal(first.response.status, 201);
  assert.ok(first.cookie);
  assert.equal(first.data.user.email, "one@example.test");
  assert.equal("password_hash" in first.data.user, false);
  const cookie = first.cookie;
  const aiStatus = await send("/ai/status", "GET", undefined, cookie);
  assert.deepEqual(aiStatus.data, {
    configured: false,
    model: "gpt-4.1-mini",
  });
  const unconfiguredAiRequest = await send(
    "/ai/brief",
    "POST",
    { prompt: "Investigate the latest payment status." },
    cookie,
  );
  assert.equal(unconfiguredAiRequest.response.status, 503);
  assert.match(unconfiguredAiRequest.data.error, /OPENAI_API_KEY/);

  const linkedGoogleAccount = await send("/auth/supabase", "POST", {
    accessToken: "google-existing-token",
  });
  assert.equal(linkedGoogleAccount.response.status, 200);
  assert.equal(linkedGoogleAccount.data.user.id, first.data.user.id);
  assert.ok(linkedGoogleAccount.cookie);
  const linkedGoogleSession = await send(
    "/auth/me",
    "GET",
    undefined,
    linkedGoogleAccount.cookie,
  );
  assert.equal(linkedGoogleSession.data.user.id, first.data.user.id);

  const googleAccount = await send("/auth/supabase", "POST", {
    accessToken: "google-new-token",
  });
  assert.equal(googleAccount.response.status, 200);
  assert.equal(googleAccount.data.user.email, "google@example.test");
  assert.equal(googleAccount.data.user.name, "Google Tester");
  assert.ok(googleAccount.cookie);
  const googlePasswordLogin = await send("/auth/login", "POST", {
    email: "google@example.test",
    password: "not-the-google-password",
  });
  assert.equal(googlePasswordLogin.response.status, 401);
  const repeatedGoogleSignIn = await send("/auth/supabase", "POST", {
    accessToken: "google-new-token",
  });
  assert.equal(repeatedGoogleSignIn.response.status, 200);
  assert.equal(repeatedGoogleSignIn.data.user.id, googleAccount.data.user.id);

  const unverifiedGoogleAccount = await send("/auth/supabase", "POST", {
    accessToken: "google-unverified-token",
  });
  assert.equal(unverifiedGoogleAccount.response.status, 401);
  const nonGoogleAccount = await send("/auth/supabase", "POST", {
    accessToken: "github-token",
  });
  assert.equal(nonGoogleAccount.response.status, 401);
  const invalidSupabaseToken = await send("/auth/supabase", "POST", {
    accessToken: "invalid-token",
  });
  assert.equal(invalidSupabaseToken.response.status, 401);
  const conflictingGoogleAccount = await send("/auth/supabase", "POST", {
    accessToken: "google-conflict-token",
  });
  assert.equal(conflictingGoogleAccount.response.status, 409);

  const event1 = await send(
    "/events",
    "POST",
    {
      title: "Order created",
      description: "Order placed by customer",
      type: "order",
      occurredAt: "2026-11-09T12:00:00+03:00",
      source: "orders-api",
    },
    cookie,
  );
  assert.equal(event1.response.status, 201);
  assert.equal(event1.data.occurred_at, "2026-11-09T09:00:00.000Z");
  const event2 = await send(
    "/events",
    "POST",
    {
      title: "Payment failed",
      description: "Issuer declined charge",
      type: "payment",
      occurredAt: "2026-11-09T10:01:00.000Z",
      source: "payments-api",
    },
    cookie,
  );
  assert.equal(event2.response.status, 201);
  const event3 = await send(
    "/events",
    "POST",
    {
      title: "Order marked successful",
      description: "Confirmation state set to successful",
      type: "order",
      occurredAt: "2026-11-09T10:02:00.000Z",
      source: "orders-api",
    },
    cookie,
  );
  assert.equal(event3.response.status, 201);

  const inv = await send(
    "/investigations",
    "POST",
    { name: "Order mismatch", description: "Trace payment and order status." },
    cookie,
  );
  assert.equal(inv.response.status, 201);
  for (const event of [event1, event2, event3]) {
    const linked = await send(
      `/investigations/${inv.data.id}/events`,
      "POST",
      { eventId: event.data.id },
      cookie,
    );
    assert.equal(linked.response.status, 201);
  }
  const detail = await send(
    `/investigations/${inv.data.id}`,
    "GET",
    undefined,
    cookie,
  );
  assert.equal(detail.data.events.length, 3);
  assert.deepEqual(
    detail.data.events.map((event) => event.title),
    ["Order created", "Payment failed", "Order marked successful"],
  );
  const analysis = await send("/analysis/detect", "GET", undefined, cookie);
  assert.ok(
    analysis.data.findings.some(
      (finding) => finding.rule === "payment-order-conflict",
    ),
  );

  const duplicate = await send("/auth/register", "POST", {
    name: "Another",
    email: "one@example.test",
    password: "secure-pass-123",
  });
  assert.equal(duplicate.response.status, 409);
  const second = await send("/auth/register", "POST", {
    name: "Second User",
    email: "two@example.test",
    password: "another-pass-456",
  });
  assert.equal(second.response.status, 201);
  const isolated = await send("/events", "GET", undefined, second.cookie);
  assert.deepEqual(isolated.data, []);
  const ownerEvents = await send("/events", "GET", undefined, cookie);
  assert.equal(ownerEvents.data.length, 3);
  const foreignCase = await send(
    `/investigations/${inv.data.id}`,
    "GET",
    undefined,
    second.cookie,
  );
  assert.equal(foreignCase.response.status, 404);
  const foreignRelationship = await send(
    "/relationships",
    "POST",
    {
      sourceEventId: event1.data.id,
      targetEventId: event2.data.id,
      kind: "related_to",
    },
    second.cookie,
  );
  assert.equal(foreignRelationship.response.status, 404);
  const invalidRelationship = await send(
    "/relationships",
    "POST",
    {
      sourceEventId: event1.data.id,
      targetEventId: event1.data.id,
      kind: "related_to",
    },
    cookie,
  );
  assert.equal(invalidRelationship.response.status, 400);
  const relationship = await send(
    "/relationships",
    "POST",
    {
      sourceEventId: event1.data.id,
      targetEventId: event2.data.id,
      kind: "depends_on",
    },
    cookie,
  );
  assert.equal(relationship.response.status, 201);
  const dependencyAnalysis = await send(
    "/analysis/detect",
    "GET",
    undefined,
    cookie,
  );
  assert.ok(
    dependencyAnalysis.data.findings.some(
      (finding) => finding.rule === "dependency-order",
    ),
  );
  const edited = await send(
    `/events/${event1.data.id}`,
    "PUT",
    {
      title: "Order created",
      description: "Updated evidence detail",
      type: "order",
      occurredAt: "2026-11-09T10:00:00.000Z",
      source: "orders-api",
    },
    cookie,
  );
  assert.equal(edited.response.status, 200);
  assert.equal(edited.data.description, "Updated evidence detail");
  const removed = await send(
    `/investigations/${inv.data.id}/events/${event2.data.id}`,
    "DELETE",
    undefined,
    cookie,
  );
  assert.equal(removed.response.status, 200);
  const afterRemoval = await send(
    `/investigations/${inv.data.id}`,
    "GET",
    undefined,
    cookie,
  );
  assert.equal(afterRemoval.data.events.length, 2);
  const deletedConnection = await send(
    `/relationships/${relationship.data.id}`,
    "DELETE",
    undefined,
    cookie,
  );
  assert.equal(deletedConnection.response.status, 200);
  const deletedEvent = await send(
    `/events/${event3.data.id}`,
    "DELETE",
    undefined,
    cookie,
  );
  assert.equal(deletedEvent.response.status, 200);
  const deletedCase = await send(
    `/investigations/${inv.data.id}`,
    "DELETE",
    undefined,
    cookie,
  );
  assert.equal(deletedCase.response.status, 200);
  const cases = await send("/investigations", "GET", undefined, cookie);
  assert.deepEqual(cases.data, []);
  const badLogin = await send("/auth/login", "POST", {
    email: "one@example.test",
    password: "not-the-password",
  });
  assert.equal(badLogin.response.status, 401);
  const login = await send("/auth/login", "POST", {
    email: "one@example.test",
    password: "secure-pass-123",
  });
  assert.equal(login.response.status, 200);
  const unauthenticated = await send("/events");
  assert.equal(unauthenticated.response.status, 401);
});
