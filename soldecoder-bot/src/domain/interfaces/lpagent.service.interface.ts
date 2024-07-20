import { LpAgentResponse, LpAgentOverviewResponse } from '@schemas/lpagent.schema';

export interface LpAgentService {
  /** Fetch opening LP positions from LpAgent API */
  getOpeningPositions(ownerWalletAddress?: string): Promise<LpAgentResponse>;

  /** Fetch overview data from LpAgent API */
  getOverview(): Promise<LpAgentOverviewResponse>;
}
