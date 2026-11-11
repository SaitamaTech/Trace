import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { api, json } from "./api";
import { supabase, supabaseConfigurationError } from "./supabase";
import type {
  EventInput,
  EventRecord,
  EventType,
  Finding,
  Investigation,
  InvestigationDetail,
  InvestigationInput,
  Overview,
  RelationshipKind,
  User,
} from "./types";

const formatDate = (value: string, compact = false) =>
  new Intl.DateTimeFormat(
    undefined,
    compact
      ? { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
      : {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        },
  ).format(new Date(value));
const localInput = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};
const titleCase = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());

let googleSignInTask: Promise<User> | null = null;
async function completeGoogleSignIn(): Promise<User> {
  if (!supabase)
    throw new Error(
      supabaseConfigurationError ?? "Google sign-in is not configured.",
    );
  if (!googleSignInTask) {
    googleSignInTask = (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const accessToken = data.session?.access_token;
      if (!accessToken)
        throw new Error("Google sign-in did not return an active session.");
      const result = await api<{ user: User }>(
        "/auth/supabase",
        json("POST", { accessToken }),
      );
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });
      if (signOutError) throw signOutError;
      return result.user;
    })();
  }
  try {
    return await googleSignInTask;
  } catch (error) {
    googleSignInTask = null;
    throw error;
  }
}

function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <button className="brand" onClick={onClick} aria-label="TRACE home">
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      <span>TRACE</span>
    </button>
  );
}
function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg className="arrow-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d={diagonal ? "M4 12 12 4M5 4h7v7" : "M2.5 8h10m-4-4 4 4-4 4"} />
    </svg>
  );
}

