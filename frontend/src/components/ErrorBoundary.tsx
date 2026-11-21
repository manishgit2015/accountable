import { Component, type ErrorInfo, type ReactNode } from "react";

import { ApiError } from "../api/client";
import { Button } from "./Button";
import { Panel } from "./Panel";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Shows "Something went wrong on this page" instead of a blank screen (REL-12). One per route. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A warning, not an error: the page has handled it. The backend logs its own side.
    console.warn("Page error", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const reference = error instanceof ApiError ? error.reference : null;
    return (
      <Panel className="error-screen">
        <h2>Something went wrong on this page</h2>
        <p className="muted">Reload the page to try again.</p>
        {reference && <p className="label">{reference}</p>}
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </Panel>
    );
  }
}
