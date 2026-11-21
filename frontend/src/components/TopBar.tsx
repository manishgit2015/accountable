import { NavLink } from "react-router";

import { Button } from "./Button";

/** The five sections, in top bar order. Routes and tabs both come from this list. */
export const SECTIONS = [
  { path: "/", label: "Dashboard" },
  { path: "/pipeline", label: "Pipeline" },
  { path: "/deals", label: "Deals" },
  { path: "/contacts", label: "Contacts" },
  { path: "/organizations", label: "Organizations" },
] as const;

/** The floating top bar: wordmark, tabs and "Add deal" (spec 3.9 Layout). */
export function TopBar({ onAddDeal }: { onAddDeal?: () => void }) {
  return (
    <header className="topbar">
      <NavLink to="/" className="brand" aria-label="Accountable, dashboard">
        <span className="brand-mark" aria-hidden="true">
          A
        </span>
        Accountable
      </NavLink>
      <nav className="tabs" aria-label="Sections">
        {SECTIONS.map((section) => (
          <NavLink key={section.path} to={section.path} end={section.path === "/"}>
            {section.label}
          </NavLink>
        ))}
      </nav>
      <div className="topbar-right">
        {/* The deal form arrives in Phase 3 (T3.5). Until then the button is shown but disabled. */}
        <Button variant="primary" onClick={onAddDeal} disabled={!onAddDeal}>
          Add deal
        </Button>
      </div>
    </header>
  );
}
