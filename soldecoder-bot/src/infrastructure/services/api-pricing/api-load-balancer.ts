import { PriceData } from '@schemas/price-data.schema';
import { SolanaTrackerApiClient } from '@infrastructure/services/api-pricing/solana-tracker-api-client';
import { logger } from '@helpers/logger';

export class ApiLoadBalancer {
  private readonly clients: SolanaTrackerApiClient[];
  private currentIndex = 0;

  constructor(clients: SolanaTrackerApiClient[]) {
    if (clients.length === 0) {
      throw new Error('ApiLoadBalancer requires at least one client instance');
    }
    this.clients = clients;
  }

  public async getHistoricalPrice(tokenAddress: string, timestamp: number): Promise<PriceData | null> {
    return this.executeWithLoadBalancing(
      'historical',
      (client) => client.getHistoricalPrice(tokenAddress, timestamp),
      { tokenAddress, timestamp }
    );
  }

  public async getCurrentPrice(tokenAddress: string): Promise<PriceData | null> {
    return this.executeWithLoadBalancing(
      'current',
      (client) => client.getCurrentPrice(tokenAddress),
      { tokenAddress }
    );
  }

  public async getBatchHistoricalPrices(
    requests: Array<{ tokenAddress: string; timestamp: number }>
  ): Promise<Array<PriceData | null>> {
    if (requests.length === 0) return [];

    const chunks = this.distributeRequestsEvenly(requests);
    const promises = chunks.map((chunk, index) =>
      this.executeBatchChunk(chunk, this.clients[index])
    );

    const results = await Promise.all(promises);

    const flatResults: Array<PriceData | null> = [];
    for (let i = 0; i < requests.length; i++) {
      const chunkIndex = i % this.clients.length;
      const indexInChunk = Math.floor(i / this.clients.length);
      flatResults[i] = results[chunkIndex][indexInChunk];
    }

    return flatResults;
  }

  private async executeWithLoadBalancing<T>(
    operationType: string,
    operation: (client: SolanaTrackerApiClient) => Promise<T>,
    context: Record<string, any>
  ): Promise<T> {
    const startingIndex = this.currentIndex;

    for (let i = 0; i < this.clients.length; i++) {
      const client = this.getNextClient();

      try {
        const result = await operation(client);

        if (result !== null) {
          return result;
        }

      } catch (error) {
        continue;
      }
    }

    logger.error(`❌ All instances failed for ${operationType} request`, undefined, context);
    throw new Error(`All API instances failed for ${operationType} request`);
  }

  private async executeBatchChunk(
    requests: Array<{ tokenAddress: string; timestamp: number }>,
    client: SolanaTrackerApiClient
  ): Promise<Array<PriceData | null>> {
    const results: Array<PriceData | null> = [];

    for (const request of requests) {
      try {
        const result = await client.getHistoricalPrice(request.tokenAddress, request.timestamp);
        results.push(result);
      } catch (error) {
        logger.warn(`⚠️ Batch chunk request failed`, {
          instance: client.getInstanceId(),
          token: request.tokenAddress,
          error: error instanceof Error ? error.message : String(error),
        });
        results.push(null);
      }
    }

    return results;
  }

  private distributeRequestsEvenly<T>(requests: T[]): T[][] {
    const chunks: T[][] = Array(this.clients.length).fill(null).map(() => []);

    requests.forEach((request, index) => {
      const chunkIndex = index % this.clients.length;
      chunks[chunkIndex].push(request);
    });

    return chunks;
  }

  private getNextClient(): SolanaTrackerApiClient {
    const client = this.clients[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.clients.length;
    return client;
  }

  public getStats(): LoadBalancerStats {
    return {
      totalInstances: this.clients.length,
      instances: this.clients.map(c => ({ id: c.getInstanceId() })),
      currentRoundRobinIndex: this.currentIndex,
    };
  }
}

export interface LoadBalancerStats {
  totalInstances: number;
  instances: Array<{ id: string }>;
  currentRoundRobinIndex: number;
}
