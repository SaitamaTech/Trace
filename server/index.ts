import "dotenv/config";
import express, {
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { db } from "./database.js";

const app = express();
const port = Number(process.env.PORT || 8787);
const isProduction = process.env.NODE_ENV === "production";
const authSecret =
  process.env.AUTH_SECRET ||
  (isProduction ? "" : "local-development-only-change-me-before-deploying");
const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      })
    : null;
if (
  isProduction &&
  (authSecret.length < 32 || authSecret.startsWith("replace-with-"))
)
  throw new Error("AUTH_SECRET must be at least 32 characters in production.");

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});
for (const param of ["id", "eventId"])
  app.param(param, (_req, _res, next, value) => {
    if (!/^[1-9]\d*$/.test(value))
      return next(
        new HttpError(400, "A positive numeric identifier is required."),
      );
    next();
  });

interface User {
  id: number;
  name: string;
  email: string;
}
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const asyncRoute =
  (fn: (req: Request, res: Response) => Promise<void> | void): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
const body = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new HttpError(
      400,
      result.error.issues.map((issue) => issue.message).join(". "),
    );
  return result.data;
};
const tokenCookie = "trace_session";
function setSession(res: Response, user: User) {
  const token = jwt.sign(
    { sub: String(user.id), name: user.name, email: user.email },
    authSecret,
    { expiresIn: "7d" },
  );
  res.cookie(tokenCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}
const requireAuth: RequestHandler = (req, _res, next) => {
  try {
    const token = req.cookies?.[tokenCookie];
    if (!token) throw new Error("missing session");
    const decoded = jwt.verify(token, authSecret) as jwt.JwtPayload;
    const userId = Number(decoded.sub);
    if (!Number.isInteger(userId)) throw new Error("invalid session");
    const user = db
      .prepare("SELECT id, name, email FROM users WHERE id = ?")
      .get(userId) as User | undefined;
    if (!user) throw new Error("user not found");
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, "Please log in to continue."));
  }
};
const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  email: z.string().trim().email().max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128),
});
const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});
const supabaseAuthSchema = z.object({
  accessToken: z.string().min(1).max(8192),
});
const eventSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).default(""),
  type: z.enum([
    "order",
    "payment",
    "system",
    "communication",
    "security",
    "custom",
  ]),
  occurredAt: z
    .string()
    .datetime({ offset: true })
    .transform((value) => new Date(value).toISOString()),
  source: z.string().trim().min(1).max(160),
});
const investigationSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).default(""),
});
const relationshipSchema = z.object({
  sourceEventId: z.number().int().positive(),
  targetEventId: z.number().int().positive(),
  kind: z.enum([
    "caused_by",
    "followed_by",
    "related_to",
    "contradicts",
    "depends_on",
  ]),
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.post(
  "/api/auth/register",
  asyncRoute(async (req, res) => {
    const input = body(registerSchema, req.body);
    const passwordHash = await bcrypt.hash(input.password, 12);
    try {
      const result = db
        .prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)")
        .run(input.name, input.email.toLowerCase(), passwordHash);
      const user = {
        id: Number(result.lastInsertRowid),
        name: input.name,
        email: input.email.toLowerCase(),
      };
      setSession(res, user);
      res.status(201).json({ user });
    } catch (error) {
      if (String(error).includes("UNIQUE"))
        throw new HttpError(409, "An account with this email already exists.");
      throw error;
    }
  }),
);
app.post(
  "/api/auth/login",
  asyncRoute(async (req, res) => {
    const input = body(loginSchema, req.body);
    const userRow = db
      .prepare(
        "SELECT id,name,email,password_hash FROM users WHERE email = ? COLLATE NOCASE",
      )
      .get(input.email) as (User & { password_hash: string }) | undefined;
    if (
      !userRow ||
      !(await bcrypt.compare(input.password, userRow.password_hash))
    )
      throw new HttpError(401, "Email or password is incorrect.");
    const user = { id: userRow.id, name: userRow.name, email: userRow.email };
    setSession(res, user);
    res.json({ user });
  }),
);
app.post(
  "/api/auth/supabase",
  asyncRoute(async (req, res) => {
    if (!supabase)
      throw new HttpError(
        503,
        "Google sign-in is not configured. Add your Supabase URL and anon key.",
      );
    const { accessToken } = body(supabaseAuthSchema, req.body);
    const { data, error } = await supabase.auth.getUser(accessToken);
    const googleIdentity = data.user?.identities?.some(
      (identity) => identity.provider === "google",
    );
    const email = data.user?.email?.trim().toLowerCase();
    if (
      error ||
      !data.user ||
      !googleIdentity ||
      !data.user.email_confirmed_at ||
      !email
    )
      throw new HttpError(401, "Google sign-in could not be verified.");

    const googleUserId = data.user.id;
    const metadataName =
      data.user.user_metadata?.full_name ?? data.user.user_metadata?.name;
    const name =
      (typeof metadataName === "string" ? metadataName.trim() : "").slice(
        0,
        80,
      ) ||
      email.split("@")[0].slice(0, 80) ||
      "Google user";
    const identityUser = db
      .prepare(
        `SELECT users.id, users.name, users.email
         FROM user_identities
         JOIN users ON users.id = user_identities.user_id
         WHERE user_identities.provider = 'google'
           AND user_identities.provider_user_id = ?`,
      )
      .get(googleUserId) as User | undefined;

    let user = identityUser;
    if (!user) {
      const emailUser = db
        .prepare("SELECT id, name, email FROM users WHERE email = ? COLLATE NOCASE")
        .get(email) as User | undefined;
      const unusablePasswordHash = emailUser
        ? null
        : await bcrypt.hash(randomBytes(32).toString("base64url"), 12);

      user = db.transaction(() => {
        const existingIdentity = db
          .prepare(
            `SELECT users.id, users.name, users.email
             FROM user_identities
             JOIN users ON users.id = user_identities.user_id
             WHERE user_identities.provider = 'google'
               AND user_identities.provider_user_id = ?`,
          )
          .get(googleUserId) as User | undefined;
        if (existingIdentity) return existingIdentity;

        const existingEmailUser = db
          .prepare("SELECT id, name, email FROM users WHERE email = ? COLLATE NOCASE")
          .get(email) as User | undefined;
        const linkedUser =
          existingEmailUser ??
          (() => {
            const result = db
              .prepare(
                "INSERT INTO users(name,email,password_hash) VALUES(?,?,?)",
              )
              .run(name, email, unusablePasswordHash);
            return {
              id: Number(result.lastInsertRowid),
              name,
              email,
            };
          })();
        const existingGoogleIdentity = db
          .prepare(
            "SELECT provider_user_id FROM user_identities WHERE provider = 'google' AND user_id = ?",
          )
          .get(linkedUser.id) as { provider_user_id: string } | undefined;
        if (existingGoogleIdentity)
          throw new HttpError(
            409,
            "This TRACE account is linked to a different Google account.",
          );
        db.prepare(
          "INSERT INTO user_identities(user_id,provider,provider_user_id) VALUES(?,'google',?)",
        ).run(linkedUser.id, googleUserId);
        return linkedUser;
      })();
    }

    setSession(res, user);
    res.json({ user });
  }),
);
app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie(tokenCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
  });
  res.json({ ok: true });
});
app.get("/api/auth/me", requireAuth, (req, res) =>
  res.json({ user: req.user }),
);

