import { useDashboard, useUpdateActivity } from "../../api/queries";
import { QueryState } from "../../components/EmptyState";
import { FollowUps } from "./FollowUps";
import { FunnelPanel } from "./FunnelPanel";
import { HeroPanel } from "./HeroPanel";
import { RecentActivity } from "./RecentActivity";
import { StageDonut } from "./StageDonut";
import { WonLostChart } from "./WonLostChart";

/** R70–R79. Every figure comes from GET /api/dashboard; each panel is fed by one field of it. */
export function DashboardPage() {
  const dashboard = useDashboard();
  const update = useUpdateActivity();
  return (
    <QueryState query={dashboard} what="dashboard">
      {(data) => (
        <div className="grid">
          <HeroPanel dashboard={data} />
          <FunnelPanel funnel={data.funnel} />
          <WonLostChart months={data.months} />
          <StageDonut openByStage={data.openByStage} />
          <FollowUps
            key={data.today}
            followUps={data.followUps}
            onMarkDone={(item) => update.mutateAsync({ id: item.id, input: { done: true } })}
          />
          <RecentActivity recent={data.recent} />
        </div>
      )}
    </QueryState>
  );
}
