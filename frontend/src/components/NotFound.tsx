import { Link } from "react-router";

import { Panel } from "./Panel";

/** R56: a record that doesn't exist, or was deleted in another tab. */
export function NotFound({ noun, listPath, listLabel }: { noun: string; listPath: string; listLabel: string }) {
  return (
    <Panel className="not-found">
      <h1 className="page-title">This {noun} no longer exists</h1>
      <p className="muted">It may have been deleted, perhaps in another tab.</p>
      <Link to={listPath}>Back to {listLabel}</Link>
    </Panel>
  );
}