app.use("/api", requireAuth);
app.get("/api/overview", (req, res) => {
  const userId = req.user!.id;
  const totalEvents = (
    db
      .prepare("SELECT COUNT(*) AS count FROM events WHERE user_id=?")
      .get(userId) as { count: number }
  ).count;
  const activeInvestigations = (
    db
      .prepare("SELECT COUNT(*) AS count FROM investigations WHERE user_id=?")
      .get(userId) as { count: number }
  ).count;
  const recentEvents = db
    .prepare(
      "SELECT * FROM events WHERE user_id=? ORDER BY occurred_at DESC LIMIT 5",
    )
    .all(userId);
  const recentInvestigations = db
    .prepare(
      `SELECT i.*, COUNT(ie.event_id) AS event_count FROM investigations i LEFT JOIN investigation_events ie ON ie.investigation_id=i.id WHERE i.user_id=? GROUP BY i.id ORDER BY i.updated_at DESC LIMIT 4`,
    )
    .all(userId);
  res.json({
    totalEvents,
    activeInvestigations,
    recentEvents,
    recentInvestigations,
  });
});
app.get("/api/events", (req, res) =>
  res.json(
    db
      .prepare("SELECT * FROM events WHERE user_id=? ORDER BY occurred_at DESC")
      .all(req.user!.id),
  ),
);
app.post("/api/events", (req, res) => {
  const input = body(eventSchema, req.body);
  const userId = req.user!.id;
  const result = db
    .prepare(
      "INSERT INTO events(user_id,title,description,type,occurred_at,source) VALUES(?,?,?,?,?,?)",
    )
    .run(
      userId,
      input.title,
      input.description,
      input.type,
      input.occurredAt,
      input.source,
    );
  res
    .status(201)
    .json(
      db
        .prepare("SELECT * FROM events WHERE id=? AND user_id=?")
        .get(Number(result.lastInsertRowid), userId),
    );
});
app.put("/api/events/:id", (req, res) => {
  const input = body(eventSchema, req.body);
  const userId = req.user!.id;
  const id = Number(req.params.id);
  const result = db
    .prepare(
      "UPDATE events SET title=?,description=?,type=?,occurred_at=?,source=? WHERE id=? AND user_id=?",
    )
    .run(
      input.title,
      input.description,
      input.type,
      input.occurredAt,
      input.source,
      id,
      userId,
    );
  if (!result.changes) throw new HttpError(404, "Event not found.");
  res.json(
    db.prepare("SELECT * FROM events WHERE id=? AND user_id=?").get(id, userId),
  );
});
app.delete("/api/events/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM events WHERE id=? AND user_id=?")
    .run(Number(req.params.id), req.user!.id);
  if (!result.changes) throw new HttpError(404, "Event not found.");
  res.json({ ok: true });
});

