import Link from "next/link";

const features = [
  { name: "Instant Conferences", description: "Zero-latency Jitsi video rooms with host moderator controls" },
  { name: "Linear-Style Roster", description: "Sprint Backlog member table with granular AWS IAM policy controls" },
  { name: "Time-Grid Calendar", description: "Interactive schedule grid synchronized with monthly calendar queries" },
  { name: "Floating Mini-Player", description: "Docked 320x480px portrait player with Document Picture-in-Picture" },
  { name: "Notification Drawer", description: "Slide-over right rail drawer with one-click live call termination" },
  { name: "GitHub Settings", description: "Two-column workspace preferences with 1px hairline rules" },
  { name: "Enterprise Auth", description: "HttpOnly secure cookie authentication with email verification OTP" },
  { name: "Agentic AI Tools", description: "Automated synthesis of action items and session transcripts" },
];

const benefits = [
  {
    number: "01",
    title: "Governed video collaboration",
    copy: "Control who can initiate meetings, manage participants, or invoke AI with AWS IAM-style granular permissions.",
  },
  {
    number: "02",
    title: "Multitask while in session",
    copy: "Keep meeting context alive in a floating docked player or native desktop Picture-in-Picture overlay.",
  },
  {
    number: "03",
    title: "Enterprise warm-neutral design",
    copy: "Built strictly following the Oracle design system with zero shadows, 4px border radii, and bookish Georgia typography.",
  },
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default function Home() {
  return (
    <main>
      <header className="masthead">
        <div className="shell masthead-inner">
          <Link className="wordmark" href="/" aria-label="AI Meeting Platform home">
            <span className="wordmark-mark">◒</span>
            <span>Hrnbyl Meetings</span>
          </Link>
          <nav className="main-nav" aria-label="Main navigation">
            <Link href="/meetings">Overview</Link>
            <Link href="/meetings/teams">Teams</Link>
            <Link href="/meetings/calendar">Calendar</Link>
            <Link href="/settings">Settings</Link>
          </nav>
          <div className="masthead-actions">
            <Link className="text-link" href="/login">
              Log in
            </Link>
            <Link className="button button-small" href="/signup">
              Get started <Arrow />
            </Link>
          </div>
        </div>
      </header>

      <section className="hero-band">
        <div className="hero-pattern" />
        <div className="shell hero-content">
          <p className="eyebrow">Enterprise Agentic Meeting Platform</p>
          <h1>
            Engineered for high-focus<br />
            <em>collaboration.</em>
          </h1>
          <div className="gold-rule" />
          <p className="hero-lead">
            Integrated Jitsi videobridge, Linear-style sprint backlog team roster,
            interactive time-grid calendar, and desktop Picture-in-Picture.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/meetings">
              Enter Workspace <Arrow />
            </Link>
            <Link className="button button-outline" href="/signup">
              Create Free Account <Arrow />
            </Link>
          </div>
          <p className="hero-note">Enterprise-grade security · Zero drop shadows · AWS IAM governance</p>
        </div>
      </section>

      <section className="product-nav" id="product">
        <div className="shell">
          <p className="section-kicker">Integrated Features</p>
          <div className="product-grid">
            {features.map((item, index) => (
              <Link
                className={`nav-tile${index === 0 ? " nav-tile-active" : ""}`}
                href="/meetings"
                key={item.name}
              >
                <span className="nav-tile-name">{item.name}</span>
                <span className="nav-tile-copy">{item.description}</span>
                <Arrow />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-soft" id="why">
        <div className="shell intro-grid">
          <div>
            <p className="section-kicker">Architectural Excellence</p>
            <h2>
              Less friction.<br />
              <span>More focus.</span>
            </h2>
          </div>
          <div className="intro-copy">
            <p>
              Built with Next.js App Router, Tailwind CSS, shadcn/ui base-mira tokens,
              and a Django REST backend powered by SimpleJWT HttpOnly cookies.
            </p>
            <Link className="inline-link" href="/meetings/teams">
              Explore Team Management <Arrow />
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-white">
        <div className="shell">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Design Foundations</p>
              <h2>Structured for clarity.</h2>
            </div>
            <p className="section-summary">Warm neutral ladder depth without synthetic box shadows.</p>
          </div>
          <div className="benefit-grid">
            {benefits.map((benefit) => (
              <article className="benefit-card" key={benefit.number}>
                <span className="benefit-number">{benefit.number}</span>
                <h3>{benefit.title}</h3>
                <p>{benefit.copy}</p>
                <Link className="card-link" href="/meetings">
                  View in platform <Arrow />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="teal-band">
        <div className="shell teal-inner">
          <p className="section-kicker">High-Performance Videoconferencing</p>
          <p className="teal-statement">
            Docked 320×480px floating player with <strong>native Picture-in-Picture window support.</strong>
          </p>
        </div>
      </section>

      <section className="forest-band" id="enterprise">
        <div className="shell forest-inner">
          <div>
            <p className="section-kicker">Ready when you are</p>
            <h2>Launch your session.<br />Collaborate seamlessly.</h2>
          </div>
          <div className="forest-cta">
            <p>Experience the modern agentic meeting platform with live synchronization.</p>
            <Link className="button button-inverse" href="/meetings">
              Open Meetings App <Arrow />
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer" id="resources">
        <div className="shell footer-inner">
          <Link className="wordmark footer-mark" href="/">
            <span className="wordmark-mark">◒</span> Hrnbyl Meetings
          </Link>
          <div className="footer-links">
            <Link href="/meetings">Meetings</Link>
            <Link href="/meetings/teams">Teams</Link>
            <Link href="/meetings/calendar">Calendar</Link>
            <Link href="/settings">Settings</Link>
            <Link href="/login">Login</Link>
          </div>
          <p>© 2026 Hrnbyl. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
