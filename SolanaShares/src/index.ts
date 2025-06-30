import 'reflect-metadata';
import { setupDependencyContainer } from './infra/DependencyContainer';
import { FastifyApp } from './adapters/http/FastifyApp';
import { DiscordBot } from './adapters/discord/DiscordBot';
import { LoggerService } from './domain/ports/services';
import { container } from './infra/DependencyContainer';

class Application {
  private fastifyApp: FastifyApp;
  private discordBot: DiscordBot;
  private logger: LoggerService;

  constructor() {
    // Setup dependency injection
    setupDependencyContainer();
    
    this.logger = container.resolve<LoggerService>('LoggerService');
    this.fastifyApp = new FastifyApp();
    this.discordBot = new DiscordBot();
  }

  async start(): Promise<void> {
    try {
      this.logger.info('🚀 Starting SolanaShares application...');

      // Start the Discord bot
      await this.discordBot.start();
      this.logger.info('✅ Discord bot started');

      // Start the HTTP API
      await this.fastifyApp.start();
      this.logger.info('✅ API server started');

      this.logger.info('🎉 SolanaShares application started successfully!');
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      this.logger.error('❌ Failed to start application', error as Error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`📝 Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.discordBot.stop();
        await this.fastifyApp.stop();
        this.logger.info('👋 Application stopped gracefully');
        process.exit(0);
      } catch (error) {
        this.logger.error('❌ Error during shutdown', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
  }
}

// Start the application
const app = new Application();
app.start().catch((error) => {
  console.error('💥 Fatal error starting application:', error);
  process.exit(1);
});