app.get("/api/investigations", (req, res) =>
  res.json(
    db
      .prepare(
        `SELECT i.*, COUNT(ie.event_id) AS event_count FROM investigations i LEFT JOIN investigation_events ie ON ie.investigation_id=i.id WHERE i.user_id=? GROUP BY i.id ORDER BY i.updated_at DESC`,
      )
      .all(req.user!.id),
  ),
);
app.post("/api/investigations", (req, res) => {
  const input = body(investigationSchema, req.body);
  const result = db
    .prepare(
      "INSERT INTO investigations(user_id,name,description) VALUES(?,?,?)",
    )
    .run(req.user!.id, input.name, input.description);
  res
    .status(201)
    .json(
      db
        .prepare("SELECT * FROM investigations WHERE id=? AND user_id=?")
        .get(Number(result.lastInsertRowid), req.user!.id),
    );
});
app.put("/api/investigations/:id", (req, res) => {
  const input = body(investigationSchema, req.body);
  const id = Number(req.params.id);
  const result = db
    .prepare(
      "UPDATE investigations SET name=?,description=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=?",
    )
    .run(input.name, input.description, id, req.user!.id);
  if (!result.changes) throw new HttpError(404, "Investigation not found.");
  res.json(
    db
      .prepare("SELECT * FROM investigations WHERE id=? AND user_id=?")
      .get(id, req.user!.id),
  );
});
app.delete("/api/investigations/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM investigations WHERE id=? AND user_id=?")
    .run(Number(req.params.id), req.user!.id);
  if (!result.changes) throw new HttpError(404, "Investigation not found.");
  res.json({ ok: true });
});
app.get("/api/investigations/:id", (req, res) => {
  const userId = req.user!.id;
  const id = Number(req.params.id);
  const investigation = db
    .prepare("SELECT * FROM investigations WHERE id=? AND user_id=?")
    .get(id, userId);
  if (!investigation) throw new HttpError(404, "Investigation not found.");
  const events = db
    .prepare(
      `SELECT e.* FROM events e JOIN investigation_events ie ON ie.event_id=e.id WHERE ie.investigation_id=? AND ie.user_id=? ORDER BY e.occurred_at ASC`,
    )
    .all(id, userId);
  const relationships = db
    .prepare(
      `SELECT r.*, a.title AS source_title, b.title AS target_title FROM relationships r JOIN events a ON a.id=r.source_event_id JOIN events b ON b.id=r.target_event_id JOIN investigation_events ia ON ia.event_id=a.id AND ia.investigation_id=? JOIN investigation_events ib ON ib.event_id=b.id AND ib.investigation_id=? WHERE r.user_id=?`,
    )
    .all(id, id, userId);
  res.json({ investigation, events, relationships });
});
app.post("/api/investigations/:id/events", (req, res) => {
  const investigationId = Number(req.params.id);
  const { eventId } = body(
    z.object({ eventId: z.number().int().positive() }),
    req.body,
  );
  const userId = req.user!.id;
  const inv = db
    .prepare("SELECT id FROM investigations WHERE id=? AND user_id=?")
    .get(investigationId, userId);
  const event = db
    .prepare("SELECT id FROM events WHERE id=? AND user_id=?")
    .get(eventId, userId);
  if (!inv || !event)
    throw new HttpError(404, "Investigation or event not found.");
  db.prepare(
    "INSERT OR IGNORE INTO investigation_events(investigation_id,event_id,user_id) VALUES(?,?,?)",
  ).run(investigationId, eventId, userId);
  db.prepare(
    "UPDATE investigations SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=?",
  ).run(investigationId, userId);
  res.status(201).json({ ok: true });
});
app.delete("/api/investigations/:id/events/:eventId", (req, res) => {
  db.prepare(
    "DELETE FROM investigation_events WHERE investigation_id=? AND event_id=? AND user_id=?",
  ).run(Number(req.params.id), Number(req.params.eventId), req.user!.id);
  res.json({ ok: true });
});

