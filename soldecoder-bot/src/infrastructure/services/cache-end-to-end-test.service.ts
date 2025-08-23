// import type { Client, TextChannel } from 'discord.js';
// import { DynamoChannelConfigRepository } from '@infrastructure/repositories/dynamo-channel-config.repository';
// import { DynamoGuildSettingsRepository } from '@infrastructure/repositories/dynamo-guild-settings.repository';
// import { DynamoGlobalMessageRepository } from '@infrastructure/repositories/dynamo-global-message.repository';
// import { GenericCacheServiceImpl } from '@infrastructure/services/generic-cache.service';
// import { DatabaseService } from '@infrastructure/services/database.service';
// import { ChannelConfigEntity } from '@domain/entities/channel-config.entity';
// import { GuildSettingsEntity } from '@domain/entities/guild-settings.entity';
// import { logger } from '@helpers/logger';

// interface TestStep {
//   name: string;
//   success: boolean;
//   duration: number;
//   details: string;
//   error?: string;
//   cacheCount?: number;
//   dbCount?: number;
// }

// interface EndToEndTestResult {
//   timestamp: string;
//   totalSteps: number;
//   passedSteps: number;
//   failedSteps: number;
//   duration: number;
//   steps: TestStep[];
//   finalState: {
//     cacheChannels: number;
//     dbChannels: number;
//     cacheSettings: number;
//     dbSettings: number;
//     cacheGlobalMessages: number;
//     dbGlobalMessages: number;
//     unexpectedData: number;
//   };
//   success: boolean;
// }

// /**
//  * Service de test End-to-End complet du système de cache
//  * Test de A à Z : DB vide → Création → Modification → Suppression → DB vide
//  */
// export class CacheEndToEndTestService {
//   private static instance: CacheEndToEndTestService;
//   private readonly channelRepo: DynamoChannelConfigRepository;
//   private readonly guildRepo: DynamoGuildSettingsRepository;
//   private readonly globalRepo: DynamoGlobalMessageRepository;
//   private readonly cacheService: GenericCacheServiceImpl;
//   private readonly databaseService: DatabaseService;

//   // IDs de test FICTIFS - ne correspondent à aucune vraie guild/channel
//   private readonly TEST_GUILD_ID = 'TEST_GUILD_123456789';
//   private readonly TEST_CHANNEL_1 = 'TEST_CHANNEL_111111111';
//   private readonly TEST_CHANNEL_2 = 'TEST_CHANNEL_222222222';
//   private readonly TEST_CHANNEL_3 = 'TEST_CHANNEL_333333333';
//   private readonly TEST_GLOBAL_CHANNEL = 'TEST_GLOBAL_444444444';
//   private readonly DEBUG_CHANNEL_ID = '1408812317684142080';

//   // TTL du cache en millisecondes (doit matcher cache.service.ts)
//   private readonly CACHE_TTL_MS = 30 * 1000; // 30 secondes
//   private readonly TTL_WAIT_MS = this.CACHE_TTL_MS + 5000; // TTL + 5s de marge

//   // Tracking des données créées pour un cleanup précis
//   private createdChannelIds: Set<string> = new Set();
//   private createdGuildIds: Set<string> = new Set();

//   private constructor() {
//     this.channelRepo = new DynamoChannelConfigRepository();
//     this.guildRepo = new DynamoGuildSettingsRepository();
//     this.globalRepo = new DynamoGlobalMessageRepository();
//     this.cacheService = GenericCacheServiceImpl.getInstance();
//     this.databaseService = new DatabaseService();
//   }

//   static getInstance(): CacheEndToEndTestService {
//     if (!CacheEndToEndTestService.instance) {
//       CacheEndToEndTestService.instance = new CacheEndToEndTestService();
//     }
//     return CacheEndToEndTestService.instance;
//   }

//   /**
//    * Lance le test complet End-to-End (3-4 minutes)
//    */
//   async runEndToEndTest(client: Client): Promise<void> {
//     logger.info('[E2E-TEST] 🚀 Starting End-to-End Cache Test');

//     const startTime = Date.now();
//     const steps: TestStep[] = [];
//     let currentStep = 0;

//     // Reset tracking
//     this.createdChannelIds.clear();
//     this.createdGuildIds.clear();

//     try {
//       // Phase 1: Tests de base (CRUD)
//       steps.push(
//         await this.executeStep(++currentStep, 'Initial State & Cleanup', () => this.stepInitialStateAndCleanup()),
//       );
//       steps.push(await this.executeStep(++currentStep, 'Verify Empty Database', () => this.stepVerifyEmptyDatabase()));
//       steps.push(await this.executeStep(++currentStep, 'Create Guild Settings', () => this.stepCreateGuildSettings()));
//       steps.push(await this.executeStep(++currentStep, 'Verify Guild Settings', () => this.stepVerifyGuildSettings()));
//       steps.push(
//         await this.executeStep(++currentStep, 'Create Channel Configs', () => this.stepCreateChannelConfigs()),
//       );
//       steps.push(
//         await this.executeStep(++currentStep, 'Verify Channel Configs', () => this.stepVerifyChannelConfigs()),
//       );
//       steps.push(await this.executeStep(++currentStep, 'Create Global Message', () => this.stepCreateGlobalMessage()));
//       steps.push(await this.executeStep(++currentStep, 'Verify Complete State', () => this.stepVerifyCompleteState()));

//       // Phase 2: Tests de modification
//       steps.push(await this.executeStep(++currentStep, 'Update Guild Settings', () => this.stepUpdateGuildSettings()));
//       steps.push(
//         await this.executeStep(++currentStep, 'Update Channel Configs', () => this.stepUpdateChannelConfigs()),
//       );
//       steps.push(await this.executeStep(++currentStep, 'Delete One Channel', () => this.stepDeleteOneChannel()));
//       steps.push(
//         await this.executeStep(++currentStep, 'Verify Partial Deletion', () => this.stepVerifyPartialDeletion()),
//       );

//       // Phase 3: Tests de cohérence et performance
//       steps.push(await this.executeStep(++currentStep, 'Cache-DB Consistency', () => this.stepTestConsistency()));
//       steps.push(await this.executeStep(++currentStep, 'Performance Test', () => this.stepPerformanceTest()));
//       steps.push(await this.executeStep(++currentStep, 'Race Condition Test', () => this.stepRaceConditionTest()));

//       // Phase 4: Tests TTL et expiration
//       steps.push(await this.executeStep(++currentStep, 'TTL Expiration Test', () => this.stepTTLExpirationTest()));
//       steps.push(await this.executeStep(++currentStep, 'TTL Refresh Test', () => this.stepTTLRefreshTest()));
//       steps.push(
//         await this.executeStep(++currentStep, 'Consistency With Expired Cache', () =>
//           this.stepConsistencyWithExpiredCache(),
//         ),
//       );

//       // Phase 5: Tests de stress et charge
//       steps.push(
//         await this.executeStep(++currentStep, 'Concurrent Operations Stress', () =>
//           this.stepConcurrentOperationsStress(),
//         ),
//       );
//       steps.push(
//         await this.executeStep(++currentStep, 'Performance Under Load', () => this.stepPerformanceUnderLoad()),
//       );
//       steps.push(await this.executeStep(++currentStep, 'Memory Pressure Test', () => this.stepMemoryPressureTest()));

//       // Phase 6: Tests de simulation réelle
//       steps.push(await this.executeStep(++currentStep, 'Real Usage Simulation', () => this.stepRealUsageSimulation()));
//       steps.push(
//         await this.executeStep(++currentStep, 'Recovery After Corruption', () => this.stepRecoveryAfterCorruption()),
//       );
//       steps.push(await this.executeStep(++currentStep, 'Edge Cases Test', () => this.stepEdgeCasesTest()));

//       // Phase 7: Cleanup et vérification finale
//       steps.push(await this.executeStep(++currentStep, 'Delete Global Message', () => this.stepDeleteGlobalMessage()));
//       steps.push(
//         await this.executeStep(++currentStep, 'Delete Remaining Channels', () => this.stepDeleteRemainingChannels()),
//       );
//       steps.push(await this.executeStep(++currentStep, 'Delete Guild Settings', () => this.stepDeleteGuildSettings()));
//       steps.push(
//         await this.executeStep(++currentStep, 'Verify Final Empty State', () => this.stepVerifyFinalEmptyState()),
//       );
//       steps.push(
//         await this.executeStep(++currentStep, 'Final Comprehensive Check', () => this.stepFinalComprehensiveCheck()),
//       );

//       const result = await this.generateTestResult(steps, Date.now() - startTime);
//       await this.sendTestReport(client, result);
//     } catch (error) {
//       logger.error('[E2E-TEST] End-to-End test failed', error as Error);
//       await this.emergencyCleanup();
//       await this.sendErrorReport(client, error as Error, steps);
//     } finally {
//       // Final cleanup pour être sûr
//       await this.emergencyCleanup();
//     }
//   }

