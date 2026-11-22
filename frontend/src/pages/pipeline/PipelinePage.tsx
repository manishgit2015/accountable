import { useState } from "react";
import { useNavigate } from "react-router";

import { useDeals, useMoveDeal } from "../../api/queries";
import type { Stage } from "../../api/types";
import { QueryState } from "../../components/EmptyState";
import { SidePanel } from "../../components/SidePanel";
import { DealForm } from "../../forms/DealForm";
import { OPEN_STAGES, stageLabel } from "../../lib/deals";
import { formatMoney } from "../../lib/format";
import { Board } from "./Board";
import { columnDeals, columnTotals } from "./Column";
import { StageStrip } from "./StageStrip";

/** R60–R67: the open pipeline's totals, the stage strip and the board. */
export function PipelinePage() {
  const deals = useDeals();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState<Stage | null>(null);
  const move = useMoveDeal(setMessage);

  return (
    <QueryState query={deals} what="pipeline">
      {(data) => {
        // R61: Won and Lost are left out of the open pipeline. Totals follow the cache, so they move on drop.
        const open = OPEN_STAGES.map((stage) => columnTotals(columnDeals(stage, data)));
        const openValue = open.reduce((sum, t) => sum + t.value, 0);
        const openExpected = open.reduce((sum, t) => sum + t.expected, 0);
        return (
          <>
            <div className="pipeline-head">
              <div>
                <h1 className="page-title">Pipeline</h1>
                <div className="muted">Drag a card to change its stage or its place in a column</div>
              </div>
              <div className="pipeline-totals">
                <div>
                  <div className="label">Open pipeline</div>
                  <div className="num big-figure" data-testid="open-pipeline">
                    {formatMoney(openValue)}
                  </div>
                </div>
                <div>
                  <div className="label">Expected revenue</div>
                  <div className="num big-figure" data-testid="open-expected">
                    {formatMoney(openExpected)}
                  </div>
                </div>
              </div>
            </div>
            {message && (
              <div className="board-message" role="alert">
                {message}
                <button type="button" className="link-button" onClick={() => setMessage(null)}>
                  Dismiss
                </button>
              </div>
            )}
            <StageStrip deals={data} />
            <Board
              deals={data}
              onMove={(id, target) => {
                setMessage(null);
                move.mutate({ id, move: target });
              }}
              onAddDeal={(stage) => setAdding(stage.key)}
              onOpenDeal={(deal) => navigate(`/deals/${deal.id}`)}
            />
            <SidePanel
              open={adding !== null}
              onOpenChange={(isOpen) => !isOpen && setAdding(null)}
              title={adding ? `Add deal in ${stageLabel(adding)}` : "Add deal"}
            >
              {adding && (
                <DealForm defaultStage={adding} onSaved={() => setAdding(null)} onCancel={() => setAdding(null)} />
              )}
            </SidePanel>
          </>
        );
      }}
    </QueryState>
  );
}