app.get("/api/relationships", (req, res) =>
  res.json(
    db
      .prepare(
        "SELECT * FROM relationships WHERE user_id=? ORDER BY created_at DESC",
      )
      .all(req.user!.id),
  ),
);
app.post("/api/relationships", (req, res) => {
  const input = body(relationshipSchema, req.body);
  const userId = req.user!.id;
  if (input.sourceEventId === input.targetEventId)
    throw new HttpError(400, "Choose two different events.");
  const owned = db
    .prepare("SELECT id FROM events WHERE user_id=? AND id IN (?,?)")
    .all(userId, input.sourceEventId, input.targetEventId) as Array<{
    id: number;
  }>;
  if (owned.length !== 2)
    throw new HttpError(404, "One or both events were not found.");
  try {
    const result = db
      .prepare(
        "INSERT INTO relationships(user_id,source_event_id,target_event_id,kind) VALUES(?,?,?,?)",
      )
      .run(userId, input.sourceEventId, input.targetEventId, input.kind);
    res
      .status(201)
      .json(
        db
          .prepare("SELECT * FROM relationships WHERE id=? AND user_id=?")
          .get(Number(result.lastInsertRowid), userId),
      );
  } catch (error) {
    if (String(error).includes("UNIQUE"))
      throw new HttpError(409, "That relationship already exists.");
    throw error;
  }
});
app.delete("/api/relationships/:id", (req, res) => {
  db.prepare("DELETE FROM relationships WHERE id=? AND user_id=?").run(
    Number(req.params.id),
    req.user!.id,
  );
  res.json({ ok: true });
});