//   private async executeStep(stepNumber: number, name: string, operation: () => Promise<TestStep>): Promise<TestStep> {
//     logger.info(`[E2E-TEST] Step ${stepNumber}: ${name}`);
//     const start = Date.now();

//     try {
//       const step = await operation();
//       step.name = `${stepNumber}. ${step.name}`;
//       logger.info(`[E2E-TEST] ✅ Step ${stepNumber} completed: ${step.details}`);
//       return step;
//     } catch (error) {
//       const duration = Date.now() - start;
//       logger.error(`[E2E-TEST] ❌ Step ${stepNumber} failed`, error as Error);
//       return {
//         name: `${stepNumber}. ${name}`,
//         success: false,
//         duration,
//         details: 'Step execution failed',
//         error: String(error),
//       };
//     }
//   }

//   // ==================== ÉTAPES DU TEST ====================

//   private async stepInitialStateAndCleanup(): Promise<TestStep> {
//     const start = Date.now();

//     // Nettoyer toutes les données de test qui pourraient rester
//     await this.emergencyCleanup();

//     const cacheStats = this.cacheService.getStats();
//     const allChannels = await this.databaseService.getAllChannelConfigs();
//     const allSettings = await this.databaseService.getAllGuildSettings();

//     // Filtrer les données de test
//     const testChannels = allChannels.filter(
//       (c) => c.channelId.startsWith('TEST_') || c.guildId === this.TEST_GUILD_ID || c.guildId.startsWith('TEST_'),
//     );
//     const testSettings = allSettings.filter((s) => s.guildId === this.TEST_GUILD_ID || s.guildId.startsWith('TEST_'));

//     return {
//       name: 'Initial State & Cleanup',
//       success: testChannels.length === 0 && testSettings.length === 0,
//       duration: Date.now() - start,
//       details: `Cache: ${cacheStats.totalKeys} total keys, ${cacheStats.expiredKeys} expired. Test data cleaned.`,
//       cacheCount: cacheStats.totalKeys,
//       dbCount: allChannels.length,
//     };
//   }

//   private async stepVerifyEmptyDatabase(): Promise<TestStep> {
//     const start = Date.now();

//     const allChannels = await this.databaseService.getAllChannelConfigs();
//     const allSettings = await this.databaseService.getAllGuildSettings();

//     // Vérifier qu'il n'y a aucune donnée de test
//     const testChannels = allChannels.filter(
//       (c) => c.channelId.startsWith('TEST_') || c.guildId === this.TEST_GUILD_ID || c.guildId.startsWith('TEST_'),
//     );
//     const testSettings = allSettings.filter((s) => s.guildId === this.TEST_GUILD_ID || s.guildId.startsWith('TEST_'));

//     const isEmpty = testChannels.length === 0 && testSettings.length === 0;

//     return {
//       name: 'Verify Empty Database',
//       success: isEmpty,
//       duration: Date.now() - start,
//       details: `Test data in DB: ${testChannels.length} channels, ${testSettings.length} settings`,
//       cacheCount: 0,
//       dbCount: testChannels.length + testSettings.length,
//     };
//   }

//   private async stepCreateGuildSettings(): Promise<TestStep> {
//     const start = Date.now();

//     const guildSettings = GuildSettingsEntity.create({
//       guildId: this.TEST_GUILD_ID,
//       timezone: 'Europe/Paris',
//       positionDisplayEnabled: true,
//       globalChannelId: this.TEST_GLOBAL_CHANNEL,
//       forwardTpSl: true,
//       autoDeleteWarnings: false,
//       summaryPreferences: {
//         dailySummary: true,
//         weeklySummary: false,
//         monthlySummary: true,
//       },
//       positionSizeDefaults: {
//         walletAddress: 'test_wallet_address',
//         stopLossPercent: 5.0,
//       },
//       createdAt: Date.now(),
//     });

//     await this.guildRepo.save(guildSettings);
//     this.createdGuildIds.add(this.TEST_GUILD_ID);

//     return {
//       name: 'Create Guild Settings',
//       success: true,
//       duration: Date.now() - start,
//       details: `Guild settings created for ${this.TEST_GUILD_ID}`,
//       cacheCount: 1,
//       dbCount: 1,
//     };
//   }

//   private async stepVerifyGuildSettings(): Promise<TestStep> {
//     const start = Date.now();

//     // Vérifier en cache
//     const cachedSettings = await this.guildRepo.getByGuildId(this.TEST_GUILD_ID);

//     // Vérifier en DB
//     const dbSettings = await this.databaseService.getGuildSettings(this.TEST_GUILD_ID);

//     // Vérifier l'intégrité des données
//     const dataIntegrity =
//       cachedSettings?.timezone === 'Europe/Paris' &&
//       cachedSettings?.positionDisplayEnabled === true &&
//       cachedSettings?.globalChannelId === this.TEST_GLOBAL_CHANNEL &&
//       dbSettings?.timezone === 'Europe/Paris' &&
//       dbSettings?.positionDisplayEnabled === true &&
//       dbSettings?.globalChannelId === this.TEST_GLOBAL_CHANNEL;

//     const success = cachedSettings !== null && dbSettings !== null && dataIntegrity;

//     return {
//       name: 'Verify Guild Settings',
//       success,
//       duration: Date.now() - start,
//       details: `Cache: ${cachedSettings ? '✅' : '❌'}, DB: ${dbSettings ? '✅' : '❌'}, Integrity: ${dataIntegrity ? '✅' : '❌'}`,
//       cacheCount: cachedSettings ? 1 : 0,
//       dbCount: dbSettings ? 1 : 0,
//     };
//   }

//   private async stepCreateChannelConfigs(): Promise<TestStep> {
//     const start = Date.now();

//     const channels = [
//       {
//         channelId: this.TEST_CHANNEL_1,
//         image: true,
//         notifyOnClose: true,
//         pin: false,
//         tagType: 'USER' as const,
//         tagId: 'user_123',
//         threshold: 1.5,
//       },
//       {
//         channelId: this.TEST_CHANNEL_2,
//         image: false,
//         notifyOnClose: false,
//         pin: true,
//         tagType: 'ROLE' as const,
//         tagId: 'role_456',
//         threshold: 2.0,
//       },
//       {
//         channelId: this.TEST_CHANNEL_3,
//         image: true,
//         notifyOnClose: false,
//         pin: false,
//         tagType: 'NONE' as const,
//         tagId: '',
//         threshold: 0.5,
//       },
//     ];

//     for (const channelData of channels) {
//       const config = ChannelConfigEntity.create({
//         channelId: channelData.channelId,
//         guildId: this.TEST_GUILD_ID,
//         image: channelData.image,
//         notifyOnClose: channelData.notifyOnClose,
//         pin: channelData.pin,
//         tagType: channelData.tagType,
//         tagId: channelData.tagId,
//         threshold: channelData.threshold,
//         createdAt: Date.now(),
//       });

//       await this.channelRepo.save(config);
//       this.createdChannelIds.add(channelData.channelId);
//     }

//     return {
//       name: 'Create Channel Configs',
//       success: true,
//       duration: Date.now() - start,
//       details: `Created ${channels.length} channel configurations`,
//       cacheCount: channels.length,
//       dbCount: channels.length,
//     };
//   }

//   private async stepVerifyChannelConfigs(): Promise<TestStep> {
//     const start = Date.now();

//     const channelIds = [this.TEST_CHANNEL_1, this.TEST_CHANNEL_2, this.TEST_CHANNEL_3];
//     let cacheCount = 0;
//     let dbCount = 0;
//     let integrityPass = true;

//     for (const channelId of channelIds) {
//       const cached = await this.channelRepo.getByChannelId(channelId);
//       const fromDb = await this.databaseService.getChannelConfig(channelId);

//       if (cached) cacheCount++;
//       if (fromDb) dbCount++;

//       // Vérifier l'intégrité des données
//       if (cached && fromDb) {
//         if (cached.threshold !== fromDb.threshold || cached.image !== fromDb.image) {
//           integrityPass = false;
//         }
//       }
//     }

//     const success = cacheCount === 3 && dbCount === 3 && integrityPass;

//     return {
//       name: 'Verify Channel Configs',
//       success,
//       duration: Date.now() - start,
//       details: `Cache: ${cacheCount}/3, DB: ${dbCount}/3, Integrity: ${integrityPass ? '✅' : '❌'}`,
//       cacheCount,
//       dbCount,
//     };
//   }

//   private async stepCreateGlobalMessage(): Promise<TestStep> {
//     const start = Date.now();

//     const messageId = 'TEST_GLOBAL_MESSAGE_123';
//     await this.globalRepo.saveGlobalMessage(this.TEST_GUILD_ID, messageId);

//     return {
//       name: 'Create Global Message',
//       success: true,
//       duration: Date.now() - start,
//       details: `Global message created: ${messageId}`,
//       cacheCount: 1,
//       dbCount: 1,
//     };
//   }

//   private async stepVerifyCompleteState(): Promise<TestStep> {
//     const start = Date.now();

