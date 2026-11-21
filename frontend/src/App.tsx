import { useQuery } from "@tanstack/react-query";
import { Route, Routes, useLocation } from "react-router";

import { getHealth } from "./api/client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Panel } from "./components/Panel";
import { SECTIONS, TopBar } from "./components/TopBar";

/** A section's page until it's built in Phase 3. It checks the API answers through the proxy. */
function PlaceholderPage({ title }: { title: string }) {
  const health = useQuery({ queryKey: ["health"], queryFn: ({ signal }) => getHealth(signal) });
  return (
    <>
      <h1 className="page-title">{title}</h1>
      <Panel>
        <p className="empty-line">This section is on its way.</p>
        <p className="label" data-testid="api-status">
          {health.isSuccess
            ? `Connected to Accountable ${health.data.appVersion}`
            : health.isError
              ? health.error.message
              : "Connecting..."}
        </p>
      </Panel>
    </>
  );
}

function NotFoundPage() {
  return (
    <>
      <h1 className="page-title">Page not found</h1>
      <Panel>
        <p className="empty-line">There's nothing at this address.</p>
      </Panel>
    </>
  );
}

export function App() {
  const location = useLocation();
  return (
    <div className="wrap">
      <TopBar />
      <main>
        {/* One error boundary per route, keyed by path, so moving to another page clears it (REL-12). */}
        <ErrorBoundary key={location.pathname}>
          <Routes>
            {SECTIONS.map((section) => (
              <Route key={section.path} path={section.path} element={<PlaceholderPage title={section.label} />} />
            ))}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}