app.get("/api/analysis/detect", (req, res) => {
  const userId = req.user!.id;
  const investigations = db
    .prepare("SELECT id,name FROM investigations WHERE user_id=?")
    .all(userId) as Array<{ id: number; name: string }>;
  const findings: Array<{
    id: string;
    investigationId: number;
    investigationName: string;
    rule: string;
    title: string;
    detail: string;
    severity: "warning" | "critical";
  }> = [];
  const add = (
    investigation: { id: number; name: string },
    rule: string,
    title: string,
    detail: string,
    severity: "warning" | "critical" = "warning",
  ) =>
    findings.push({
      id: `${investigation.id}-${rule}-${findings.length}`,
      investigationId: investigation.id,
      investigationName: investigation.name,
      rule,
      title,
      detail,
      severity,
    });
  for (const inv of investigations) {
    const events = db
      .prepare(
        `SELECT e.* FROM events e JOIN investigation_events ie ON ie.event_id=e.id WHERE ie.investigation_id=? AND ie.user_id=? ORDER BY e.occurred_at ASC`,
      )
      .all(inv.id, userId) as Array<{
      id: number;
      title: string;
      description: string;
      type: string;
      occurred_at: string;
      source: string;
    }>;
    const failedPayment = events.some(
      (e) =>
        e.type === "payment" &&
        /fail|declin|error/i.test(`${e.title} ${e.description}`),
    );
    const successfulOrder = events.some(
      (e) =>
        e.type === "order" &&
        /success|successful|complete|confirm|fulfilled/i.test(
          `${e.title} ${e.description}`,
        ),
    );
    if (failedPayment && successfulOrder)
      add(
        inv,
        "payment-order-conflict",
        "Order success conflicts with failed payment",
        "A payment failure and a successful or completed order appear in the same investigation. Verify the order state against the payment record.",
        "critical",
      );
    const orders = events.filter(
      (e) =>
        e.type === "order" &&
        /created|placed|submitted/i.test(`${e.title} ${e.description}`),
    );
    const payments = events.filter((e) => e.type === "payment");
    if (orders.length && payments.length === 0)
      add(
        inv,
        "missing-payment",
        "Payment event is missing",
        "An order was created or placed, but no payment event is recorded in this investigation.",
      );
    const attempts = payments.filter((e) =>
      /attempt|initiated|processing/i.test(`${e.title} ${e.description}`),
    );
    const outcomes = payments.filter((e) =>
      /success|paid|fail|declin|error/i.test(`${e.title} ${e.description}`),
    );
    if (attempts.length && outcomes.length === 0)
      add(
        inv,
        "missing-payment-outcome",
        "Payment outcome is missing",
        "A payment attempt is recorded, but no success or failure outcome appears in this investigation.",
      );
    const seen = new Map<string, number>();
    for (const event of events) {
      const key = `${event.title.trim().toLowerCase()}|${event.type}|${event.source.trim().toLowerCase()}`;
      const prior = seen.get(key);
      if (prior !== undefined)
        add(
          inv,
          `duplicate-${event.id}`,
          "Possible duplicate event",
          `“${event.title}” appears more than once from ${event.source}. Compare the records before removing either one.`,
        );
      else seen.set(key, event.id);
    }
    const deps = db
      .prepare(
        `SELECT r.*,a.title AS a_title,a.occurred_at AS a_time,b.title AS b_title,b.occurred_at AS b_time FROM relationships r JOIN events a ON a.id=r.source_event_id JOIN events b ON b.id=r.target_event_id JOIN investigation_events ia ON ia.event_id=a.id AND ia.investigation_id=? JOIN investigation_events ib ON ib.event_id=b.id AND ib.investigation_id=? WHERE r.user_id=? AND r.kind='depends_on'`,
      )
      .all(inv.id, inv.id, userId) as Array<{
      a_title: string;
      a_time: string;
      b_title: string;
      b_time: string;
    }>;
    for (const rel of deps)
      if (new Date(rel.a_time).getTime() < new Date(rel.b_time).getTime())
        add(
          inv,
          "dependency-order",
          "Dependency occurs after its dependent",
          `“${rel.a_title}” depends on “${rel.b_title}”, but the dependent event is timestamped earlier.`,
          "critical",
        );
    const contradictions = db
      .prepare(
        `SELECT a.title AS a_title,b.title AS b_title FROM relationships r JOIN events a ON a.id=r.source_event_id JOIN events b ON b.id=r.target_event_id JOIN investigation_events ia ON ia.event_id=a.id AND ia.investigation_id=? JOIN investigation_events ib ON ib.event_id=b.id AND ib.investigation_id=? WHERE r.user_id=? AND r.kind='contradicts'`,
      )
      .all(inv.id, inv.id, userId) as Array<{
      a_title: string;
      b_title: string;
    }>;
    for (const rel of contradictions)
      add(
        inv,
        "explicit-contradiction",
        "Events are marked as contradictory",
        `“${rel.a_title}” is explicitly marked as contradicting “${rel.b_title}”.`,
        "critical",
      );
  }
  res.json({ findings, checkedInvestigations: investigations.length });
});

if (isProduction) {
  const dist = path.resolve(process.cwd(), "dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof HttpError ? err.status : 500;
  const message =
    err instanceof Error ? err.message : "Unexpected server error.";
  if (status === 500) console.error("TRACE API error:", err);
  res
    .status(status)
    .json({
      error:
        status === 500 ? "Something went wrong. Please try again." : message,
    });
});
app.listen(port, "0.0.0.0", () =>
  console.log(`TRACE API listening on http://localhost:${port}`),
);