//     // Vérifier l'état complet
//     const guildChannels = await this.channelRepo.getByGuildId(this.TEST_GUILD_ID);
//     const guildSettings = await this.guildRepo.getByGuildId(this.TEST_GUILD_ID);
//     const globalMessage = await this.globalRepo.getGlobalMessage(this.TEST_GUILD_ID);

//     const expectedChannels = 3;
//     const hasSettings = guildSettings !== null;
//     const hasGlobalMessage = globalMessage !== null;

//     const success = guildChannels.length === expectedChannels && hasSettings && hasGlobalMessage;

//     return {
//       name: 'Verify Complete State',
//       success,
//       duration: Date.now() - start,
//       details: `Channels: ${guildChannels.length}/${expectedChannels}, Settings: ${hasSettings ? 'Yes' : 'No'}, Global: ${hasGlobalMessage ? 'Yes' : 'No'}`,
//       cacheCount: guildChannels.length + (hasSettings ? 1 : 0) + (hasGlobalMessage ? 1 : 0),
//       dbCount: expectedChannels + 1 + 1, // Estimation
//     };
//   }

//   private async stepUpdateGuildSettings(): Promise<TestStep> {
//     const start = Date.now();

//     const existingSettings = await this.guildRepo.getByGuildId(this.TEST_GUILD_ID);
//     if (!existingSettings) {
//       throw new Error('Guild settings not found for update');
//     }

//     const updatedSettings = GuildSettingsEntity.create({
//       ...existingSettings,
//       timezone: 'UTC',
//       positionDisplayEnabled: false,
//       autoDeleteWarnings: true,
//     });

//     await this.guildRepo.save(updatedSettings);

//     // Vérifier la mise à jour immédiate
//     const verifySettings = await this.guildRepo.getByGuildId(this.TEST_GUILD_ID);
//     const success = verifySettings?.timezone === 'UTC' && verifySettings.positionDisplayEnabled === false;

//     return {
//       name: 'Update Guild Settings',
//       success,
//       duration: Date.now() - start,
//       details: 'Settings updated: timezone=UTC, display=false',
//       cacheCount: 1,
//       dbCount: 1,
//     };
//   }

//   private async stepUpdateChannelConfigs(): Promise<TestStep> {
//     const start = Date.now();

//     // Mettre à jour le premier channel
//     const existingConfig = await this.channelRepo.getByChannelId(this.TEST_CHANNEL_1);
//     if (!existingConfig) {
//       throw new Error('Channel config not found for update');
//     }

//     const updatedConfig = ChannelConfigEntity.create({
//       ...existingConfig,
//       threshold: 5.0,
//       image: false,
//       notifyOnClose: false,
//     });

//     await this.channelRepo.save(updatedConfig);

//     // Vérifier la mise à jour
//     const verifyConfig = await this.channelRepo.getByChannelId(this.TEST_CHANNEL_1);
//     const success = verifyConfig?.threshold === 5.0 && verifyConfig.image === false;

//     return {
//       name: 'Update Channel Configs',
//       success,
//       duration: Date.now() - start,
//       details: `Channel ${this.TEST_CHANNEL_1} updated: threshold=5.0, image=false`,
//       cacheCount: 3,
//       dbCount: 3,
//     };
//   }

//   private async stepDeleteOneChannel(): Promise<TestStep> {
//     const start = Date.now();

//     await this.channelRepo.delete(this.TEST_CHANNEL_2);
//     this.createdChannelIds.delete(this.TEST_CHANNEL_2);

//     // Vérifier la suppression
//     const deletedConfig = await this.channelRepo.getByChannelId(this.TEST_CHANNEL_2);
//     const success = deletedConfig === null;

//     return {
//       name: 'Delete One Channel',
//       success,
//       duration: Date.now() - start,
//       details: `Channel ${this.TEST_CHANNEL_2} deleted`,
//       cacheCount: 2,
//       dbCount: 2,
//     };
//   }

//   private async stepVerifyPartialDeletion(): Promise<TestStep> {
//     const start = Date.now();

//     const guildChannels = await this.channelRepo.getByGuildId(this.TEST_GUILD_ID);
//     const remainingChannels = [this.TEST_CHANNEL_1, this.TEST_CHANNEL_3];

//     let foundChannels = 0;
//     for (const channelId of remainingChannels) {
//       const config = await this.channelRepo.getByChannelId(channelId);
//       if (config) foundChannels++;
//     }

//     const success = guildChannels.length === 2 && foundChannels === 2;

//     return {
//       name: 'Verify Partial Deletion',
//       success,
//       duration: Date.now() - start,
//       details: `Remaining channels: ${guildChannels.length}/2, Verified: ${foundChannels}/2`,
//       cacheCount: foundChannels,
//       dbCount: 2,
//     };
//   }

//   private async stepTestConsistency(): Promise<TestStep> {
//     const start = Date.now();

//     // Comparer cache vs DB pour toutes les données de test
//     const guildChannels = await this.channelRepo.getByGuildId(this.TEST_GUILD_ID);
//     const allDbChannels = await this.databaseService.getAllChannelConfigs();
//     const testDbChannels = allDbChannels.filter((c) => c.guildId === this.TEST_GUILD_ID);

//     const cacheSettings = await this.guildRepo.getByGuildId(this.TEST_GUILD_ID);
//     const dbSettings = await this.databaseService.getGuildSettings(this.TEST_GUILD_ID);

//     const channelConsistent = guildChannels.length === testDbChannels.length;
//     const settingsConsistent = (cacheSettings !== null) === (dbSettings !== null);

//     const success = channelConsistent && settingsConsistent;

//     return {
//       name: 'Cache-DB Consistency',
//       success,
//       duration: Date.now() - start,
//       details: `Channels: ${guildChannels.length}/${testDbChannels.length}, Settings: ${cacheSettings ? '✅' : '❌'}/${dbSettings ? '✅' : '❌'}`,
//       cacheCount: guildChannels.length,
//       dbCount: testDbChannels.length,
//     };
//   }

//   private async stepPerformanceTest(): Promise<TestStep> {
//     const start = Date.now();

//     const iterations = 100;
//     const readStart = Date.now();

//     // Test de lecture
//     for (let i = 0; i < iterations; i++) {
//       await this.channelRepo.getByChannelId(this.TEST_CHANNEL_1);
//       await this.channelRepo.getByChannelId(this.TEST_CHANNEL_3);
//     }

//     const readDuration = Date.now() - readStart;
//     const avgReadTime = readDuration / (iterations * 2);

//     // Test d'écriture
//     const writeStart = Date.now();
//     const tempChannelId = 'TEST_PERF_TEMP';
//     const tempConfig = ChannelConfigEntity.create({
//       channelId: tempChannelId,
//       guildId: this.TEST_GUILD_ID,
//       image: false,
//       notifyOnClose: false,
//       pin: false,
//       tagType: 'NONE',
//       tagId: '',
//       threshold: 1.0,
//       createdAt: Date.now(),
//     });

//     for (let i = 0; i < 10; i++) {
//       await this.channelRepo.save(tempConfig);
//     }

//     const writeDuration = Date.now() - writeStart;
//     const avgWriteTime = writeDuration / 10;

//     // Cleanup du test de performance
//     await this.channelRepo.delete(tempChannelId);

//     const success = avgReadTime < 1.0 && avgWriteTime < 50.0; // Seuils de performance

//     return {
//       name: 'Performance Test',
//       success,
//       duration: Date.now() - start,
//       details: `Read: ${avgReadTime.toFixed(2)}ms avg, Write: ${avgWriteTime.toFixed(2)}ms avg`,
//       cacheCount: 2, // Channels restants
//       dbCount: 2,
//     };
//   }

//   /**
//    * Test des race conditions avec accès concurrents
//    */
//   private async stepRaceConditionTest(): Promise<TestStep> {
//     const start = Date.now();

//     try {
//       const raceChannelId = 'TEST_RACE_CONDITION';
//       const initialConfig = ChannelConfigEntity.create({
//         channelId: raceChannelId,
//         guildId: this.TEST_GUILD_ID,
//         image: true,
//         notifyOnClose: true,
//         pin: false,
//         tagType: 'NONE',
//         tagId: '',
//         threshold: 1.0,
//         createdAt: Date.now(),
//       });

//       await this.channelRepo.save(initialConfig);
//       this.createdChannelIds.add(raceChannelId);

//       // Lancer 10 mises à jour concurrentes
//       const concurrentUpdates = Array.from({ length: 10 }, async (_, i) => {
//         const config = ChannelConfigEntity.create({
//           ...initialConfig,
//           threshold: i * 1.0,
//         });
//         return this.channelRepo.save(config);
//       });

//       await Promise.all(concurrentUpdates);

//       // Vérifier la cohérence finale
//       const finalConfig = await this.channelRepo.getByChannelId(raceChannelId);
//       const dbConfig = await this.databaseService.getChannelConfig(raceChannelId);

