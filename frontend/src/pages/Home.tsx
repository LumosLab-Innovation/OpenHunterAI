import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <section className="hero">
      <p className="eyebrow">Authorized security testing workspace</p>
      <h1>OpenHunterAI</h1>
      <p>
        Verify a domain, create an immutable scan authorization, run the hunter pipeline, and turn
        sanitized evidence into findings and reports.
      </p>
      <div className="actions">
        <Link className="button primary" to="/register">
          Create workspace
        </Link>
        <Link className="button" to="/login">
          Sign in
        </Link>
      </div>
    </section>
  );
}
