import { useEffect, useRef, type CSSProperties } from 'react';
import { brand } from './config/brand';
import { siteContent } from './content/site-content';

type RecreationProject = {
  readonly title: string;
  readonly slug: string;
  readonly client: string;
  readonly year: string;
  readonly summary: string;
  readonly disciplines: readonly string[];
  readonly colors: { readonly primary: string; readonly secondary: string };
  readonly image?: string;
  readonly imageAlt?: string;
  readonly detail?: string;
};

type RecreationCaseProject = RecreationProject & {
  readonly image: string;
  readonly imageAlt: string;
  readonly detail: string;
};

function isCaseProject(project: RecreationProject): project is RecreationCaseProject {
  return Boolean(project.image && project.imageAlt && project.detail);
}

function CasePage({ project, projects, themeStyle }: { project: RecreationCaseProject; projects: readonly RecreationCaseProject[]; themeStyle: CSSProperties }) {
  const index = projects.findIndex((item) => item.slug === project.slug);
  const previous = projects[(index - 1 + projects.length) % projects.length];
  const next = projects[(index + 1) % projects.length];
  const caseStyle = {
    '--project-primary': project.colors.primary,
    '--project-secondary': project.colors.secondary,
  } as CSSProperties;

  return (
    <div className="site-shell case-shell" style={themeStyle}>
      <header className="case-header">
        <a className="brand-mark" href="/">{siteContent.brandName}</a>
        <a href="/#work">Back to work</a>
      </header>
      <main>
        <section className="case-hero" style={caseStyle} aria-labelledby="case-title">
          <p className="case-kicker" data-reveal>Case {String(index + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}</p>
          <h1 id="case-title" data-reveal>{project.title}</h1>
          <div className="case-meta" data-reveal>
            <span>{project.client}</span>
            <span>{project.year}</span>
          </div>
        </section>
        <figure className="case-media" data-reveal>
          <img src={project.image} alt={project.imageAlt} data-case-image />
          <figcaption>Captured public project media · reconstructed layout</figcaption>
        </figure>
        <section className="case-story" aria-label={`Sobre ${project.title}`}>
          <p className="section-label" data-reveal>Project story</p>
          <p className="case-detail" data-reveal>{project.detail}</p>
          <ul className="project-disciplines" data-reveal aria-label={`Disciplinas de ${project.title}`}>
            {project.disciplines.map((discipline) => <li key={discipline}>{discipline}</li>)}
          </ul>
        </section>
        <nav className="case-pagination" aria-label="Cases adjacentes">
          <a href={`/work/${previous.slug}`}><span>Previous</span>{previous.title}</a>
          <a href={`/work/${next.slug}`}><span>Next</span>{next.title}</a>
        </nav>
      </main>
    </div>
  );
}

function App() {
  const heroRef = useRef<HTMLElement>(null);
  const projects: readonly RecreationProject[] = siteContent.projects;
  const caseProjects = projects.filter(isCaseProject);
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const caseProject = caseProjects.find((project) => pathname === `/work/${project.slug}`);

  useEffect(() => {
    document.title = caseProject ? `${caseProject.title} — ${siteContent.brandName}` : siteContent.brandName;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealNodes = document.querySelectorAll<HTMLElement>('[data-reveal]');
    document.documentElement.classList.add('motion-ready');

    if (reducedMotion) {
      revealNodes.forEach((node) => node.classList.add('is-visible'));
      return () => document.documentElement.classList.remove('motion-ready');
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18 },
    );
    revealNodes.forEach((node) => observer.observe(node));

    const hero = heroRef.current;
    const updateBlob = (event: PointerEvent) => {
      if (!hero) return;
      const bounds = hero.getBoundingClientRect();
      hero.style.setProperty('--pointer-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
      hero.style.setProperty('--pointer-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
    };
    hero?.addEventListener('pointermove', updateBlob);

    return () => {
      observer.disconnect();
      hero?.removeEventListener('pointermove', updateBlob);
      document.documentElement.classList.remove('motion-ready');
    };
  }, []);

  const themeStyle = {
    '--accent': brand.accent,
    '--ink': brand.ink,
    '--paper': brand.paper,
    '--support': brand.support,
    '--display-font': brand.displayFont,
    '--body-font': brand.bodyFont,
  } as CSSProperties;

  if (pathname.startsWith('/work/')) {
    if (caseProject) return <CasePage project={caseProject} projects={caseProjects} themeStyle={themeStyle} />;
    return (
      <div className="site-shell case-shell" style={themeStyle}>
        <main className="case-not-found"><p>Case not found.</p><a href="/#work">Back to work</a></main>
      </div>
    );
  }

  return (
    <div className="site-shell" style={themeStyle}>
      <header className="site-header">
        <a className="brand-mark" href="#top" aria-label={`${siteContent.brandName}, início`}>
          {siteContent.brandName}
        </a>
        <nav aria-label="Navegação principal">
          {siteContent.navigation.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <main>
        <section className="hero" id="top" ref={heroRef} aria-labelledby="hero-title">
          <div className="butter-object" aria-hidden="true">
            <span />
          </div>
          <div className="hero-copy">
            <p className="hero-kicker" data-reveal>
              {siteContent.hero.eyebrow}
            </p>
            <h1 id="hero-title" data-reveal>
              {siteContent.hero.titleLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h1>
            <div className="hero-subtitle" data-reveal>
              {siteContent.hero.subtitleLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          </div>
          <p className="scroll-cue" aria-hidden="true">
            Scroll to melt
          </p>
        </section>

        <section className="about" id="studio" aria-labelledby="about-title">
          <p className="section-label" data-reveal>
            {siteContent.about.eyebrow}
          </p>
          <h2 id="about-title" data-reveal>
            {siteContent.about.statement}
          </h2>
          <div className="about-meta" data-reveal>
            <span>Design</span>
            <span>Motion</span>
            <span>Technology</span>
          </div>
        </section>

        {projects.length > 0 && (
          <section className="work" id="work" aria-labelledby="work-title">
            <header className="work-intro">
              <p className="section-label" data-reveal>
                {siteContent.work.eyebrow}
              </p>
              <h2 id="work-title" data-reveal>
                {siteContent.work.title}
              </h2>
              <p className="work-count" data-reveal>
                {String(projects.length).padStart(2, '0')} public projects
              </p>
            </header>

            <div className="project-list">
              {projects.map((project, index) => {
                const projectStyle = {
                  '--project-primary': project.colors.primary,
                  '--project-secondary': project.colors.secondary,
                } as CSSProperties;
                return (
                  <a
                    className="project-card"
                    data-project-card
                    data-reveal
                    href={isCaseProject(project) ? `/work/${project.slug}` : '#work'}
                    aria-label={isCaseProject(project) ? `Abrir case ${project.title}` : project.title}
                    key={project.slug}
                    style={projectStyle}
                  >
                    <p className="project-index">{String(index + 1).padStart(2, '0')}</p>
                    <div className="project-copy">
                      <p className="project-meta">
                        <span>{project.client}</span>
                        <span>{project.year}</span>
                      </p>
                      <h3 className="project-title">{project.title}</h3>
                      <p className="project-summary">{project.summary}</p>
                      <ul className="project-disciplines" aria-label={`Disciplinas de ${project.title}`}>
                        {project.disciplines.map((discipline) => (
                          <li key={discipline}>{discipline}</li>
                        ))}
                      </ul>
                    </div>
                    <div className={`project-visual ${isCaseProject(project) ? 'has-image' : ''}`} aria-hidden="true">
                      {isCaseProject(project) ? (
                        <img className="project-thumbnail" src={project.image} alt="" loading="lazy" />
                      ) : (
                        <><span className="project-orbit" /><span className="project-core">{project.client.slice(0, 2)}</span></>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <footer id="contact">
        <p>{siteContent.contact.prompt}</p>
        <a href={siteContent.contact.href}>{siteContent.contact.label}</a>
        <span>Editable Recreation by Mili Mirror</span>
      </footer>
    </div>
  );
}

export default App;