//       const success = finalConfig !== null && dbConfig !== null && finalConfig.threshold === dbConfig.threshold;

//       // Cleanup
//       await this.channelRepo.delete(raceChannelId);
//       this.createdChannelIds.delete(raceChannelId);

//       return {
//         name: 'Race Condition Test',
//         success,
//         duration: Date.now() - start,
//         details: `10 concurrent updates, final consistency: ${success ? '✅' : '❌'}`,
//         cacheCount: 0,
//         dbCount: 0,
//       };
//     } catch (error) {
//       return {
//         name: 'Race Condition Test',
//         success: false,
//         duration: Date.now() - start,
//         details: 'Race condition test failed',
//         error: String(error),
//       };
//     }
//   }

//   /**
//    * Test complet du TTL avec expiration réelle
//    */
//   private async stepTTLExpirationTest(): Promise<TestStep> {
//     const start = Date.now();

//     try {
//       logger.info(`[E2E-TEST] ⏰ Starting TTL expiration test (will take ${this.TTL_WAIT_MS / 1000} seconds)`);

//       // Créer des données de test
//       const ttlTestChannelId = 'TEST_TTL_EXPIRATION';
//       const config = ChannelConfigEntity.create({
//         channelId: ttlTestChannelId,
//         guildId: this.TEST_GUILD_ID,
//         image: true,
//         notifyOnClose: true,
//         pin: false,
//         tagType: 'USER',
//         tagId: 'ttl_test_user',
//         threshold: 3.14,
//         createdAt: Date.now(),
//       });

//       await this.channelRepo.save(config);
//       this.createdChannelIds.add(ttlTestChannelId);

//       // Vérifier que c'est en cache
//       const cached1 = await this.channelRepo.getByChannelId(ttlTestChannelId);
//       if (!cached1) throw new Error('Config not saved to cache');

//       logger.info(`[E2E-TEST] ⏳ Waiting ${this.TTL_WAIT_MS / 1000} seconds for TTL expiration...`);

//       // Attendre l'expiration du TTL
//       await new Promise((resolve) => setTimeout(resolve, this.TTL_WAIT_MS));

//       // Accéder à nouveau - devrait déclencher un refresh depuis la DB
//       const cached2 = await this.channelRepo.getByChannelId(ttlTestChannelId);
//       if (!cached2) throw new Error('Config should be refreshed from DB, not deleted');

//       // Vérifier que les données sont identiques
//       const dataMatch = cached1.threshold === cached2.threshold && cached1.tagId === cached2.tagId;

//       // Cleanup
//       await this.channelRepo.delete(ttlTestChannelId);
//       this.createdChannelIds.delete(ttlTestChannelId);

//       return {
//         name: 'TTL Expiration Test',
//         success: dataMatch,
//         duration: Date.now() - start,
//         details: `TTL expired and refreshed correctly after ${this.TTL_WAIT_MS / 1000}s wait`,
//         cacheCount: 0,
//         dbCount: 0,
//       };
//     } catch (error) {
//       return {
//         name: 'TTL Expiration Test',
//         success: false,
//         duration: Date.now() - start,
//         details: 'TTL test failed',
//         error: String(error),
//       };
//     }
//   }

//   /**
//    * Test du comportement du TTL (pas de refresh automatique)
//    */
//   private async stepTTLRefreshTest(): Promise<TestStep> {
//     const start = Date.now();

//     try {
//       const ttlRefreshChannelId = 'TEST_TTL_NO_REFRESH';
//       const config = ChannelConfigEntity.create({
//         channelId: ttlRefreshChannelId,
//         guildId: this.TEST_GUILD_ID,
//         image: false,
//         notifyOnClose: false,
//         pin: false,
//         tagType: 'NONE',
//         tagId: '',
//         threshold: 2.71,
//         createdAt: Date.now(),
//       });

//       await this.channelRepo.save(config);
//       this.createdChannelIds.add(ttlRefreshChannelId);

//       // Attendre presque le TTL complet (25 secondes)
//       await new Promise((resolve) => setTimeout(resolve, this.CACHE_TTL_MS - 5000));

//       // Accéder - devrait toujours être en cache
//       const beforeExpiry = await this.channelRepo.getByChannelId(ttlRefreshChannelId);
//       const stillValid = beforeExpiry !== null && beforeExpiry.threshold === 2.71;

//       // Attendre que le TTL expire (10 secondes de plus = 35 secondes total)
//       await new Promise((resolve) => setTimeout(resolve, 10000));

//       // Maintenant ça devrait être rafraîchi depuis la DB
//       const afterExpiry = await this.channelRepo.getByChannelId(ttlRefreshChannelId);
//       const wasRefreshed = afterExpiry !== null && afterExpiry.threshold === 2.71;

//       // Cleanup
//       await this.channelRepo.delete(ttlRefreshChannelId);
//       this.createdChannelIds.delete(ttlRefreshChannelId);

//       const success = stillValid && wasRefreshed;

//       return {
//         name: 'TTL No-Refresh Test',
//         success,
//         duration: Date.now() - start,
//         details: `Cache valid at 25s: ${stillValid}, Refreshed after 35s: ${wasRefreshed}`,
//         cacheCount: 0,
//         dbCount: 0,
//       };
//     } catch (error) {
//       return {
//         name: 'TTL No-Refresh Test',
//         success: false,
//         duration: Date.now() - start,
//         details: 'TTL refresh test failed',
//         error: String(error),
//       };
//     }
//   }

//   /**
//    * Test de cohérence avec cache expiré
//    */
//   private async stepConsistencyWithExpiredCache(): Promise<TestStep> {
//     const start = Date.now();

//     try {
//       logger.info(`[E2E-TEST] 🔄 Testing consistency with expired cache (${this.TTL_WAIT_MS / 1000}s wait)`);

//       const consistencyChannelId = 'TEST_CONSISTENCY_EXPIRED';

//       // Créer une config
//       const config = ChannelConfigEntity.create({
//         channelId: consistencyChannelId,
//         guildId: this.TEST_GUILD_ID,
//         image: false,
//         notifyOnClose: false,
//         pin: false,
//         tagType: 'ROLE',
//         tagId: 'role_test',
//         threshold: 7.77,
//         createdAt: Date.now(),
//       });

//       await this.channelRepo.save(config);
//       this.createdChannelIds.add(consistencyChannelId);

//       // Modifier directement en DB (simuler un changement externe)
//       const modifiedConfig = ChannelConfigEntity.create({
//         ...config,
//         threshold: 9.99,
//         image: true,
//       });
//       await this.databaseService.saveChannelConfig(modifiedConfig);

//       // Attendre l'expiration du cache
//       logger.info(`[E2E-TEST] ⏳ Waiting ${this.TTL_WAIT_MS / 1000} seconds for cache to expire...`);
//       await new Promise((resolve) => setTimeout(resolve, this.TTL_WAIT_MS));

//       // Accéder - devrait récupérer la version modifiée de la DB
//       const retrieved = await this.channelRepo.getByChannelId(consistencyChannelId);

//       const success = retrieved?.threshold === 9.99 && retrieved?.image === true;

//       // Cleanup
//       await this.channelRepo.delete(consistencyChannelId);
//       this.createdChannelIds.delete(consistencyChannelId);

//       return {
//         name: 'Consistency With Expired Cache',
//         success,
//         duration: Date.now() - start,
//         details: `Cache refresh after expiration: ${success ? 'Correct' : 'Failed'} (threshold: ${retrieved?.threshold})`,
//         cacheCount: 0,
//         dbCount: 0,
//       };
//     } catch (error) {
//       return {
//         name: 'Consistency With Expired Cache',
//         success: false,
//         duration: Date.now() - start,
//         details: 'Consistency test failed',
//         error: String(error),
//       };
//     }
//   }

//   /**
//    * Test de stress avec opérations concurrentes
//    */
//   private async stepConcurrentOperationsStress(): Promise<TestStep> {
//     const start = Date.now();

//     try {
//       logger.info('[E2E-TEST] 💪 Starting concurrent operations stress test');

//       const concurrentWorkers = 10;
//       const operationsPerWorker = 20;
//       let totalOperations = 0;
//       let successfulOperations = 0;

//       // Créer des workers concurrents
//       const workers = Array.from({ length: concurrentWorkers }, async (_, workerId) => {
//         let workerSuccesses = 0;
//         let workerOperations = 0;

//         for (let i = 0; i < operationsPerWorker; i++) {
//           try {
//             const channelId = `TEST_STRESS_W${workerId}_OP${i}`;

//             // Opération aléatoire
//             const operation = Math.floor(Math.random() * 4);

//             switch (operation) {
//               case 0: {
//                 // Create
//                 const config = ChannelConfigEntity.create({
//                   channelId,
//                   guildId: this.TEST_GUILD_ID,
//                   image: Math.random() > 0.5,
//                   notifyOnClose: Math.random() > 0.5,
//                   pin: false,
//                   tagType: 'NONE',
//                   tagId: '',
//                   threshold: Math.random() * 10,
//                   createdAt: Date.now(),
//                 });
//                 await this.channelRepo.save(config);
//                 this.createdChannelIds.add(channelId);
//                 break;
//               }

