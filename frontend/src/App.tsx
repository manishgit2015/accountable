import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router";

import { useHealthWhileOffline, useOffline } from "./api/queries";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OfflineBanner } from "./components/OfflineBanner";
import { Panel } from "./components/Panel";
import { SidePanel } from "./components/SidePanel";
import { TopBar } from "./components/TopBar";
import { DealForm } from "./forms/DealForm";
import { ContactPage } from "./pages/contacts/ContactPage";
import { ContactsPage } from "./pages/contacts/ContactsPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { DealPage } from "./pages/deals/DealPage";
import { DealsPage } from "./pages/deals/DealsPage";
import { OrganizationPage } from "./pages/organizations/OrganizationPage";
import { OrganizationsPage } from "./pages/organizations/OrganizationsPage";
import { PipelinePage } from "./pages/pipeline/PipelinePage";
import { SignInPage } from "./pages/SignInPage";
import { useSession } from "./lib/useSession";

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

/**
 * Everything needs a signed-in person (R100, R101). Until there is one, the sign-in screen is shown in
 * place of the page asked for, at the same address, so signing in lands on that page. Signing out, or the
 * session ending, clears every cached answer, so the next person sees nothing of the last one's.
 */
export function App() {
  const { status, ended } = useSession();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (status === "signed-out") queryClient.clear();
  }, [status, queryClient]);

  if (status === "loading") return null;
  if (status === "signed-out") return <SignInPage ended={ended} />;
  return <SignedInApp />;
}

function SignedInApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const offline = useOffline();
  const [addingDeal, setAddingDeal] = useState(false);
  useHealthWhileOffline();

  return (
    <div className="wrap">
      <TopBar onAddDeal={() => setAddingDeal(true)} />
      <OfflineBanner offline={offline} />
      <main>
        {/* One error boundary per route, keyed by path, so moving to another page clears it (REL-12). */}
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/pipeline" element={<PipelinePage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/deals/:id" element={<DealPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/:id" element={<ContactPage />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/organizations/:id" element={<OrganizationPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <SidePanel open={addingDeal} onOpenChange={setAddingDeal} title="Add deal">
        {addingDeal && (
          <DealForm
            onSaved={(deal) => {
              setAddingDeal(false);
              navigate(`/deals/${deal.id}`);
            }}
            onCancel={() => setAddingDeal(false)}
          />
        )}
      </SidePanel>
    </div>
  );
}
