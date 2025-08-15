import type { LpAgentResponse, LpAgentOverviewResponse } from '@schemas/lpagent.schema';

export interface LpAgentService {
  /* Fetch opening LP positions from LpAgent API */
  getOpeningPositions(): Promise<LpAgentResponse>;

  /* Fetch overview data from LpAgent API */
  getOverview(): Promise<LpAgentOverviewResponse>;
}