//               case 1: // Read
//                 await this.channelRepo.getByChannelId(channelId);
//                 break;

//               case 2: {
//                 // Update
//                 const existing = await this.channelRepo.getByChannelId(channelId);
//                 if (existing) {
//                   const updated = ChannelConfigEntity.create({
//                     ...existing,
//                     threshold: Math.random() * 10,
//                   });
//                   await this.channelRepo.save(updated);
//                 }
//                 break;
//               }

//               case 3: // Delete
//                 await this.channelRepo.delete(channelId);
//                 this.createdChannelIds.delete(channelId);
//                 break;
//             }

//             workerSuccesses++;
//           } catch (error) {
//             // Erreur attendue dans un test de stress
//           }

//           workerOperations++;

//           // Pause micro pour éviter de surcharger
//           if (i % 5 === 0) {
//             await new Promise((resolve) => setImmediate(resolve));
//           }
//         }

//         return { successes: workerSuccesses, operations: workerOperations };
//       });

//       const results = await Promise.all(workers);

//       // Agréger les résultats
//       for (const result of results) {
//         totalOperations += result.operations;
//         successfulOperations += result.successes;
//       }

//       const successRate = (successfulOperations / totalOperations) * 100;
//       const success = successRate > 80; // Au moins 80% de succès

//       return {
//         name: 'Concurrent Operations Stress',
//         success,
//         duration: Date.now() - start,
//         details: `${totalOperations} ops, ${successfulOperations} success (${successRate.toFixed(1)}%)`,
//         cacheCount: this.createdChannelIds.size,
//         dbCount: this.createdChannelIds.size,
//       };
//     } catch (error) {
//       return {
//         name: 'Concurrent Operations Stress',
//         success: false,
//         duration: Date.now() - start,
//         details: 'Stress test failed',
//         error: String(error),
//       };
//     }
//   }

//   /**
//    * Test de performance sous charge prolongée
//    */
//   private async stepPerformanceUnderLoad(): Promise<TestStep> {
//     const start = Date.now();

//     try {
//       logger.info('[E2E-TEST] 🚀 Starting performance under load test');

//       // Créer un jeu de données conséquent
//       const baseChannels = 20;
//       const iterations = 100;

//       // Phase 1: Créer des données de base
//       const baseChannelIds: string[] = [];
//       for (let i = 0; i < baseChannels; i++) {
//         const channelId = `TEST_PERF_BASE_${i}`;
//         const config = ChannelConfigEntity.create({
//           channelId,
//           guildId: this.TEST_GUILD_ID,
//           image: i % 2 === 0,
//           notifyOnClose: i % 3 === 0,
//           pin: false,
//           tagType: 'NONE',
//           tagId: '',
//           threshold: i * 0.5,
//           createdAt: Date.now(),
//         });
//         await this.channelRepo.save(config);
//         this.createdChannelIds.add(channelId);
//         baseChannelIds.push(channelId);
//       }

//       // Phase 2: Tests de performance intensive
//       const readTimes: number[] = [];
//       const writeTimes: number[] = [];

//       for (let i = 0; i < iterations; i++) {
//         // Test de lecture
//         const readStart = Date.now();
//         for (const channelId of baseChannelIds) {
//           await this.channelRepo.getByChannelId(channelId);
//         }
//         readTimes.push(Date.now() - readStart);

//         // Test d'écriture
//         const writeStart = Date.now();
//         const tempChannelId = `TEST_PERF_TEMP_${i}`;
//         const testConfig = ChannelConfigEntity.create({
//           channelId: tempChannelId,
//           guildId: this.TEST_GUILD_ID,
//           image: true,
//           notifyOnClose: false,
//           pin: false,
//           tagType: 'NONE',
//           tagId: '',
//           threshold: i * 0.1,
//           createdAt: Date.now(),
//         });
//         await this.channelRepo.save(testConfig);
//         writeTimes.push(Date.now() - writeStart);

//         // Supprimer la donnée temporaire
//         await this.channelRepo.delete(tempChannelId);

//         // Pause micro pour éviter la surcharge
//         if (i % 10 === 0) {
//           await new Promise((resolve) => setTimeout(resolve, 10));
//         }
//       }

//       // Analyser les performances
//       const avgReadTime = readTimes.reduce((a, b) => a + b, 0) / readTimes.length;
//       const avgWriteTime = writeTimes.reduce((a, b) => a + b, 0) / writeTimes.length;
//       const maxReadTime = Math.max(...readTimes);
//       const maxWriteTime = Math.max(...writeTimes);

//       // Critères de succès : temps moyens raisonnables
//       const success = avgReadTime < 100 && avgWriteTime < 50; // ms

//       return {
//         name: 'Performance Under Load',
//         success,
//         duration: Date.now() - start,
//         details: `${iterations} cycles: Read avg ${avgReadTime.toFixed(1)}ms (max ${maxReadTime}ms), Write avg ${avgWriteTime.toFixed(1)}ms (max ${maxWriteTime}ms)`,
//         cacheCount: baseChannelIds.length,
//         dbCount: baseChannelIds.length,
//       };
//     } catch (error) {
//       return {
//         name: 'Performance Under Load',
//         success: false,
//         duration: Date.now() - start,
//         details: 'Performance test failed',
//         error: String(error),
//       };
//     }
//   }

//   /**
//    * Test de pression mémoire
//    */
//   private async stepMemoryPressureTest(): Promise<TestStep> {
//     const start = Date.now();

//     try {
//       const initialMemory = process.memoryUsage().heapUsed;
//       const largeDataCount = 50;

//       // Créer beaucoup de données avec de gros tagIds
//       for (let i = 0; i < largeDataCount; i++) {
//         const channelId = `TEST_MEMORY_${i}`;
//         const config = ChannelConfigEntity.create({
//           channelId,
//           guildId: this.TEST_GUILD_ID,
//           image: true,
//           notifyOnClose: true,
//           pin: false,
//           tagType: 'USER',
//           tagId: 'x'.repeat(1000), // Grand tagId pour la pression mémoire
//           threshold: Math.random() * 100,
//           createdAt: Date.now(),
//         });
//         await this.channelRepo.save(config);
//         this.createdChannelIds.add(channelId);
//       }

//       const afterCreationMemory = process.memoryUsage().heapUsed;
//       const memoryIncrease = (afterCreationMemory - initialMemory) / 1024 / 1024; // MB

//       // Cleanup
//       for (let i = 0; i < largeDataCount; i++) {
//         const channelId = `TEST_MEMORY_${i}`;
//         await this.channelRepo.delete(channelId);
//         this.createdChannelIds.delete(channelId);
//       }

//       // Forcer le garbage collection si disponible
//       if (global.gc) {
//         global.gc();
//       }

//       const afterCleanupMemory = process.memoryUsage().heapUsed;
//       const memoryReleased = (afterCreationMemory - afterCleanupMemory) / 1024 / 1024; // MB

//       const success = memoryIncrease < 100 && memoryReleased > memoryIncrease * 0.5; // Pas plus de 100MB et au moins 50% libéré

//       return {
//         name: 'Memory Pressure Test',
//         success,
//         duration: Date.now() - start,
//         details: `Memory increase: ${memoryIncrease.toFixed(1)}MB, Released: ${memoryReleased.toFixed(1)}MB`,
//         cacheCount: 0,
//         dbCount: 0,
//       };
//     } catch (error) {
//       return {
//         name: 'Memory Pressure Test',
//         success: false,
//         duration: Date.now() - start,
//         details: 'Memory pressure test failed',
//         error: String(error),
//       };
//     }
//   }

//   /**
//    * Simulation d'utilisation réelle avec tracking précis
//    */
//   private async stepRealUsageSimulation(): Promise<TestStep> {
//     const start = Date.now();

//     try {
//       logger.info('[E2E-TEST] 🎭 Simulating real usage patterns');

//       let operationCount = 0;
//       let errorCount = 0;
//       const createdInSimulation: string[] = [];

//       // Simulation de 60 secondes d'utilisation réelle
//       const simulationStart = Date.now();
//       const simulationDuration = 60 * 1000; // 60 secondes

//       while (Date.now() - simulationStart < simulationDuration) {
//         try {
//           const cycleId = Math.floor(operationCount / 8);

//           // Scénario typique : Ajout de channels à une guild
//           for (let i = 0; i < 3; i++) {
//             const channelId = `TEST_REAL_SIM_C${cycleId}_${i}`;
//             const config = ChannelConfigEntity.create({
//               channelId,
//               guildId: this.TEST_GUILD_ID,
//               image: Math.random() > 0.3, // 70% chance d'avoir des images
//               notifyOnClose: Math.random() > 0.5, // 50% chance de notification
//               pin: Math.random() > 0.8, // 20% chance de pin
//               tagType: Math.random() > 0.7 ? 'USER' : 'NONE', // 30% chance d'avoir un tag
//               tagId: Math.random() > 0.7 ? `user_${Math.floor(Math.random() * 1000)}` : '',
//               threshold: Math.random() * 5, // Seuil entre 0 et 5
//               createdAt: Date.now(),
//             });

