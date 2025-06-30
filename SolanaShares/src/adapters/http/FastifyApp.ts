import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { container } from '../../infra/DependencyContainer';
import { CreateWalletUseCase } from '../../application/use-cases/CreateWalletUseCase';
import { LoggerService } from '../../domain/ports/services';
import { env } from '../../config/environment';

export class FastifyApp {
  private app: FastifyInstance;
  private logger: LoggerService;

  constructor() {
    this.logger = container.resolve<LoggerService>('LoggerService');
    this.app = fastify({
      logger: false, // We use our own logger
    });
    this.setupMiddleware();
    this.setupRoutes();
  }

  private async setupMiddleware(): Promise<void> {
    await this.app.register(cors, {
      origin: true,
      credentials: true,
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', async (request, reply) => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Create wallet endpoint
    this.app.post<{
      Body: { userId: string; username: string };
    }>('/wallet/start', async (request, reply) => {
      try {
        const { userId, username } = request.body;

        if (!userId || !username) {
          return reply.status(400).send({
            success: false,
            error: 'userId and username are required',
          });
        }

        const createWalletUseCase = container.resolve<CreateWalletUseCase>('CreateWalletUseCase');
        const result = await createWalletUseCase.execute({ userId, username });

        if (!result.success) {
          return reply.status(400).send(result);
        }

        this.logger.info('Wallet created via API', { userId, walletAddress: result.walletAddress });

        return reply.send({
          success: true,
          walletAddress: result.walletAddress,
          privateKey: result.privateKey,
        });
      } catch (error) {
        this.logger.error('Error in /wallet/start endpoint', error as Error);
        return reply.status(500).send({
          success: false,
          error: 'Internal server error',
        });
      }
    });

    // Get wallet info
    this.app.get<{
      Querystring: { userId: string };
    }>('/wallet/info', async (request, reply) => {
      try {
        const { userId } = request.query;

        if (!userId) {
          return reply.status(400).send({
            success: false,
            error: 'userId is required',
          });
        }

        // TODO: Implement get wallet info use case
        return reply.send({
          success: true,
          message: 'Get wallet info - not implemented yet',
        });
      } catch (error) {
        this.logger.error('Error in /wallet/info endpoint', error as Error);
        return reply.status(500).send({
          success: false,
          error: 'Internal server error',
        });
      }
    });

    // Stats endpoint
    this.app.get('/stats', async (request, reply) => {
      try {
        // TODO: Implement stats use case
        return reply.send({
          success: true,
          message: 'Stats endpoint - not implemented yet',
        });
      } catch (error) {
        this.logger.error('Error in /stats endpoint', error as Error);
        return reply.status(500).send({
          success: false,
          error: 'Internal server error',
        });
      }
    });
  }

  async start(): Promise<void> {
    try {
      await this.app.listen({ port: env.PORT, host: '0.0.0.0' });
      this.logger.info(`Server started on port ${env.PORT}`);
    } catch (error) {
      this.logger.error('Failed to start server', error as Error);
      process.exit(1);
    }
  }

  async stop(): Promise<void> {
    await this.app.close();
    this.logger.info('Server stopped');
  }

  getApp(): FastifyInstance {
    return this.app;
  }
}