function Landing({ start }: { start: (mode?: "login" | "register") => void }) {
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  return (
    <div className="marketing">
      <header className="site-nav">
        <div className="nav-inner">
          <Logo
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          />
          <button
            className="mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
          </button>
          <nav className={menu ? "nav-links open" : "nav-links"}>
            <a href="#product" onClick={() => setMenu(false)}>
              Product
            </a>
            <a href="#how" onClick={() => setMenu(false)}>
              How it works
            </a>
            <a href="#features" onClick={() => setMenu(false)}>
              Features
            </a>
            <button
              className="nav-doc"
              onClick={() => {
                setMenu(false);
                setInfo("Documentation");
              }}
            >
              Documentation
            </button>
          </nav>
          <div className="nav-actions">
            <button className="nav-login" onClick={() => start("login")}>
              Log in
            </button>
            <button
              className="button button-small"
              onClick={() => start("register")}
            >
              Sign up <Arrow />
            </button>
          </div>
        </div>
      </header>
      <main>
        <section className="hero section-wrap">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="pulse-dot" /> EVENT INTELLIGENCE, IN CONTEXT
            </div>
            <h1>
              Understand what happened.
              <br />
              <span>Discover why.</span>
            </h1>
            <p className="hero-sub">
              TRACE transforms scattered events into connected timelines,
              helping you reconstruct situations, identify inconsistencies, and
              understand how events relate.
            </p>
            <div className="hero-actions">
              <button className="button" onClick={() => start("register")}>
                Get started <Arrow />
              </button>
              <a className="button button-quiet" href="#how">
                Explore how it works <Arrow />
              </a>
            </div>
            <div className="hero-proof">
              <div className="proof-avatars">
                <i>01</i>
                <i>02</i>
                <i>03</i>
              </div>
              <span>Built for the moments when context matters.</span>
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="TRACE investigation interface preview"
          >
            <div className="ambient-orbit orbit-one" />
            <div className="ambient-orbit orbit-two" />
            <div className="product-window">
              <div className="window-top">
                <div className="window-brand">
                  <span className="brand-mark mini">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>TRACE / INVESTIGATIONS</span>
                </div>
                <div className="window-actions">
                  <span className="window-pill">
                    <i /> LIVE TRACE
                  </span>
                  <span className="dots">•••</span>
                </div>
              </div>
              <div className="case-heading">
                <div>
                  <span className="overline">INVESTIGATION · TR-2048</span>
                  <h3>Order confirmation mismatch</h3>
                </div>
                <span className="case-status">
                  <i /> NEEDS REVIEW
                </span>
              </div>
              <div className="case-meta">
                <span>
                  <b>5</b> connected events
                </span>
                <span className="meta-sep" />
                <span>Last updated 2 minutes ago</span>
              </div>
              <div className="graph-stage">
                <svg
                  className="graph-lines"
                  viewBox="0 0 620 230"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M59 34 C111 34 110 96 157 96 S218 96 259 96 S323 96 358 96 S433 96 477 96 S532 96 568 96" />
                  <path
                    className="line-hot"
                    d="M259 96 C306 96 312 174 358 174 S430 174 477 174"
                  />
                  <path
                    className="line-dash"
                    d="M358 96 C408 96 423 174 477 174"
                  />
                </svg>
                <div className="graph-node node-a">
                  <span className="node-pin green" />
                  <div>
                    <small>10:42:06.081</small>
                    <strong>Order created</strong>
                    <em>orders-api · ORD-8391</em>
                  </div>
                </div>
                <div className="graph-node node-b">
                  <span className="node-pin blue" />
                  <div>
                    <small>10:42:06.312</small>
                    <strong>Payment attempted</strong>
                    <em>checkout · TX-7782</em>
                  </div>
                </div>
                <div className="graph-node node-c">
                  <span className="node-pin red" />
                  <div>
                    <small>10:42:07.004</small>
                    <strong>Payment failed</strong>
                    <em>payments · DECLINED</em>
                  </div>
                </div>
                <div className="graph-node node-d">
                  <span className="node-pin amber" />
                  <div>
                    <small>10:42:08.601</small>
                    <strong>Order marked successful</strong>
                    <em>orders-api · CONFLICT</em>
                  </div>
                </div>
                <div className="graph-node node-e">
                  <span className="node-pin violet" />
                  <div>
                    <small>10:42:09.023</small>
                    <strong>Confirmation sent</strong>
                    <em>messaging · EMAIL</em>
                  </div>
                </div>
              </div>
              <div className="insight-bar">
                <span className="insight-icon">!</span>
                <span>
                  <b>Inconsistency detected</b>
                  <small>Order succeeded despite a failed payment.</small>
                </span>
                <button
                  aria-label="View detail"
                  onClick={() =>
                    document
                      .getElementById("scenario")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  <Arrow diagonal />
                </button>
              </div>
            </div>
            <div className="visual-caption">
              <span>TRACE WORKSPACE / PREVIEW</span>
              <span>FIG. 01 — A CONNECTED STORY</span>
            </div>
          </div>
          <div className="hero-gridline" />
        </section>
        <section id="product" className="problem-section section-wrap">
          <div className="section-kicker">THE SIGNAL IS THERE</div>
          <div className="problem-grid">
            <h2>
              Events happen everywhere.
              <br />
              <span>Understanding them is the challenge.</span>
            </h2>
            <div className="problem-copy">
              <p>
                A payment can fail. An order can be marked complete. A
                confirmation can still be sent. The evidence exists—but it lives
                in different systems, with no clear story connecting it.
              </p>
              <p>
                TRACE brings those events together so the gaps, dependencies,
                and contradictions become impossible to miss.
              </p>
              <a className="text-link" href="#how">
                A clearer way to investigate <Arrow />
              </a>
            </div>
          </div>
          <div className="signal-strip">
            <div className="signal-item">
              <span className="signal-index">01</span>
              <div>
                <b>Dispersed systems</b>
                <small>Logs, services, and people</small>
              </div>
              <span className="signal-arrow">→</span>
            </div>
            <div className="signal-item">
              <span className="signal-index">02</span>
              <div>
                <b>Conflicting signals</b>
                <small>Success beside failure</small>
              </div>
              <span className="signal-arrow">→</span>
            </div>
            <div className="signal-item signal-final">
              <span className="signal-index">03</span>
              <div>
                <b>One connected view</b>
                <small>Context, in sequence</small>
              </div>
              <span className="signal-check">✓</span>
            </div>
          </div>
        </section>
        <section id="how" className="how-section section-wrap">
          <div className="section-heading">
            <div>
              <div className="section-kicker">A SIMPLE INVESTIGATION LOOP</div>
              <h2>
                From scattered events
                <br />
                to a <span>clearer picture.</span>
              </h2>
            </div>
            <p>
              Capture the evidence. Connect the context.
              <br />
              Follow the story where it leads.
            </p>
          </div>
          <div className="steps-grid">
            <article className="step-card">
              <div className="step-top">
                <span>01</span>
                <span className="step-glyph glyph-capture">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <h3>Capture</h3>
              <p>
                Record events from different sources in one structured system,
                with the details and timestamps that matter.
              </p>
              <div className="step-visual capture-lines">
                <i />
                <i />
                <i />
                <i />
              </div>
            </article>
            <article className="step-card">
              <div className="step-top">
                <span>02</span>
                <span className="step-glyph glyph-connect">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <h3>Connect</h3>
              <p>
                Link related events to understand their relationships,
                dependencies, and sequence.
              </p>
              <div className="step-visual connect-lines">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </article>
            <article className="step-card">
              <div className="step-top">
                <span>03</span>
                <span className="step-glyph glyph-investigate">⌕</span>
              </div>
              <h3>Investigate</h3>
              <p>
                Reconstruct the timeline and surface missing, conflicting, or
                unexpected events.
              </p>
              <div className="step-visual investigate-visual">
                <span>↳</span>
                <i />
                <i />
                <i />
              </div>
            </article>
          </div>
        </section>
        <section id="scenario" className="scenario-section section-wrap">
          <div className="scenario-intro">
            <div className="section-kicker">A STORY, RECONSTRUCTED</div>
            <h2>
              One order.
              <br />
              <span>Two different realities.</span>
            </h2>
            <p>
              A customer placed an order. The payment failed, but the order
              system and messaging service both said success.
            </p>
            <div className="scenario-note">
              <span className="note-mark">!</span>
              <span>
                <b>The mismatch is the clue.</b>
                <small>TRACE makes the conflict visible across systems.</small>
              </span>
            </div>
          </div>
          <div className="scenario-board">
            <div className="board-header">
              <span>INVESTIGATION / ORDER-8391</span>
              <span className="board-live">
                <i /> 5 EVENTS
              </span>
            </div>
            <div className="scenario-timeline">
              <div className="scenario-link" />
              <div className="scenario-event">
                <span className="scenario-node normal" />
                <div className="scenario-time">10:42:06</div>
                <div className="scenario-event-name">Order created</div>
                <div className="scenario-source">orders-api</div>
                <span className="event-tag tag-ok">RECORDED</span>
              </div>
              <div className="scenario-event">
                <span className="scenario-node normal" />
                <div className="scenario-time">10:42:06</div>
                <div className="scenario-event-name">Payment attempted</div>
                <div className="scenario-source">checkout</div>
                <span className="event-tag tag-ok">RECORDED</span>
              </div>
              <div className="scenario-event is-alert">
                <span className="scenario-node alert" />
                <div className="scenario-time">10:42:07</div>
                <div className="scenario-event-name">Payment failed</div>
                <div className="scenario-source">payments</div>
                <span className="event-tag tag-alert">DECLINED</span>
              </div>
              <div className="scenario-event is-alert">
                <span className="scenario-node alert" />
                <div className="scenario-time">10:42:08</div>
                <div className="scenario-event-name">
                  Order marked successful
                </div>
                <div className="scenario-source">orders-api</div>
                <span className="event-tag tag-alert">CONFLICT</span>
              </div>
              <div className="scenario-event">
                <span className="scenario-node soft" />
                <div className="scenario-time">10:42:09</div>
                <div className="scenario-event-name">Confirmation sent</div>
                <div className="scenario-source">messaging</div>
                <span className="event-tag tag-soft">SENT</span>
              </div>
            </div>
            <div className="board-footer">
              <span className="footer-connector" />{" "}
              <span>Payment failure conflicts with order success.</span>
              <a href="#features" aria-label="See features">
                <Arrow diagonal />
              </a>
            </div>
          </div>
        </section>
        <section id="features" className="features-section section-wrap">
          <div className="features-head">
            <div className="section-kicker">
              THE TOOLS TO SEE THE WHOLE STORY
            </div>
            <h2>
              Context is the
              <br />
              <span>missing feature.</span>
            </h2>
          </div>
          <div className="features-grid">
            <article>
              <span className="feature-index">01</span>
              <h3>Event recording</h3>
              <p>
                Preserve timestamps, descriptions, types, and sources in one
                reliable record.
              </p>
              <span className="feature-symbol">＋</span>
            </article>
            <article>
              <span className="feature-index">02</span>
              <h3>Timeline reconstruction</h3>
              <p>
                See what happened in chronological order, without stitching logs
                by hand.
              </p>
              <span className="feature-symbol">↗</span>
            </article>
            <article>
              <span className="feature-index">03</span>
              <h3>Event relationships</h3>
              <p>
                Connect cause, sequence, dependency, and contradiction across
                events.
              </p>
              <span className="feature-symbol">⌁</span>
            </article>
            <article>
              <span className="feature-index">04</span>
              <h3>Investigation workspace</h3>
              <p>
                Group relevant evidence around a single question and keep the
                case together.
              </p>
              <span className="feature-symbol">▤</span>
            </article>
            <article>
              <span className="feature-index">05</span>
              <h3>Inconsistency detection</h3>
              <p>
                Deterministic checks help identify suspicious gaps and
                conflicting details.
              </p>
              <span className="feature-symbol">!</span>
            </article>
            <article>
              <span className="feature-index">06</span>
              <h3>Evidence tracking</h3>
              <p>
                Keep each event's original source and details attached to the
                record.
              </p>
              <span className="feature-symbol">⌖</span>
            </article>
          </div>
        </section>
        <section className="cta-section section-wrap">
          <div className="cta-grid" />
          <div className="section-kicker">EVERY EVENT LEAVES A TRACE</div>
          <h2>
            Stop guessing.
            <br />
            <span>Start tracing.</span>
          </h2>
          <p>Build a clearer picture of what happened, one event at a time.</p>
          <button className="button" onClick={() => start("register")}>
            Create your free account <Arrow />
          </button>
          <span className="cta-footnote">
            A focused workspace for your next investigation.
          </span>
        </section>
      </main>
      <footer id="footer" className="site-footer">
        <div className="footer-top">
          <Logo
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          />
          <p>Make the sequence make sense.</p>
          <div className="footer-links">
            <a href="#product">Product</a>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <button
              className="footer-info"
              onClick={() => setInfo("Documentation")}
            >
              Documentation
            </button>
          </div>
          <div className="footer-links">
            <button className="footer-info" onClick={() => setInfo("About")}>
              About
            </button>
            <button className="footer-info" onClick={() => setInfo("Privacy")}>
              Privacy
            </button>
            <button className="footer-info" onClick={() => setInfo("Terms")}>
              Terms
            </button>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 TRACE. All rights reserved.</span>
          <span>EVENT INTELLIGENCE / MADE FOR CLARITY</span>
        </div>
      </footer>
      {info && <InfoDialog kind={info} onClose={() => setInfo(null)} />}
    </div>
  );
}

function InfoDialog({ kind, onClose }: { kind: string; onClose: () => void }) {
  const pages: Record<string, string[]> = {
    Documentation: [
      "Record an event with a title, type, source, timestamp, and optional description. You can edit or delete it from the Events view.",
      "Create an investigation, open it, and add existing events. TRACE orders them chronologically. Connect two linked events to record cause, sequence, dependency, or contradiction.",
      "The overview and case views show deterministic findings. Each finding explains which recorded details triggered the rule.",
    ],
    About: [
      "TRACE is a focused event-intelligence MVP for reconstructing what happened across a system.",
      "It is built with React, TypeScript, Vite, Node.js, Express, and SQLite. No AI or paid service is used for analysis.",
    ],
    Privacy: [
      "The local application stores account and investigation data in the SQLite database controlled by the person running the server. Passwords are stored as bcrypt hashes, not plaintext.",
      "Sessions use HTTP-only cookies. The application does not include third-party analytics or send evidence to an AI provider. Back up and protect the database and environment file.",
    ],
    Terms: [
      "This is an MVP for recording and reviewing events. Deterministic findings are prompts for human investigation, not proof that an incident occurred.",
      "Protect your account, use reliable source information, and maintain backups. Production legal terms should be reviewed and supplied by the operator before a public service launch.",
    ],
  };
  return (
    <Modal title={kind} kicker="TRACE / PRODUCT INFORMATION" onClose={onClose}>
      <div className="info-content">
        {(pages[kind] || []).map((text, index) => (
          <p key={index}>{text}</p>
        ))}
      </div>
    </Modal>
  );
}

function AuthScreen({
  mode,
  onMode,
  onSuccess,
  onBack,
  initialError,
}: {
  mode: "login" | "register";
  onMode: (mode: "login" | "register") => void;
  onSuccess: (user: User) => void;
  onBack: () => void;
  initialError: string;
}) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  async function signInWithGoogle() {
    if (!supabase) {
      setError(
        supabaseConfigurationError ?? "Google sign-in is not configured.",
      );
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (signInError) throw signInError;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start Google sign-in.",
      );
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const values = Object.fromEntries(
      new FormData(event.currentTarget).entries(),
    );
    try {
      const data = await api<{ user: User }>(
        `/auth/${mode}`,
        json("POST", values),
      );
      onSuccess(data.user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not complete your request.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <div className="auth-top">
        <Logo onClick={onBack} />
        <button className="text-link back-link" onClick={onBack}>
          ← Back to TRACE
        </button>
      </div>
      <div className="auth-orb orb-a" />
      <div className="auth-orb orb-b" />
      <div className="auth-float auth-float-a" aria-hidden="true">
        <span className="auth-float-ring"><i /></span>
      </div>
      <div className="auth-float auth-float-b" aria-hidden="true">
        <span className="auth-float-diamond" />
      </div>
      <div className="auth-float auth-float-c" aria-hidden="true">
        <span className="auth-float-bars"><i /><i /><i /><i /><i /></span>
      </div>
      <section className="auth-card" aria-labelledby="auth-title">
        <h1 id="auth-title">
          {mode === "register" ? "Create your account" : "Sign in to TRACE"}
        </h1>
        <p className="auth-sub">
          {mode === "register"
            ? "Get started with your private investigation workspace."
            : "Welcome back. Enter your details to continue."}
        </p>
        <button
          className="google-signin"
          type="button"
          onClick={() => void signInWithGoogle()}
          disabled={busy || !supabase}
        >
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-2 4.6-4.2 6v5.1h6.8c4-3.7 6-8.8 6-14.8Z"
            />
            <path
              fill="#34A853"
              d="M24 44c5.4 0 10-1.8 13.3-4.8l-6.8-5.1c-1.8 1.2-4 2-6.5 2-5 0-9.2-3.4-10.7-8h-7v5.3A20 20 0 0 0 24 44Z"
            />
            <path
              fill="#FBBC05"
              d="M13.3 28.1a12 12 0 0 1 0-7.7v-5.3h-7a20 20 0 0 0 0 18.3l7-5.3Z"
            />
            <path
              fill="#EA4335"
              d="M24 12.4c2.9 0 5.4 1 7.4 2.9l5.8-5.8C33.9 6.2 29.4 4 24 4A20 20 0 0 0 6.3 15.1l7 5.3c1.5-4.6 5.7-8 10.7-8Z"
            />
          </svg>
          Continue with Google
        </button>
        {!supabase && (
          <p className="auth-config-hint" role="status">
            {supabaseConfigurationError}
          </p>
        )}
        <div className="auth-divider">
          <span>or continue with email</span>
        </div>
        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label>
              Full name
              <input
                name="name"
                autoComplete="name"
                autoFocus
                minLength={2}
                maxLength={80}
                required
                placeholder="Alex Morgan"
              />
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus={mode === "login"}
              required
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <div className="password-wrap">
              <input
                type={show ? "text" : "password"}
                name="password"
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                minLength={mode === "register" ? 8 : 1}
                required
                placeholder={
                  mode === "register"
                    ? "At least 8 characters"
                    : "Your password"
                }
              />
              <button
                type="button"
                className="show-pass"
                onClick={() => setShow(!show)}
                aria-label={show ? "Hide password" : "Show password"}
                aria-pressed={show}
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="button auth-submit"
            type="submit"
            disabled={busy}
            aria-busy={busy}
          >
            {busy
              ? "Please wait..."
              : mode === "register"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>
        <div className="auth-switch">
          {mode === "register" ? "Already have an account?" : "New to TRACE?"}{" "}
          <button
            type="button"
            onClick={() => {
              setError("");
              onMode(mode === "register" ? "login" : "register");
            }}
          >
            {mode === "register" ? "Sign in" : "Create an account"}
          </button>
        </div>
        <div className="auth-security">
          <span aria-hidden="true">◈</span>{" "}
          Your investigation data is private to your account.
        </div>
      </section>
      <div className="auth-footer">
        <span>TRACE · EVENT INTELLIGENCE</span>
        <span>© 2026 TRACE</span>
      </div>
    </main>
  );
}

type Page =
  | "overview"
  | "ai"
  | "events"
  | "investigations"
  | "business"
  | "integrations"
  | "activity"
  | "audit"
  | "timeline"
  | "detail"
  | "settings";
const navItems: Array<{ id: Page; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "◫" },
  { id: "ai", label: "AI Workspace", icon: "✦" },
  { id: "events", label: "Events", icon: "⊙" },
  { id: "investigations", label: "Investigations", icon: "⌕" },
  { id: "business", label: "Business Intelligence", icon: "▣" },
  { id: "integrations", label: "Integrations", icon: "◌" },
  { id: "activity", label: "Agent Activity", icon: "⎈" },
  { id: "audit", label: "Audit & Security", icon: "✓" },
  { id: "timeline", label: "Timeline", icon: "↕" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [screen, setScreen] = useState<"landing" | "auth" | "app">("landing");
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [authError, setAuthError] = useState("");
  const [page, setPage] = useState<Page>("overview");
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [eventModal, setEventModal] = useState<{
    open: boolean;
    event?: EventRecord;
  }>({ open: false });
  const [invModal, setInvModal] = useState(false);
  const startAuth = (mode: "login" | "register" = "register") => {
    setAuthError("");
    setAuthMode(mode);
    setScreen("auth");
  };
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoadError("");
    try {
      const [o, e, i, a] = await Promise.all([
        api<Overview>("/overview"),
        api<EventRecord[]>("/events"),
        api<Investigation[]>("/investigations"),
        api<{ findings: Finding[] }>("/analysis/detect"),
      ]);
      setOverview(o);
      setEvents(e);
      setInvestigations(i);
      setFindings(a.findings);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Could not load workspace.",
      );
    }
  }, [user]);
  useEffect(() => {
    let cancelled = false;
    async function initializeSession() {
      const callbackUrl = new URL(window.location.href);
      const isGoogleCallback =
        callbackUrl.pathname === "/auth/callback" ||
        callbackUrl.searchParams.has("code") ||
        callbackUrl.searchParams.has("error");
      if (isGoogleCallback) {
        setAuthMode("login");
        try {
          if (callbackUrl.searchParams.has("error"))
            throw new Error(
              "Google sign-in was cancelled or could not be completed. Please try again.",
            );
          const nextUser = await completeGoogleSignIn();
          window.history.replaceState({}, "", "/");
          if (cancelled) return;
          setUser(nextUser);
          setScreen("app");
          setPage("overview");
        } catch (err) {
          window.history.replaceState({}, "", "/");
          if (cancelled) return;
          setAuthError(
            err instanceof Error
              ? err.message
              : "Google sign-in could not be completed. Please try again.",
          );
          setScreen("auth");
        } finally {
          if (!cancelled) setChecking(false);
        }
        return;
      }
      try {
        const data = await api<{ user: User }>("/auth/me");
        if (cancelled) return;
        setUser(data.user);
        setScreen("app");
      } catch {
        if (!cancelled) setScreen("landing");
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    void initializeSession();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);
  async function logout() {
    try {
      await api("/auth/logout", json("POST"));
    } finally {
      setUser(null);
      setOverview(null);
      setEvents([]);
      setInvestigations([]);
      setFindings([]);
      setPage("overview");
      setSelectedId(null);
      setScreen("landing");
    }
  }
  if (checking)
    return (
      <div className="app-loading">
        <span className="brand-mark">
          <i />
          <i />
          <i />
        </span>
        <span>Opening TRACE…</span>
      </div>
    );
  if (screen === "landing") return <Landing start={startAuth} />;
  if (screen === "auth")
    return (
      <AuthScreen
        mode={authMode}
        onMode={setAuthMode}
        initialError={authError}
        onBack={() => {
          setAuthError("");
          setScreen("landing");
        }}
        onSuccess={(nextUser) => {
          setUser(nextUser);
          setScreen("app");
          setPage("overview");
        }}
      />
    );
  if (!user) return <Landing start={startAuth} />;
  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo onClick={() => setPage("overview")} />
          <span className="sidebar-env">PERSONAL WORKSPACE</span>
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={
                page === item.id ||
                (page === "detail" && item.id === "investigations")
                  ? "active"
                  : ""
              }
              onClick={() => {
                setPage(item.id);
                if (item.id !== "detail") setSelectedId(null);
              }}
            >
              <span className="side-icon">{item.icon}</span>
              {item.label}
              {item.id === "events" && events.length > 0 && (
                <span className="side-count">{events.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <span className="user-avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="user-meta">
              <b>{user.name}</b>
              <small>{user.email}</small>
            </span>
            <button
              className="logout-icon"
              onClick={() => void logout()}
              aria-label="Log out"
              title="Log out"
            >
              ↪
            </button>
          </div>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="workspace-topbar">
          <div className="crumb">
            <span>TRACE</span>
            <b>/</b>
            <span>{page === "detail" ? "Investigation" : titleCase(page)}</span>
          </div>
          <div className="topbar-right">
            <span className="system-status">
              <i /> SYSTEM READY
            </span>
            <button
              className="avatar-small"
              title="Account settings"
              onClick={() => setPage("settings")}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <div className="workspace-content">
          {loadError && (
            <div className="inline-error">
              {loadError}
              <button onClick={() => void refresh()}>Retry</button>
            </div>
          )}
          {page === "overview" && (
            <OverviewPage
              overview={overview}
              investigations={investigations}
              findings={findings}
              onNavigate={setPage}
              onOpen={(id) => {
                setSelectedId(id);
                setPage("detail");
              }}
              onCreate={() => setInvModal(true)}
            />
          )}
          {page === "ai" && <AIWorkspacePage events={events} findings={findings} investigations={investigations} />}
          {page === "events" && (
            <EventsPage
              events={events}
              onCreate={() => setEventModal({ open: true })}
              onEdit={(event) => setEventModal({ open: true, event })}
              onDelete={async (event) => {
                if (
                  !confirm(
                    `Delete “${event.title}”? This also removes it from linked investigations.`,
                  )
                )
                  return;
                try {
                  await api(`/events/${event.id}`, json("DELETE"));
                  setNotice("Event deleted.");
                  await refresh();
                } catch (e) {
                  setNotice(
                    e instanceof Error ? e.message : "Could not delete event.",
                  );
                }
              }}
            />
          )}
          {page === "business" && (
            <BusinessIntelligencePage events={events} findings={findings} investigations={investigations} />
          )}
          {page === "integrations" && <IntegrationsPage />}
          {page === "activity" && <AgentActivityPage />}
          {page === "audit" && <AuditPage findings={findings} investigations={investigations} events={events} />}
          {page === "investigations" && (
            <InvestigationsPage
              investigations={investigations}
              findings={findings}
              onCreate={() => setInvModal(true)}
              onOpen={(id) => {
                setSelectedId(id);
                setPage("detail");
              }}
              onDelete={async (inv) => {
                if (!confirm(`Delete investigation “${inv.name}”?`)) return;
                try {
                  await api(`/investigations/${inv.id}`, json("DELETE"));
                  setNotice("Investigation deleted.");
                  await refresh();
                } catch (e) {
                  setNotice(
                    e instanceof Error
                      ? e.message
                      : "Could not delete investigation.",
                  );
                }
              }}
            />
          )}
          {page === "detail" && selectedId !== null && (
            <InvestigationPage
              id={selectedId}
              allEvents={events}
              findings={findings}
              onBack={() => setPage("investigations")}
              onRefresh={async () => {
                await refresh();
              }}
              onNotice={setNotice}
            />
          )}
          {page === "timeline" && (
            <TimelinePage
              investigations={investigations}
              allEvents={events}
              onOpen={(id) => {
                setSelectedId(id);
                setPage("detail");
              }}
            />
          )}
          {page === "settings" && (
            <SettingsPage user={user} onLogout={() => void logout()} />
          )}
        </div>
      </main>
      {eventModal.open && (
        <EventModal
          event={eventModal.event}
          onClose={() => setEventModal({ open: false })}
          onSave={async (input) => {
            if (eventModal.event)
              await api(`/events/${eventModal.event.id}`, json("PUT", input));
            else await api("/events", json("POST", input));
            setEventModal({ open: false });
            setNotice(eventModal.event ? "Event updated." : "Event recorded.");
            await refresh();
          }}
        />
      )}
      {invModal && (
        <InvestigationModal
          onClose={() => setInvModal(false)}
          onSave={async (input) => {
            await api("/investigations", json("POST", input));
            setInvModal(false);
            setNotice("Investigation created.");
            await refresh();
          }}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          <span>✓</span>
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

function PageHeader({
  kicker,
  title,
  sub,
  action,
}: {
  kicker: string;
  title: string;
  sub: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="section-kicker">{kicker}</div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {action}
    </div>
  );
}
function AIWorkspacePage({
  events,
  findings,
  investigations,
}: {
  events: EventRecord[];
  findings: Finding[];
  investigations: Investigation[];
}) {
  const [prompt, setPrompt] = useState(
    "",
  );
  const [result, setResult] = useState<{
    answer: string;
    model: string;
    evidence: {
      eventCount: number;
      investigationCount: number;
      findingCount: number;
      latestInvestigation: string | null;
      records: Array<{ id: number; title: string; type: string; occurredAt: string }>;
    };
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(
      () => setElapsedSeconds((seconds) => seconds + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    let cancelled = false;
    void api<{ configured: boolean }>("/ai/status")
      .then((status) => {
        if (!cancelled) setConfigured(status.configured);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not check AI configuration.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async () => {
    setBusy(true);
    setElapsedSeconds(0);
    setError("");
    try {
      const next = await api<{
        answer: string;
        model: string;
        evidence: {
          eventCount: number;
          investigationCount: number;
          findingCount: number;
          latestInvestigation: string | null;
          records: Array<{ id: number; title: string; type: string; occurredAt: string }>;
        };
      }>("/ai/brief", json("POST", { prompt }));
      setResult(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate an AI brief.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        kicker="AI-POWERED OPERATIONS"
        title="AI Workspace"
        sub="Investigate operational questions with Gemini reasoning grounded in your TRACE records."
      />
      <div className="ai-workspace">
        <section className="panel ai-compose">
          <div className="ai-compose-heading">
            <div className="ai-orb" aria-hidden="true">✦</div>
            <div>
              <span className="section-kicker">TRACE INTELLIGENCE</span>
              <h2>What should we investigate?</h2>
            </div>
          </div>
          <p className="ai-compose-copy">
            Ask a question about your operations. TRACE will check your records and deterministic findings before asking Gemini to explain what the evidence supports.
          </p>
          <div className="ai-prompts" aria-label="Suggested questions">
            {[
              "Which investigations have unresolved payment or order conflicts?",
              "What evidence is missing to explain a delayed order?",
              "Summarize the highest-risk signals in my workspace.",
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="ai-prompt-chip"
                onClick={() => setPrompt(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <form
            className="ai-form"
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmit();
            }}
          >
            <label className="visually-hidden" htmlFor="ai-question">Your business question</label>
            <textarea
              id="ai-question"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="ai-input"
              rows={4}
              maxLength={2000}
              placeholder="For example: Investigate why order #1024 has not shipped despite a successful payment."
            />
            <div className="ai-form-footer">
              <span className="ai-privacy-note">
                Your question and relevant TRACE records are sent to Google Gemini for this response.
              </span>
              <button className="button" type="submit" disabled={busy || !prompt.trim() || configured === false}>
                {busy ? <><span className="ai-spinner" /> Investigating…</> : <>Run investigation <Arrow /></>}
              </button>
            </div>
          </form>
          {configured === false && (
            <div className="ai-config-notice">
              <b>Gemini is not configured.</b>
              <span>Add <code>GEMINI_API_KEY</code> to the server environment and restart TRACE to enable live responses.</span>
            </div>
          )}
          {error && <div className="inline-error">{error}</div>}
          <div className="ai-data-strip">
            <span>
              <i
                className={`ai-status-dot${configured === false ? " is-off" : configured === null ? " is-checking" : ""}`}
              />
              {configured ? "Gemini configured" : configured === false ? "AI unavailable" : "Checking AI configuration"}
            </span>
            <span>{events.length} events</span>
            <span>{investigations.length} investigations</span>
            <span>{findings.length} deterministic findings</span>
          </div>
        </section>
        {busy ? (
          <section className="panel ai-thinking" role="status" aria-live="polite">
            <div className="ai-thinking-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span className="section-kicker">INVESTIGATION IN PROGRESS</span>
            <h2>Gemini is thinking</h2>
            <p>TRACE has gathered your workspace evidence. Gemini is reviewing it and preparing an answer.</p>
            <span className="ai-thinking-time">
              <i /> {elapsedSeconds}s elapsed · responses may take up to 90 seconds
            </span>
          </section>
        ) : result ? (
          <section className="panel ai-answer">
            <div className="ai-answer-head">
              <div>
                <span className="section-kicker">INVESTIGATION RESULT</span>
                <h2>Evidence review</h2>
              </div>
              <span className="ai-model-badge"><i /> {result.model}</span>
            </div>
            <div className="ai-answer-body">{result.answer}</div>
            <div className="ai-evidence">
              <div className="ai-evidence-title">
                <span className="section-kicker">TRACE CONTEXT</span>
                <span>{result.evidence.eventCount} records reviewed</span>
              </div>
              <div className="ai-evidence-stats">
                <div><strong>{result.evidence.investigationCount}</strong><span>cases in context</span></div>
                <div><strong>{result.evidence.findingCount}</strong><span>rule findings</span></div>
                <div><strong>{result.evidence.records.length}</strong><span>referenced records</span></div>
              </div>
              {result.evidence.records.length > 0 && (
                <ul className="ai-record-list">
                  {result.evidence.records.map((record) => (
                    <li key={record.id}>
                      <span className="ai-record-id">EV-{record.id}</span>
                      <span>{record.title}</span>
                      <small>{titleCase(record.type)} · {formatDate(record.occurredAt, true)}</small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : (
          <section className="ai-empty-state">
            <span className="ai-empty-mark">✦</span>
            <span className="section-kicker">READY TO INVESTIGATE</span>
            <h2>Start with a business question</h2>
            <p>TRACE will retrieve your events, investigations, relationships, and deterministic checks. Gemini will reason over that evidence and call out what is unknown.</p>
            <div className="ai-empty-stats">
              <span><b>{events.length}</b> recorded events</span>
              <span><b>{investigations.length}</b> investigations</span>
              <span><b>{findings.length}</b> rule findings</span>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
function BusinessIntelligencePage({
  events,
  findings,
  investigations,
}: {
  events: EventRecord[];
  findings: Finding[];
  investigations: Investigation[];
}) {
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const event of events) {
      map.set(event.type, (map.get(event.type) ?? 0) + 1);
    }
    return [...map.entries()].map(([type, count]) => ({ type, count }));
  }, [events]);
  const criticalSignals = findings.filter((finding) => finding.severity === "critical").length;
  return (
    <>
      <PageHeader
        kicker="DETERMINISTIC ANALYSIS"
        title="Business Intelligence"
        sub="Operational metrics, rule validation, and investigation quality across your workspace."
      />
      <div className="metric-grid">
        <div className="metric-card">
          <span className="metric-label">EVENT TYPES</span>
          <strong>{byType.reduce((sum, item) => sum + item.count, 0)}</strong>
          <small>{byType.length} categories tracked</small>
        </div>
        <div className="metric-card">
          <span className="metric-label">CRITICAL SIGNALS</span>
          <strong className={criticalSignals ? "metric-alert" : ""}>{criticalSignals}</strong>
          <small>Requires human review</small>
        </div>
        <div className="metric-card">
          <span className="metric-label">ACTIVE CASES</span>
          <strong>{investigations.length}</strong>
          <small>Open investigations</small>
        </div>
        <div className="metric-card metric-quiet">
          <span className="metric-label">VERIFICATION</span>
          <strong>✓</strong>
          <small>Deterministic checks enabled</small>
        </div>
      </div>
      <div className="overview-columns">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">EVENT DISTRIBUTION</span>
              <h2>Operational mix</h2>
            </div>
          </div>
          <div className="list-stack">
            {byType.map((item) => (
              <div key={item.type} className="mini-metric-row">
                <span>{titleCase(item.type)}</span>
                <b>{item.count}</b>
              </div>
            ))}
            {!byType.length && <p className="empty-note">No event categories have been recorded yet.</p>}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">RULE CHECKS</span>
              <h2>Operational risk</h2>
            </div>
          </div>
          <div className="list-stack">
            {findings.slice(0, 5).map((finding) => (
              <div key={finding.id} className="mini-metric-row">
                <span>{finding.title}</span>
                <b className={finding.severity === "critical" ? "danger" : "warning"}>{finding.severity}</b>
              </div>
            ))}
            {!findings.length && <p className="empty-note">No deterministic findings yet. Your records look consistent.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
function IntegrationsPage() {
  const [items, setItems] = useState<Array<{ provider: string; name: string; category: string; status: string; description: string; configured: boolean }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<{ integrations: typeof items }>('/integrations');
        if (!cancelled) setItems(data.integrations);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load integrations.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader
        kicker="CONNECTIVITY"
        title="Integrations"
        sub="Authenticate trusted business systems without letting AI bypass approval checks."
      />
      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">CONNECTED SERVICES</span>
            <h2>Business API adapters</h2>
          </div>
        </div>
        {error && <div className="inline-error">{error}</div>}
        <div className="integration-grid">
          {items.map((item) => (
            <div key={item.provider} className="integration-card">
              <div className="integration-head">
                <span className="case-icon large">◌</span>
                <span className={item.configured ? 'case-indicator has-signals' : 'case-indicator'}>
                  <i />
                  {item.configured ? 'CONNECTED' : 'NOT CONFIGURED'}
                </span>
              </div>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <small>{item.category}</small>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
function AgentActivityPage() {
  const [items, setItems] = useState<Array<{ id: number; name: string; kind: string; status: string; summary: string; tool_names: string; updated_at: string }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<{ tasks: typeof items }>('/agent-activity');
        if (!cancelled) setItems(data.tasks);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load agent activity.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader
        kicker="OPERATIONAL ORCHESTRATION"
        title="Agent Activity"
        sub="Human-visible execution record for investigations, analysis, and tool calling."
      />
      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">ACTIVITY LOG</span>
            <h2>Recent tasks</h2>
          </div>
        </div>
        {error && <div className="inline-error">{error}</div>}
        <div className="list-stack">
          {items.map((item) => (
            <div key={item.id} className="mini-metric-row activity-row">
              <div>
                <strong>{item.name}</strong>
                <small>{item.kind} · {item.tool_names}</small>
              </div>
              <div className="activity-meta">
                <span className={item.status === 'completed' ? 'case-indicator has-signals' : 'case-indicator'}>{item.status}</span>
                <small>{new Date(item.updated_at).toLocaleString()}</small>
              </div>
            </div>
          ))}
          {!items.length && <p className="empty-note">No agent tasks have been recorded yet.</p>}
        </div>
      </div>
    </>
  );
}
function AuditPage({
  findings,
  investigations,
  events,
}: {
  findings: Finding[];
  investigations: Investigation[];
  events: EventRecord[];
}) {
  const [logs, setLogs] = useState<Array<{ id: number; actor_name: string; action_type: string; target_type: string; details: string; approved: number; success: number; created_at: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<{ logs: typeof logs }>('/audit');
        if (!cancelled) setLogs(data.logs);
      } catch {
        if (!cancelled) setLogs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader
        kicker="TRACEABILITY"
        title="Audit & Security"
        sub="Every important action is recorded with approvals, execution outcomes, and operational evidence."
      />
      <div className="metric-grid">
        <div className="metric-card">
          <span className="metric-label">EVENTS</span>
          <strong>{events.length}</strong>
          <small>Recorded in the workspace</small>
        </div>
        <div className="metric-card">
          <span className="metric-label">INVESTIGATIONS</span>
          <strong>{investigations.length}</strong>
          <small>All tied to account ownership</small>
        </div>
        <div className="metric-card">
          <span className="metric-label">FINDINGS</span>
          <strong>{findings.length}</strong>
          <small>Deterministic validation results</small>
        </div>
        <div className="metric-card metric-quiet">
          <span className="metric-label">APPROVAL FLOW</span>
          <strong>Y/N</strong>
          <small>Human approval required for actions</small>
        </div>
      </div>
      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">VERIFIED ACTIVITY</span>
            <h2>Recent audit log</h2>
          </div>
        </div>
        <div className="list-stack">
          {logs.map((log) => (
            <div key={log.id} className="mini-metric-row activity-row">
              <div>
                <strong>{log.action_type}</strong>
                <small>{log.actor_name} · {log.details}</small>
              </div>
              <div className="activity-meta">
                <span className={log.success ? 'case-indicator has-signals' : 'case-indicator'}>{log.success ? 'SUCCESS' : 'FAILED'}</span>
                <small>{new Date(log.created_at).toLocaleString()}</small>
              </div>
            </div>
          ))}
          {!logs.length && <p className="empty-note">No audit records yet. The workspace is ready for secure operational execution.</p>}
        </div>
      </div>
    </>
  );
}
function OverviewPage({
  overview,
  investigations,
  findings,
  onNavigate,
  onOpen,
  onCreate,
}: {
  overview: Overview | null;
  investigations: Investigation[];
  findings: Finding[];
  onNavigate: (p: Page) => void;
  onOpen: (id: number) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <PageHeader
        kicker="YOUR SIGNAL, IN CONTEXT"
        title="Overview"
        sub="A clear view of the evidence you have collected."
        action={
          <button className="button" onClick={onCreate}>
            ＋ New investigation
          </button>
        }
      />
      <div className="metric-grid">
        <div className="metric-card">
          <span className="metric-label">EVENTS RECORDED</span>
          <strong>{overview?.totalEvents ?? "—"}</strong>
          <small>
            <span className="metric-line" /> Across your workspace
          </small>
        </div>
        <div className="metric-card">
          <span className="metric-label">INVESTIGATIONS</span>
          <strong>{overview?.activeInvestigations ?? "—"}</strong>
          <small>
            <span className="metric-line violet" /> Active case files
          </small>
        </div>
        <div className="metric-card">
          <span className="metric-label">SIGNALS TO REVIEW</span>
          <strong className={findings.length ? "metric-alert" : ""}>
            {findings.length}
          </strong>
          <small>
            <span className={`metric-line ${findings.length ? "red" : ""}`} />{" "}
            Deterministic checks
          </small>
        </div>
        <div className="metric-card metric-quiet">
          <span className="metric-label">DATA OWNERSHIP</span>
          <strong>
            <span className="lock-dot">◈</span>
          </strong>
          <small>Private to your account</small>
        </div>
      </div>
      {findings.length > 0 && (
        <section className="panel findings-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">DETERMINISTIC CHECKS</span>
              <h2>Signals worth a closer look</h2>
            </div>
            <span className="count-badge red-badge">
              {findings.length} found
            </span>
          </div>
          <div className="finding-list">
            {findings.slice(0, 3).map((f) => (
              <button
                key={f.id}
                className="finding-row"
                onClick={() => onOpen(f.investigationId)}
              >
                <span className={`finding-mark ${f.severity}`}>!</span>
                <span className="finding-copy">
                  <b>{f.title}</b>
                  <small>{f.detail}</small>
                </span>
                <span className="finding-case">{f.investigationName}</span>
                <Arrow diagonal />
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="overview-columns">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">LATEST SIGNALS</span>
              <h2>Recent events</h2>
            </div>
            <button className="panel-link" onClick={() => onNavigate("events")}>
              All events <Arrow />
            </button>
          </div>
          {overview?.recentEvents.length ? (
            <div className="mini-event-list">
              {overview.recentEvents.map((e) => (
                <div className="mini-event" key={e.id}>
                  <EventDot type={e.type} />
                  <div className="mini-event-copy">
                    <b>{e.title}</b>
                    <small>
                      {e.source} · {titleCase(e.type)}
                    </small>
                  </div>
                  <time>{formatDate(e.occurred_at, true)}</time>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No events recorded yet"
              text="Capture the first event to begin building a timeline."
              action={
                <button
                  className="text-link"
                  onClick={() => onNavigate("events")}
                >
                  Go to events <Arrow />
                </button>
              }
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">OPEN THREADS</span>
              <h2>Investigations</h2>
            </div>
            <button
              className="panel-link"
              onClick={() => onNavigate("investigations")}
            >
              All cases <Arrow />
            </button>
          </div>
          {investigations.length ? (
            <div className="mini-investigation-list">
              {investigations.slice(0, 4).map((inv) => (
                <button
                  className="mini-investigation"
                  key={inv.id}
                  onClick={() => onOpen(inv.id)}
                >
                  <span className="case-icon">⌕</span>
                  <span>
                    <b>{inv.name}</b>
                    <small>{inv.event_count ?? 0} connected events</small>
                  </span>
                  <Arrow diagonal />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No investigations yet"
              text="Group related events around a question."
              action={
                <button className="text-link" onClick={onCreate}>
                  Create an investigation <Arrow />
                </button>
              }
            />
          )}
        </section>
      </div>
      <div className="workspace-footnote">
        <span>TRACE / LOCAL WORKSPACE</span>
        <span>Events are ordered by their recorded timestamps.</span>
      </div>
    </>
  );
}
function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-glyph">⌁</span>
      <b>{title}</b>
      <p>{text}</p>
      {action}
    </div>
  );
}
function EventDot({ type }: { type: string }) {
  return <span className={`event-dot dot-${type}`} />;
}
function EventsPage({
  events,
  onCreate,
  onEdit,
  onDelete,
}: {
  events: EventRecord[];
  onCreate: () => void;
  onEdit: (e: EventRecord) => void;
  onDelete: (e: EventRecord) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (filter === "all" || e.type === filter) &&
          `${e.title} ${e.description} ${e.source}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [events, filter, query],
  );
  return (
    <>
      <PageHeader
        kicker="THE RAW EVIDENCE"
        title="Events"
        sub="Every recorded signal, with its source and timestamp."
        action={
          <button className="button" onClick={onCreate}>
            ＋ Record event
          </button>
        }
      />
      <div className="toolbar">
        <div className="search-field">
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events or sources…"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter by event type"
        >
          <option value="all">All types</option>
          {[
            "order",
            "payment",
            "system",
            "communication",
            "security",
            "custom",
          ].map((t) => (
            <option key={t} value={t}>
              {titleCase(t)}
            </option>
          ))}
        </select>
        <span className="result-count">
          {filtered.length} {filtered.length === 1 ? "event" : "events"}
        </span>
      </div>
      {filtered.length ? (
        <div className="events-table-wrap">
          <table className="events-table">
            <thead>
              <tr>
                <th>EVENT</th>
                <th>TYPE</th>
                <th>SOURCE</th>
                <th>OCCURRED</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="table-title">
                      <EventDot type={e.type} />
                      <span>
                        <b>{e.title}</b>
                        <small>
                          {e.description || "No description provided"}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`type-chip chip-${e.type}`}>
                      {titleCase(e.type)}
                    </span>
                  </td>
                  <td className="source-cell">{e.source}</td>
                  <td className="time-cell">
                    {formatDate(e.occurred_at, true)}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        onClick={() => onEdit(e)}
                        aria-label={`Edit ${e.title}`}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => onDelete(e)}
                        aria-label={`Delete ${e.title}`}
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel empty-panel">
          <EmptyState
            title={
              events.length ? "No matching events" : "Your event log is clear"
            }
            text={
              events.length
                ? "Try a different search or event type."
                : "Record an event to start connecting the dots."
            }
            action={
              !events.length ? (
                <button className="button button-quiet" onClick={onCreate}>
                  ＋ Record first event
                </button>
              ) : undefined
            }
          />
        </div>
      )}
    </>
  );
}
function InvestigationsPage({
  investigations,
  findings,
  onCreate,
  onOpen,
  onDelete,
}: {
  investigations: Investigation[];
  findings: Finding[];
  onCreate: () => void;
  onOpen: (id: number) => void;
  onDelete: (i: Investigation) => void;
}) {
  return (
    <>
      <PageHeader
        kicker="FOLLOW THE THREAD"
        title="Investigations"
        sub="Keep related events together around the question you are answering."
        action={
          <button className="button" onClick={onCreate}>
            ＋ New investigation
          </button>
        }
      />
      {investigations.length ? (
        <div className="investigation-grid">
          {investigations.map((inv) => {
            const signals = findings.filter(
              (f) => f.investigationId === inv.id,
            ).length;
            return (
              <article className="investigation-card" key={inv.id}>
                <button
                  className="inv-card-main"
                  onClick={() => onOpen(inv.id)}
                >
                  <div className="inv-card-top">
                    <span className="case-icon large">⌕</span>
                    <span
                      className={
                        signals
                          ? "case-indicator has-signals"
                          : "case-indicator"
                      }
                    >
                      <i />
                      {signals
                        ? `${signals} SIGNAL${signals > 1 ? "S" : ""}`
                        : "IN PROGRESS"}
                    </span>
                  </div>
                  <h2>{inv.name}</h2>
                  <p>{inv.description || "No investigation notes yet."}</p>
                  <div className="inv-card-foot">
                    <span>{inv.event_count ?? 0} linked events</span>
                    <span>Updated {formatDate(inv.updated_at, true)}</span>
                    <Arrow diagonal />
                  </div>
                </button>
                <button
                  className="inv-delete"
                  onClick={() => onDelete(inv)}
                  title="Delete investigation"
                  aria-label={`Delete ${inv.name}`}
                >
                  ×
                </button>
              </article>
            );
          })}
          <button className="new-investigation-card" onClick={onCreate}>
            <span>＋</span>
            <b>Start a new investigation</b>
            <small>Define the question. Add the evidence.</small>
          </button>
        </div>
      ) : (
        <div className="panel empty-panel">
          <EmptyState
            title="Every investigation starts with a question"
            text="Create a case, then add the events that help answer it."
            action={
              <button className="button" onClick={onCreate}>
                ＋ New investigation
              </button>
            }
          />
        </div>
      )}
    </>
  );
}
function InvestigationPage({
  id,
  allEvents,
  findings,
  onBack,
  onRefresh,
  onNotice,
}: {
  id: number;
  allEvents: EventRecord[];
  findings: Finding[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onNotice: (s: string) => void;
}) {
  const [detail, setDetail] = useState<InvestigationDetail | null>(null);
  const [err, setErr] = useState("");
  const [addId, setAddId] = useState("");
  const [relOpen, setRelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setErr("");
      setDetail(await api<InvestigationDetail>(`/investigations/${id}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load investigation.");
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  const members = new Set(detail?.events.map((e) => e.id) ?? []);
  const unlinked = allEvents.filter((e) => !members.has(e.id));
  const caseFindings = findings.filter((f) => f.investigationId === id);
  async function addEvent() {
    if (!addId) return;
    setBusy(true);
    try {
      await api(
        `/investigations/${id}/events`,
        json("POST", { eventId: Number(addId) }),
      );
      setAddId("");
      await load();
      await onRefresh();
      onNotice("Event added to investigation.");
    } catch (e) {
      onNotice(e instanceof Error ? e.message : "Could not add event.");
    } finally {
      setBusy(false);
    }
  }
  async function removeEvent(event: EventRecord) {
    if (
      !confirm(
        `Remove “${event.title}” from this investigation? The event itself will remain in your event log.`,
      )
    )
      return;
    await api(`/investigations/${id}/events/${event.id}`, json("DELETE"));
    await load();
    await onRefresh();
    onNotice("Event removed from this investigation.");
  }
  if (err)
    return (
      <div className="panel empty-panel">
        <button className="panel-link" onClick={onBack}>
          ← Investigations
        </button>
        <EmptyState title="Could not open this investigation" text={err} />
      </div>
    );
  if (!detail)
    return <div className="detail-loading">Loading investigation…</div>;
  const inv = detail.investigation;
  return (
    <>
      <button className="back-inline" onClick={onBack}>
        ← All investigations
      </button>
      <PageHeader
        kicker={`CASE TR-${String(inv.id).padStart(4, "0")}`}
        title={inv.name}
        sub={
          inv.description ||
          "A focused view of the evidence, sequence, and relationships."
        }
        action={
          <button
            className="button button-quiet"
            onClick={() => setRelOpen(true)}
            disabled={detail.events.length < 2}
          >
            ↗ Connect events
          </button>
        }
      />
      {caseFindings.length > 0 && (
        <section className="panel findings-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">RULE-BASED REVIEW</span>
              <h2>
                {caseFindings.length} signal
                {caseFindings.length === 1 ? "" : "s"} to check
              </h2>
            </div>
          </div>
          <div className="finding-list">
            {caseFindings.map((f) => (
              <div className="finding-row static" key={f.id}>
                <span className={`finding-mark ${f.severity}`}>!</span>
                <span className="finding-copy">
                  <b>{f.title}</b>
                  <small>{f.detail}</small>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="detail-grid">
        <section className="panel timeline-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">CHRONOLOGICAL ORDER</span>
              <h2>Evidence timeline</h2>
            </div>
            <span className="count-badge">{detail.events.length} events</span>
          </div>
          {detail.events.length ? (
            <div className="detail-timeline">
              {detail.events.map((e, index) => (
                <article className="timeline-entry" key={e.id}>
                  <div className="timeline-rail">
                    <span className={`timeline-node node-${e.type}`} />
                    {index < detail.events.length - 1 && (
                      <span className="timeline-stem" />
                    )}
                  </div>
                  <div className="timeline-entry-main">
                    <div className="timeline-entry-head">
                      <time>{formatDate(e.occurred_at)}</time>
                      <span className={`type-chip chip-${e.type}`}>
                        {titleCase(e.type)}
                      </span>
                      <button
                        className="small-remove"
                        onClick={() => void removeEvent(e)}
                        title="Remove from investigation"
                      >
                        Remove
                      </button>
                    </div>
                    <h3>{e.title}</h3>
                    <p>{e.description || "No description provided."}</p>
                    <div className="timeline-source">
                      <span>ORIGIN</span>
                      {e.source}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No evidence linked yet"
              text="Add existing events to begin reconstructing the sequence."
            />
          )}
          <div className="add-event-row">
            <select
              value={addId}
              onChange={(e) => setAddId(e.target.value)}
              aria-label="Select event to add"
            >
              <option value="">
                {unlinked.length
                  ? "Choose an event to add…"
                  : "All recorded events are linked"}
              </option>
              {unlinked.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} — {e.source}
                </option>
              ))}
            </select>
            <button
              className="button button-small"
              disabled={!addId || busy}
              onClick={() => void addEvent()}
            >
              Add event
            </button>
          </div>
        </section>
        <aside className="detail-side">
          <section className="panel relation-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">BETWEEN EVENTS</span>
                <h2>Relationships</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setRelOpen(true)}
                disabled={detail.events.length < 2}
                aria-label="Add relationship"
              >
                ＋
              </button>
            </div>
            {detail.relationships.length ? (
              <div className="relation-list">
                {detail.relationships.map((r) => (
                  <div className="relation-item" key={r.id}>
                    <span className="relation-line" />
                    <div>
                      <b>{r.source_title}</b>
                      <small>{titleCase(r.kind)}</small>
                      <b>{r.target_title}</b>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relation-empty">
                <span className="relation-glyph">⌁</span>
                <p>Connect events to record how they relate.</p>
                <button
                  className="text-link"
                  disabled={detail.events.length < 2}
                  onClick={() => setRelOpen(true)}
                >
                  Create a connection <Arrow />
                </button>
              </div>
            )}
          </section>
          <section className="panel case-info">
            <span className="section-kicker">CASE DETAILS</span>
            <div className="case-info-line">
              <span>Created</span>
              <b>{formatDate(inv.created_at, true)}</b>
            </div>
            <div className="case-info-line">
              <span>Evidence</span>
              <b>{detail.events.length} linked events</b>
            </div>
            <div className="case-info-line">
              <span>Review mode</span>
              <b>
                <span className="mode-dot" /> Rule-based
              </b>
            </div>
            <p>
              TRACE uses predictable checks. Findings explain exactly which
              recorded details triggered them.
            </p>
          </section>
        </aside>
      </div>
      {relOpen && (
        <RelationshipModal
          events={detail.events}
          onClose={() => setRelOpen(false)}
          onSave={async (sourceEventId, targetEventId, kind) => {
            await api(
              "/relationships",
              json("POST", { sourceEventId, targetEventId, kind }),
            );
            setRelOpen(false);
            await load();
            await onRefresh();
            onNotice("Relationship connected.");
          }}
        />
      )}
    </>
  );
}
function RelationshipModal({
  events,
  onClose,
  onSave,
}: {
  events: EventRecord[];
  onClose: () => void;
  onSave: (a: number, b: number, k: RelationshipKind) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [kind, setKind] = useState<RelationshipKind>("related_to");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(Number(source), Number(target), kind);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create relationship.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      onClose={onClose}
      title="Connect two events"
      kicker="EVENT RELATIONSHIP"
    >
      <form className="modal-form" onSubmit={submit}>
        <label>
          First event
          <select
            required
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="">Select event</option>
            {events.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Relationship
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as RelationshipKind)}
          >
            {(
              [
                "caused_by",
                "followed_by",
                "related_to",
                "contradicts",
                "depends_on",
              ] as RelationshipKind[]
            ).map((k) => (
              <option key={k} value={k}>
                {titleCase(k)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Second event
          <select
            required
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Select event</option>
            {events
              .filter((e) => String(e.id) !== source)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
          </select>
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button" disabled={busy || !source || !target}>
            {busy ? "Connecting…" : "Create connection"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function TimelinePage({
  investigations,
  allEvents,
  onOpen,
}: {
  investigations: Investigation[];
  allEvents: EventRecord[];
  onOpen: (id: number) => void;
}) {
  const [id, setId] = useState("");
  const [detail, setDetail] = useState<InvestigationDetail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setDetail(null);
    if (!id) return;
    api<InvestigationDetail>(`/investigations/${id}`)
      .then(setDetail)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Could not load timeline."),
      );
  }, [id]);
  return (
    <>
      <PageHeader
        kicker="SEQUENCE, WITHOUT THE GUESSWORK"
        title="Timeline"
        sub="Reconstruct what happened in chronological order."
      />
      <div className="timeline-select">
        <label htmlFor="timeline-case">INVESTIGATION</label>
        <select
          id="timeline-case"
          value={id}
          onChange={(e) => {
            setError("");
            setId(e.target.value);
          }}
        >
          <option value="">Select an investigation…</option>
          {investigations.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        {detail && (
          <button
            className="text-link"
            onClick={() => onOpen(detail.investigation.id)}
          >
            Open case details <Arrow />
          </button>
        )}
      </div>
      {error && <div className="inline-error">{error}</div>}
      {!id ? (
        <div className="panel empty-panel">
          <EmptyState
            title="Choose an investigation"
            text={
              investigations.length
                ? "Select a case above to see its events in order."
                : "Create an investigation and connect events to reconstruct a timeline."
            }
          />
        </div>
      ) : detail?.events.length ? (
        <section className="panel full-timeline">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">
                {detail.investigation.name}
              </span>
              <h2>{detail.events.length} events in sequence</h2>
            </div>
            <span className="count-badge">EARLIEST → LATEST</span>
          </div>
          <div className="detail-timeline">
            {detail.events.map((e, index) => (
              <article className="timeline-entry" key={e.id}>
                <div className="timeline-rail">
                  <span className={`timeline-node node-${e.type}`} />
                  {index < detail.events.length - 1 && (
                    <span className="timeline-stem" />
                  )}
                </div>
                <div className="timeline-entry-main">
                  <div className="timeline-entry-head">
                    <time>{formatDate(e.occurred_at)}</time>
                    <span className={`type-chip chip-${e.type}`}>
                      {titleCase(e.type)}
                    </span>
                  </div>
                  <h3>{e.title}</h3>
                  <p>{e.description || "No description provided."}</p>
                  <div className="timeline-source">
                    <span>ORIGIN</span>
                    {e.source}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : detail ? (
        <div className="panel empty-panel">
          <EmptyState
            title="This case has no events yet"
            text="Add events to its investigation workspace to build the timeline."
            action={
              <button
                className="text-link"
                onClick={() => onOpen(detail.investigation.id)}
              >
                Open investigation <Arrow />
              </button>
            }
          />
        </div>
      ) : allEvents.length === 0 ? (
        <div className="panel empty-panel">
          <EmptyState
            title="No events recorded"
            text="Record an event, then connect it to an investigation."
          />
        </div>
      ) : (
        <div className="detail-loading">Loading timeline…</div>
      )}
    </>
  );
}
function SettingsPage({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  return (
    <>
      <PageHeader
        kicker="PREFERENCES & ACCESS"
        title="Settings"
        sub="Account details and workspace controls."
      />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <span className="section-kicker">ACCOUNT</span>
          <h2>Your profile</h2>
          <div className="profile-block">
            <span className="user-avatar big-avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <b>{user.name}</b>
              <small>{user.email}</small>
            </div>
          </div>
          <div className="settings-line">
            <span>Sign-in method</span>
            <b>Email and password</b>
          </div>
          <div className="settings-line">
            <span>Workspace access</span>
            <b>
              <span className="mode-dot" /> Private
            </b>
          </div>
        </section>
        <section className="panel settings-panel">
          <span className="section-kicker">DETECTION</span>
          <h2>How TRACE checks signals</h2>
          <p>
            Checks are deterministic and run only against your recorded events
            and relationships. TRACE does not send your data to an AI service.
          </p>
          <ul className="rule-list">
            <li>Failed payment alongside a successful order</li>
            <li>Missing payment attempt or outcome</li>
            <li>Duplicate title, type, and source within a case</li>
            <li>Dependency ordering and explicit contradictions</li>
          </ul>
        </section>
        <section className="panel settings-panel">
          <span className="section-kicker">SESSION</span>
          <h2>Account access</h2>
          <p>
            Log out of this browser session. Your investigations remain saved in
            the local database.
          </p>
          <button
            className="button button-quiet danger-button"
            onClick={onLogout}
          >
            Log out of TRACE <Arrow />
          </button>
        </section>
      </div>
    </>
  );
}
function EventModal({
  event,
  onClose,
  onSave,
}: {
  event?: EventRecord;
  onClose: () => void;
  onSave: (input: EventInput) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: EventInput = {
      title: String(fd.get("title")),
      description: String(fd.get("description") || ""),
      type: String(fd.get("type")) as EventType,
      occurredAt: new Date(String(fd.get("occurredAt"))).toISOString(),
      source: String(fd.get("source")),
    };
    setBusy(true);
    setError("");
    try {
      await onSave(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save event.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      onClose={onClose}
      title={event ? "Edit event" : "Record an event"}
      kicker={event ? "UPDATE THE EVIDENCE" : "ADD TO THE EVENT LOG"}
    >
      <form className="modal-form" onSubmit={submit}>
        <label>
          Event title
          <input
            name="title"
            required
            minLength={2}
            maxLength={160}
            defaultValue={event?.title || ""}
            placeholder="e.g. Payment authorization declined"
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            rows={3}
            maxLength={4000}
            defaultValue={event?.description || ""}
            placeholder="What happened? Include the details that matter."
          />
        </label>
        <div className="form-pair">
          <label>
            Event type
            <select name="type" defaultValue={event?.type || "system"}>
              {[
                "order",
                "payment",
                "system",
                "communication",
                "security",
                "custom",
              ].map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Source
            <input
              name="source"
              required
              maxLength={160}
              defaultValue={event?.source || ""}
              placeholder="e.g. payments-api"
            />
          </label>
        </div>
        <label>
          When did it happen?
          <input
            type="datetime-local"
            name="occurredAt"
            required
            defaultValue={localInput(event?.occurred_at)}
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : event ? "Save changes" : "Save event"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function InvestigationModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: InvestigationInput) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await onSave({
        name: String(fd.get("name")),
        description: String(fd.get("description") || ""),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create investigation.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      onClose={onClose}
      title="Start an investigation"
      kicker="DEFINE THE QUESTION"
    >
      <form className="modal-form" onSubmit={submit}>
        <label>
          Investigation name
          <input
            name="name"
            required
            minLength={2}
            maxLength={160}
            placeholder="e.g. Order confirmation mismatch"
          />
        </label>
        <label>
          What are you investigating?
          <textarea
            name="description"
            rows={4}
            maxLength={4000}
            placeholder="Add a little context to help frame the case."
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? "Creating…" : "Create investigation"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Modal({
  children,
  onClose,
  title,
  kicker,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  kicker: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <div>
            <div className="section-kicker">{kicker}</div>
            <h2>{title}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default App;