//             await this.channelRepo.save(config);
//             this.createdChannelIds.add(channelId);
//             createdInSimulation.push(channelId);
//             operationCount++;
//           }

//           // Lecture de configs existantes
//           if (createdInSimulation.length > 0) {
//             for (let i = 0; i < Math.min(5, createdInSimulation.length); i++) {
//               const randomIndex = Math.floor(Math.random() * createdInSimulation.length);
//               await this.channelRepo.getByChannelId(createdInSimulation[randomIndex]);
//               operationCount++;
//             }
//           }

//           // Mise à jour occasionnelle
//           if (Math.random() > 0.7 && createdInSimulation.length > 0) {
//             const randomIndex = Math.floor(Math.random() * createdInSimulation.length);
//             const updateChannelId = createdInSimulation[randomIndex];
//             const existing = await this.channelRepo.getByChannelId(updateChannelId);
//             if (existing) {
//               const updated = ChannelConfigEntity.create({
//                 ...existing,
//                 threshold: Math.random() * 3,
//               });
//               await this.channelRepo.save(updated);
//               operationCount++;
//             }
//           }

//           // Pause réaliste entre les opérations
//           await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
//         } catch (error) {
//           errorCount++;
//         }
//       }

//       logger.info(`[E2E-TEST] Created ${createdInSimulation.length} channels in simulation`);

//       // CLEANUP: Supprimer tous les channels créés pendant la simulation
//       logger.info(`[E2E-TEST] Cleaning up ${createdInSimulation.length} simulation channels...`);
//       let cleanupErrors = 0;
//       for (const channelId of createdInSimulation) {
//         try {
//           await this.channelRepo.delete(channelId);
//           this.createdChannelIds.delete(channelId);
//         } catch (error) {
//           cleanupErrors++;
//         }
//       }

//       if (cleanupErrors > 0) {
//         logger.warn(`[E2E-TEST] Failed to cleanup ${cleanupErrors} simulation channels`);
//       }

//       const errorRate = operationCount > 0 ? (errorCount / operationCount) * 100 : 0;
//       const success = errorRate < 5 && cleanupErrors === 0; // Moins de 5% d'erreurs ET cleanup réussi

//       return {
//         name: 'Real Usage Simulation',
//         success,
//         duration: Date.now() - start,
//         details: `${operationCount} operations in 60s, ${errorCount} errors (${errorRate.toFixed(1)}%), ${createdInSimulation.length} channels created and cleaned`,
//         cacheCount: 0, // Après cleanup
//         dbCount: 0, // Après cleanup
//       };
//     } catch (error) {
//       return {
//         name: 'Real Usage Simulation',
//         success: false,
//         duration: Date.now() - start,
//         details: 'Real usage simulation failed',
//         error: String(error),
//       };
//     }
//   }

//   /**
//    * Test de récupération après corruption simulée
//    */
//   private async stepRecoveryAfterCorruption(): Promise<TestStep> {
//     const start = Date.now();

//     try {
//       logger.info('[E2E-TEST] 🛠️ Testing recovery after corruption');

//       const recoveryChannelId = 'TEST_RECOVERY_CHANNEL';

//       // Créer une config normale
//       const config = ChannelConfigEntity.create({
//         channelId: recoveryChannelId,
//         guildId: this.TEST_GUILD_ID,
//         image: true,
//         notifyOnClose: true,
//         pin: false,
//         tagType: 'USER',
//         tagId: 'recovery_user',
//         threshold: 2.5,
//         createdAt: Date.now(),
//       });

//       await this.channelRepo.save(config);
//       this.createdChannelIds.add(recoveryChannelId);

//       // Simuler différents types de "corruption" et vérifier la récupération
//       let recoveryTests = 0;
//       let successfulRecoveries = 0;

//       // Test 1: Accès à des données inexistantes
//       try {
//         const fakeAccess = await this.channelRepo.getByChannelId('COMPLETELY_FAKE_ID_123456');
//         if (fakeAccess === null) {
//           successfulRecoveries++; // Bonne gestion
//         }
//       } catch (error) {
//         // Erreur = mauvaise gestion
//       }
//       recoveryTests++;

//       // Test 2: Suppression puis re-accès
//       await this.channelRepo.delete(recoveryChannelId);
//       const afterDelete = await this.channelRepo.getByChannelId(recoveryChannelId);
//       if (afterDelete === null) {
//         successfulRecoveries++; // Bonne gestion de la suppression
//       }
//       recoveryTests++;

//       // Test 3: Re-création après suppression
//       await this.channelRepo.save(config);
//       const afterRecreate = await this.channelRepo.getByChannelId(recoveryChannelId);
//       if (afterRecreate && afterRecreate.threshold === 2.5) {
//         successfulRecoveries++; // Bonne re-création
//       }
//       recoveryTests++;

//       // Test 4: Opérations multiples rapides
//       const rapidOps = Array.from({ length: 10 }, async (_, i) => {
//         try {
//           if (i % 3 === 0) {
//             return await this.channelRepo.save(config);
//           }
//           if (i % 3 === 1) {
//             return await this.channelRepo.getByChannelId(recoveryChannelId);
//           }
//           const existing = await this.channelRepo.getByChannelId(recoveryChannelId);
//           if (existing) {
//             const updated = ChannelConfigEntity.create({
//               ...existing,
//               threshold: i * 0.1,
//             });
//             return await this.channelRepo.save(updated);
//           }
//         } catch (error) {
//           return null;
//         }
//       });

//       const rapidResults = await Promise.all(rapidOps);
//       const rapidSuccesses = rapidResults.filter((r) => r !== null).length;
//       if (rapidSuccesses >= 8) {
//         // Au moins 80% de succès
//         successfulRecoveries++;
//       }
//       recoveryTests++;

//       // Cleanup
//       await this.channelRepo.delete(recoveryChannelId);
//       this.createdChannelIds.delete(recoveryChannelId);

//       const success = successfulRecoveries === recoveryTests;

//       return {
//         name: 'Recovery After Corruption',
//         success,
//         duration: Date.now() - start,
//         details: `${successfulRecoveries}/${recoveryTests} recovery scenarios passed`,
//         cacheCount: 0,
//         dbCount: 0,
//       };
//     } catch (error) {
//       return {
//         name: 'Recovery After Corruption',
//         success: false,
//         duration: Date.now() - start,
//         details: 'Recovery test failed',
//         error: String(error),
//       };
//     }
//   }

//   /**
//    * Test des cas limites (edge cases)
//    */
//   private async stepEdgeCasesTest(): Promise<TestStep> {
//     const start = Date.now();

//     try {
//       let edgeCasesPassed = 0;
//       let edgeCasesTotal = 0;

//       // Test 1: ChannelId vide
//       edgeCasesTotal++;
//       try {
//         const emptyChannelId = '';
//         const config = ChannelConfigEntity.create({
//           channelId: emptyChannelId,
//           guildId: this.TEST_GUILD_ID,
//           image: true,
//           notifyOnClose: true,
//           pin: false,
//           tagType: 'NONE',
//           tagId: '',
//           threshold: 1.0,
//           createdAt: Date.now(),
//         });
//         await this.channelRepo.save(config);
//         // Si on arrive ici, c'est un problème
//       } catch (error) {
//         edgeCasesPassed++; // Devrait échouer
//       }

//       // Test 2: Très long tagId
//       edgeCasesTotal++;
//       try {
//         const longTagChannelId = 'TEST_EDGE_LONG_TAG';
//         const config = ChannelConfigEntity.create({
//           channelId: longTagChannelId,
//           guildId: this.TEST_GUILD_ID,
//           image: true,
//           notifyOnClose: true,
//           pin: false,
//           tagType: 'USER',
//           tagId: 'x'.repeat(10000), // Très long tagId
//           threshold: 1.0,
//           createdAt: Date.now(),
//         });
//         await this.channelRepo.save(config);
//         this.createdChannelIds.add(longTagChannelId);

//         // Vérifier qu'on peut le récupérer
//         const retrieved = await this.channelRepo.getByChannelId(longTagChannelId);
//         if (retrieved && retrieved.tagId.length === 10000) {
//           edgeCasesPassed++;
//         }

//         await this.channelRepo.delete(longTagChannelId);
//         this.createdChannelIds.delete(longTagChannelId);
//       } catch (error) {
//         // C'est OK si ça échoue
//       }

