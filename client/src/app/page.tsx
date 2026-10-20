const products = [
  { name: "Code Reviews", description: "AI reviews that understand your codebase" },
  { name: "CodeRabbit Autofix", description: "Resolve issues with one click" },
  { name: "Security", description: "Find vulnerabilities before they ship" },
  { name: "Jira Integration", description: "Turn feedback into focused tickets" },
  { name: "GitHub", description: "Review every pull request automatically" },
  { name: "GitLab", description: "Bring intelligence to your merge requests" },
  { name: "Enterprise", description: "Governance for teams at scale" },
  { name: "Resources", description: "Guides for better code" },
];

const benefits = [
  {
    number: "01",
    title: "Ship with confidence",
    copy: "Catch bugs, security risks, and maintainability issues before they become production problems.",
  },
  {
    number: "02",
    title: "Give developers time back",
    copy: "CodeRabbit handles the first pass so your team can spend more time on the work that moves the product forward.",
  },
  {
    number: "03",
    title: "Improve every review",
    copy: "Contextual suggestions get smarter with your repository, your conventions, and every conversation.",
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
          <button className="menu-button" aria-label="Open menu">
            <span />
            <span />
          </button>
          <a className="wordmark" href="#" aria-label="CodeRabbit home">
            <span className="wordmark-mark">◒</span>
            <span>CodeRabbit</span>
          </a>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="#product">Product</a>
            <a href="#why-coderabbit">Why CodeRabbit</a>
            <a href="#resources">Resources</a>
            <a href="#enterprise">Enterprise</a>
          </nav>
          <div className="masthead-actions">
            <label className="search">
              <span className="search-icon">⌕</span>
              <input aria-label="Search" placeholder="Search" />
            </label>
            <a className="text-link" href="#login">Log in</a>
            <a className="button button-small" href="#get-started">Get started <Arrow /></a>
          </div>
        </div>
      </header>

      <section className="hero-band">
        <div className="hero-pattern" />
        <div className="shell hero-content">
          <p className="eyebrow">AI code reviews for modern engineering teams</p>
          <h1>Make every pull request<br /><em>remarkable.</em></h1>
          <div className="gold-rule" />
          <p className="hero-lead">
            CodeRabbit gives your team an expert review on every change, so you can
            move faster without compromising quality.
          </p>
          <div className="hero-actions">
            <a className="button" href="#get-started">Start reviewing for free <Arrow /></a>
            <a className="button button-outline" href="#demo">See how it works <Arrow /></a>
          </div>
          <p className="hero-note">No credit card required · Works with GitHub and GitLab</p>
        </div>
      </section>

      <section className="product-nav" id="product">
        <div className="shell">
          <p className="section-kicker">Explore CodeRabbit</p>
          <div className="product-grid">
            {products.map((product, index) => (
              <a className={`nav-tile${index === 0 ? " nav-tile-active" : ""}`} href="#get-started" key={product.name}>
                <span className="nav-tile-name">{product.name}</span>
                <span className="nav-tile-copy">{product.description}</span>
                <Arrow />
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-soft" id="why-coderabbit">
        <div className="shell intro-grid">
          <div>
            <p className="section-kicker">A better way to review code</p>
            <h2>Less time reviewing.<br /><span>More time building.</span></h2>
          </div>
          <div className="intro-copy">
            <p>
              Great software is built by teams who care about the details. CodeRabbit
              brings that care to every pull request with actionable, context-aware
              feedback in the flow of work.
            </p>
            <a className="inline-link" href="#get-started">Meet your new review partner <Arrow /></a>
          </div>
        </div>
      </section>

      <section className="section section-white">
        <div className="shell">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Built for the whole team</p>
              <h2>Quality is a team sport.</h2>
            </div>
            <p className="section-summary">One intelligent layer across your entire development workflow.</p>
          </div>
          <div className="benefit-grid">
            {benefits.map((benefit) => (
              <article className="benefit-card" key={benefit.number}>
                <span className="benefit-number">{benefit.number}</span>
                <h3>{benefit.title}</h3>
                <p>{benefit.copy}</p>
                <a className="card-link" href="#get-started">Learn more <Arrow /></a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="teal-band">
        <div className="shell teal-inner">
          <p className="section-kicker">Trusted by developers everywhere</p>
          <p className="teal-statement">From first commit to final deploy, <strong>ship your best work.</strong></p>
        </div>
      </section>

      <section className="forest-band" id="enterprise">
        <div className="shell forest-inner">
          <div>
            <p className="section-kicker">Ready when you are</p>
            <h2>Build boldly.<br />Review brilliantly.</h2>
          </div>
          <div className="forest-cta">
            <p>Join thousands of teams using CodeRabbit to make software better, one review at a time.</p>
            <a className="button button-inverse" href="#get-started">Get started for free <Arrow /></a>
          </div>
        </div>
      </section>

      <footer className="footer" id="resources">
        <div className="shell footer-inner">
          <a className="wordmark footer-mark" href="#"> <span className="wordmark-mark">◒</span> CodeRabbit</a>
          <div className="footer-links">
            <a href="#product">Product</a>
            <a href="#enterprise">Enterprise</a>
            <a href="#resources">Resources</a>
            <a href="#privacy">Privacy</a>
            <a href="#terms">Terms</a>
          </div>
          <p>© 2025 CodeRabbit. Better code, together.</p>
        </div>
      </footer>
    </main>
  );
}