//       // Test 3: Caractères spéciaux dans les IDs
//       edgeCasesTotal++;
//       try {
//         const specialChannelId = 'TEST_EDGE_!@#$%^&*()_+{}|:<>?';
//         const config = ChannelConfigEntity.create({
//           channelId: specialChannelId,
//           guildId: this.TEST_GUILD_ID,
//           image: true,
//           notifyOnClose: true,
//           pin: false,
//           tagType: 'NONE',
//           tagId: '',
//           threshold: 99.99,
//           createdAt: Date.now(),
//         });
//         await this.channelRepo.save(config);
//         this.createdChannelIds.add(specialChannelId);

//         const retrieved = await this.channelRepo.getByChannelId(specialChannelId);
//         if (retrieved && retrieved.threshold === 99.99) {
//           edgeCasesPassed++;
//         }

//         await this.channelRepo.delete(specialChannelId);
//         this.createdChannelIds.delete(specialChannelId);
//       } catch (error) {
//         // Peut échouer selon l'implémentation
//       }

//       // Test 4: Valeurs limites pour threshold
//       edgeCasesTotal++;
//       const extremeChannelId = 'TEST_EDGE_EXTREME_VALUES';
//       try {
//         const config = ChannelConfigEntity.create({
//           channelId: extremeChannelId,
//           guildId: this.TEST_GUILD_ID,
//           image: true,
//           notifyOnClose: true,
//           pin: false,
//           tagType: 'NONE',
//           tagId: '',
//           threshold: Number.MAX_SAFE_INTEGER,
//           createdAt: Date.now(),
//         });
//         await this.channelRepo.save(config);
//         this.createdChannelIds.add(extremeChannelId);

//         const retrieved = await this.channelRepo.getByChannelId(extremeChannelId);
//         if (retrieved && retrieved.threshold === Number.MAX_SAFE_INTEGER) {
//           edgeCasesPassed++;
//         }

//         await this.channelRepo.delete(extremeChannelId);
//         this.createdChannelIds.delete(extremeChannelId);
//       } catch (error) {
//         // OK si ça échoue
//       }

//       const success = edgeCasesPassed >= edgeCasesTotal * 0.75; // Au moins 75% de succès

//       return {
//         name: 'Edge Cases Test',
//         success,
//         duration: Date.now() - start,
//         details: `${edgeCasesPassed}/${edgeCasesTotal} edge cases handled correctly`,
//         cacheCount: 0,
//         dbCount: 0,
//       };
//     } catch (error) {
//       return {
//         name: 'Edge Cases Test',
//         success: false,
//         duration: Date.now() - start,
//         details: 'Edge cases test failed',
//         error: String(error),
//       };
//     }
//   }

//   private async stepDeleteGlobalMessage(): Promise<TestStep> {
//     const start = Date.now();

//     await this.globalRepo.deleteGlobalMessage(this.TEST_GUILD_ID);

//     // Vérifier la suppression
//     const deletedMessage = await this.globalRepo.getGlobalMessage(this.TEST_GUILD_ID);
//     const success = deletedMessage === null;

//     return {
//       name: 'Delete Global Message',
//       success,
//       duration: Date.now() - start,
//       details: 'Global message deleted',
//       cacheCount: 0,
//       dbCount: 0,
//     };
//   }

//   private async stepDeleteRemainingChannels(): Promise<TestStep> {
//     const start = Date.now();

//     const remainingChannels = [this.TEST_CHANNEL_1, this.TEST_CHANNEL_3];

//     for (const channelId of remainingChannels) {
//       await this.channelRepo.delete(channelId);
//       this.createdChannelIds.delete(channelId);
//     }

//     // Vérifier que tous sont supprimés
//     const guildChannels = await this.channelRepo.getByGuildId(this.TEST_GUILD_ID);
//     const success = guildChannels.length === 0;

//     return {
//       name: 'Delete Remaining Channels',
//       success,
//       duration: Date.now() - start,
//       details: `Deleted ${remainingChannels.length} channels, remaining: ${guildChannels.length}`,
//       cacheCount: 0,
//       dbCount: 0,
//     };
//   }

//   private async stepDeleteGuildSettings(): Promise<TestStep> {
//     const start = Date.now();

//     await this.guildRepo.delete(this.TEST_GUILD_ID);
//     this.createdGuildIds.delete(this.TEST_GUILD_ID);

//     // Vérifier la suppression
//     const deletedSettings = await this.guildRepo.getByGuildId(this.TEST_GUILD_ID);
//     const success = deletedSettings === null;

//     return {
//       name: 'Delete Guild Settings',
//       success,
//       duration: Date.now() - start,
//       details: 'Guild settings deleted',
//       cacheCount: 0,
//       dbCount: 0,
//     };
//   }

//   private async stepVerifyFinalEmptyState(): Promise<TestStep> {
//     const start = Date.now();

//     // Vérifier que tout est vide
//     const guildChannels = await this.channelRepo.getByGuildId(this.TEST_GUILD_ID);
//     const guildSettings = await this.guildRepo.getByGuildId(this.TEST_GUILD_ID);
//     const globalMessage = await this.globalRepo.getGlobalMessage(this.TEST_GUILD_ID);

//     // Vérifier aussi en DB
//     const allDbChannels = await this.databaseService.getAllChannelConfigs();
//     const testDbChannels = allDbChannels.filter((c) => c.guildId === this.TEST_GUILD_ID);
//     const dbSettings = await this.databaseService.getGuildSettings(this.TEST_GUILD_ID);

//     const cacheEmpty = guildChannels.length === 0 && guildSettings === null && globalMessage === null;
//     const dbEmpty = testDbChannels.length === 0 && dbSettings === null;

//     const success = cacheEmpty && dbEmpty;

//     return {
//       name: 'Verify Final Empty State',
//       success,
//       duration: Date.now() - start,
//       details: `Cache empty: ${cacheEmpty ? '✅' : '❌'}, DB empty: ${dbEmpty ? '✅' : '❌'}`,
//       cacheCount: guildChannels.length + (guildSettings ? 1 : 0) + (globalMessage ? 1 : 0),
//       dbCount: testDbChannels.length + (dbSettings ? 1 : 0),
//     };
//   }

//   /**
//    * Vérification finale comprehensive après tous les tests
//    */
//   private async stepFinalComprehensiveCheck(): Promise<TestStep> {
//     const start = Date.now();

//     try {
//       logger.info('[E2E-TEST] 🔍 Final comprehensive system check');

//       // Vérifier l'état global du système après tous les tests
//       const cacheStats = this.cacheService.getStats();
//       const allDbChannels = await this.databaseService.getAllChannelConfigs();
//       const allDbSettings = await this.databaseService.getAllGuildSettings();
//       const allCachedChannels = await this.channelRepo.getAll();

//       // Filtrer TOUTES les données de test possibles
//       const testPatterns = [
//         'TEST_',
//         'STRESS_',
//         'PERF_',
//         'REAL_SIM_',
//         'TTL_',
//         'CONSISTENCY_',
//         'RECOVERY_',
//         'RACE_',
//         'MEMORY_',
//         'EDGE_',
//       ];

//       const testDbChannels = allDbChannels.filter(
//         (c) =>
//           c.guildId === this.TEST_GUILD_ID ||
//           c.guildId.startsWith('TEST_') ||
//           testPatterns.some((pattern) => c.channelId.includes(pattern)),
//       );

//       const testDbSettings = allDbSettings.filter(
//         (s) => s.guildId === this.TEST_GUILD_ID || s.guildId.startsWith('TEST_'),
//       );

//       const testCachedChannels = allCachedChannels.filter(
//         (c) =>
//           c.guildId === this.TEST_GUILD_ID ||
//           c.guildId.startsWith('TEST_') ||
//           testPatterns.some((pattern) => c.channelId.includes(pattern)),
//       );

//       // Vérifier que tout est propre
//       const dbClean = testDbChannels.length === 0 && testDbSettings.length === 0;
//       const cacheClean = testCachedChannels.length === 0;

//       // Vérifier l'intégrité du cache
//       const cacheIntegrity = cacheStats.totalKeys >= 0 && cacheStats.expiredKeys >= 0;

//       // Test de performance finale
//       const perfStart = Date.now();
//       for (let i = 0; i < 10; i++) {
//         await this.channelRepo.getByChannelId('NON_EXISTENT_FINAL_TEST');
//       }
//       const finalPerfTime = (Date.now() - perfStart) / 10;
//       const perfOk = finalPerfTime < 20; // Moins de 20ms par opération

//       // Vérifier les données non trackées qui pourraient rester
//       const unexpectedData = testDbChannels.length + testDbSettings.length + testCachedChannels.length;

//       const success = dbClean && cacheClean && cacheIntegrity && perfOk;

//       // Log détaillé si des données restent
//       if (!success) {
//         logger.warn('[E2E-TEST] Unexpected test data found:', {
//           testDbChannels: testDbChannels.map((c) => c.channelId),
//           testDbSettings: testDbSettings.map((s) => s.guildId),
//           testCachedChannels: testCachedChannels.map((c) => c.channelId),
//         });
//       }

//       return {
//         name: 'Final Comprehensive Check',
//         success,
//         duration: Date.now() - start,
//         details: `DB clean: ${dbClean}, Cache clean: ${cacheClean}, Integrity: ${cacheIntegrity}, Perf: ${finalPerfTime.toFixed(1)}ms, Unexpected data: ${unexpectedData}`,
//         cacheCount: testCachedChannels.length,
//         dbCount: testDbChannels.length + testDbSettings.length,
//       };
//     } catch (error) {
//       return {
//         name: 'Final Comprehensive Check',
//         success: false,
//         duration: Date.now() - start,
//         details: 'Final check failed',
//         error: String(error),
//       };
//     }
//   }

//   // ==================== HELPERS ====================

//   private async emergencyCleanup(): Promise<void> {
//     try {
//       logger.info('[E2E-TEST] 🧹 Starting emergency cleanup');

//       // Supprimer toutes les données trackées
//       for (const channelId of this.createdChannelIds) {
//         try {
//           await this.channelRepo.delete(channelId);
//         } catch (error) {
//           // Ignorer les erreurs
//         }
//       }

//       for (const guildId of this.createdGuildIds) {
//         try {
//           await this.guildRepo.delete(guildId);
//           await this.globalRepo.deleteGlobalMessage(guildId);
//         } catch (error) {
//           // Ignorer les erreurs
//         }
//       }

//       // Supprimer toutes les données avec patterns de test
//       const allCachedChannels = await this.channelRepo.getAll();
//       const testPatterns = [
//         'TEST_',
//         'STRESS_',
//         'PERF_',
//         'REAL_SIM_',
//         'TTL_',
//         'CONSISTENCY_',
//         'RECOVERY_',
//         'RACE_',
//         'MEMORY_',
//         'EDGE_',
//       ];

//       const testChannels = allCachedChannels.filter(
//         (c) =>
//           c.guildId === this.TEST_GUILD_ID ||
//           c.guildId.startsWith('TEST_') ||
//           testPatterns.some((pattern) => c.channelId.includes(pattern)),
//       );

//       for (const channel of testChannels) {
//         try {
//           await this.channelRepo.delete(channel.channelId);
//         } catch (error) {
//           // Ignorer
//         }
//       }

//       // Clear tracking
//       this.createdChannelIds.clear();
//       this.createdGuildIds.clear();

//       logger.info('[E2E-TEST] ✅ Emergency cleanup completed');
//     } catch (error) {
//       logger.warn('[E2E-TEST] Emergency cleanup failed', { error: String(error) });
//     }
//   }

//   private async generateTestResult(steps: TestStep[], duration: number): Promise<EndToEndTestResult> {
//     const passedSteps = steps.filter((s) => s.success).length;
//     const failedSteps = steps.length - passedSteps;

//     // État final
//     const cacheStats = this.cacheService.getStats();
//     const allDbChannels = await this.databaseService.getAllChannelConfigs();
//     const allDbSettings = await this.databaseService.getAllGuildSettings();

//     const testDbChannels = allDbChannels.filter(
//       (c) => c.guildId === this.TEST_GUILD_ID || c.guildId.startsWith('TEST_') || c.channelId.includes('TEST_'),
//     );
//     const testDbSettings = allDbSettings.filter(
//       (s) => s.guildId === this.TEST_GUILD_ID || s.guildId.startsWith('TEST_'),
//     );

//     const unexpectedData = testDbChannels.length + testDbSettings.length;

//     return {
//       timestamp: new Date().toISOString(),
//       totalSteps: steps.length,
//       passedSteps,
//       failedSteps,
//       duration,
//       steps,
//       finalState: {
//         cacheChannels: (await this.channelRepo.getByGuildId(this.TEST_GUILD_ID)).length,
//         dbChannels: testDbChannels.length,
//         cacheSettings: (await this.guildRepo.getByGuildId(this.TEST_GUILD_ID)) ? 1 : 0,
//         dbSettings: testDbSettings.length,
//         cacheGlobalMessages: (await this.globalRepo.getGlobalMessage(this.TEST_GUILD_ID)) ? 1 : 0,
//         dbGlobalMessages: 0,
//         unexpectedData,
//       },
//       success: failedSteps === 0 && unexpectedData === 0,
//     };
//   }

//   private async sendTestReport(client: Client, result: EndToEndTestResult): Promise<void> {
//     try {
//       const channel = client.channels.cache.get(this.DEBUG_CHANNEL_ID) as TextChannel;
//       if (!channel) {
//         logger.error('[E2E-TEST] Debug channel not found');
//         return;
//       }

//       const emoji = result.success ? '✅' : '⚠️';
//       const successRate = ((result.passedSteps / result.totalSteps) * 100).toFixed(1);

//       const summary = [
//         `${emoji} **END-TO-END CACHE TEST RESULTS** ${emoji}`,
//         `⏰ ${result.timestamp}`,
//         '',
//         '📊 **Test Summary:**',
//         `• Total Steps: ${result.totalSteps}`,
//         `• Passed: ${result.passedSteps} ✅`,
//         `• Failed: ${result.failedSteps} ❌`,
//         `• Success Rate: ${successRate}%`,
//         `• Duration: ${(result.duration / 1000).toFixed(1)}s (${(result.duration / 60000).toFixed(1)} minutes)`,
//         '',
//         '🏁 **Final State:**',
//         `• Cache Channels: ${result.finalState.cacheChannels}`,
//         `• DB Channels: ${result.finalState.dbChannels}`,
//         `• Cache Settings: ${result.finalState.cacheSettings}`,
//         `• DB Settings: ${result.finalState.dbSettings}`,
//         `• Cache Global Messages: ${result.finalState.cacheGlobalMessages}`,
//         `• **Unexpected Test Data**: ${result.finalState.unexpectedData}`,
//         '',
//         '🎯 **Test Outcome:**',
//         result.success
//           ? '✅ All tests passed! Database is clean.'
//           : result.finalState.unexpectedData > 0
//             ? `❌ Tests completed but ${result.finalState.unexpectedData} test data items remain in system!`
//             : '❌ Some tests failed. Check details below.',
//       ].join('\n');

//       await channel.send(summary);

//       // Envoyer les détails des étapes échouées
//       const failedSteps = result.steps.filter((s) => !s.success);
//       if (failedSteps.length > 0) {
//         const failedDetails = [
//           '',
//           '❌ **FAILED STEPS:**',
//           ...failedSteps.map((step) => `• **${step.name}**: ${step.details}${step.error ? ` (${step.error})` : ''}`),
//         ].join('\n');

//         await channel.send(failedDetails);
//       }

//       // Envoyer un résumé des étapes réussies
//       const passedSteps = result.steps.filter((s) => s.success);
//       if (passedSteps.length > 0) {
//         const passedDetails = [
//           '',
//           '✅ **PASSED STEPS:**',
//           ...passedSteps.map((step) => `• **${step.name}**: ${step.details} (${step.duration}ms)`),
//         ].join('\n');

//         // Diviser en chunks si trop long
//         if (passedDetails.length > 2000) {
//           const chunks = this.splitMessage(passedDetails, 2000);
//           for (const chunk of chunks) {
//             await channel.send(chunk);
//           }
//         } else {
//           await channel.send(passedDetails);
//         }
//       }

//       await channel.send('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
//     } catch (error) {
//       logger.error('[E2E-TEST] Failed to send test report', error as Error);
//     }
//   }

//   private async sendErrorReport(client: Client, error: Error, steps: TestStep[]): Promise<void> {
//     try {
//       const channel = client.channels.cache.get(this.DEBUG_CHANNEL_ID) as TextChannel;
//       if (!channel) return;

//       const completedSteps = steps.length;
//       const passedSteps = steps.filter((s) => s.success).length;

//       const errorReport = [
//         '🚨 **END-TO-END TEST CRASHED** 🚨',
//         `⏰ ${new Date().toISOString()}`,
//         '',
//         `**Steps Completed:** ${completedSteps}`,
//         `**Steps Passed:** ${passedSteps}`,
//         '',
//         `**Error:** ${error.message}`,
//         '',
//         '**Emergency cleanup performed**',
//       ].join('\n');

//       await channel.send(errorReport);
//     } catch (sendError) {
//       logger.error('[E2E-TEST] Failed to send error report', sendError as Error);
//     }
//   }

//   private splitMessage(message: string, maxLength: number): string[] {
//     const chunks: string[] = [];
//     let currentChunk = '';

//     const lines = message.split('\n');
//     for (const line of lines) {
//       if (`${currentChunk}${line}\n`.length > maxLength) {
//         if (currentChunk) {
//           chunks.push(currentChunk);
//           currentChunk = '';
//         }

//         if (line.length > maxLength) {
//           chunks.push(`${line.substring(0, maxLength - 3)}...`);
//         } else {
//           currentChunk = `${line}\n`;
//         }
//       } else {
//         currentChunk += `${line}\n`;
//       }
//     }

//     if (currentChunk) {
//       chunks.push(currentChunk);
//     }

//     return chunks;
//   }
// }
