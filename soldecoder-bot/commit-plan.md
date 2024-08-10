# SolDecoder Bot - Plan de Commits

## Vue d'ensemble
Ce plan de commits simule un développement progressif et logique du bot Discord SolDecoder, en respectant les conventions [Conventional Commits](https://www.conventionalcommits.org/).

## Dates cibles obligatoires
- 19, 20, 26, 27, 30 juillet
- 2, 3, 4 et 10 août

## Plan détaillé des commits

### 🗓️ Juillet 2024

#### **19 juillet - 20:30**
**feat: initialize project structure and core dependencies**
- `package.json` - Configuration initiale avec dépendances Discord.js, Solana, AWS
- `tsconfig.json` - Configuration TypeScript avec path mapping
- `.gitignore` - Fichiers à ignorer pour Node.js/TypeScript
- `ecosystem.config.cjs` - Configuration PM2 pour production

#### **19 juillet - 22:15**
**feat: setup domain layer with core entities**
- `src/domain/entities/guild-settings.entity.ts` - Entité GuildSettings avec SummaryPreferences
- `src/domain/entities/channel-config.entity.ts` - Entité ChannelConfig avec métadonnées
- `src/domain/value-objects/wallet-address.ts` - Value object pour adresses de wallet
- `src/domain/value-objects/timezone.ts` - Value object pour gestion des fuseaux horaires

#### **20 juillet - 10:45**
**feat: define domain interfaces and contracts**
- `src/domain/interfaces/message-dispatcher.interface.ts` - Interface pour dispatch des messages
- `src/domain/interfaces/message-rule.interface.ts` - Interface pour règles de traitement
- `src/domain/interfaces/channel-config.repository.interface.ts` - Interface repository channels
- `src/domain/interfaces/guild-settings.repository.interface.ts` - Interface repository guilds
- `src/domain/interfaces/wallet-info.service.interface.ts` - Interface service wallet
- `src/domain/interfaces/lpagent.service.interface.ts` - Interface service LP agent

#### **20 juillet - 14:20**
**feat: implement data validation schemas**
- `src/schemas/position-data.schema.ts` - Validation des données de position
- `src/schemas/position-status.schema.ts` - Validation du statut de position
- `src/schemas/trigger-message.schema.ts` - Validation des messages de déclenchement
- `src/schemas/metlex.schema.ts` - Validation des données Metlex
- `src/schemas/nft-data.schema.ts` - Validation des données NFT

#### **20 juillet - 16:30**
**feat: add advanced position schemas**
- `src/schemas/final-position.schema.ts` - Schéma pour positions finales
- `src/schemas/meteora-pair.schema.ts` - Schéma pour paires Meteora
- `src/schemas/meteora-position.schema.ts` - Schéma pour positions Meteora
- `src/schemas/lpagent.schema.ts` - Schéma pour données LP agent
- `src/schemas/price-data.schema.ts` - Schéma pour données de prix

#### **20 juillet - 19:45**
**feat: setup infrastructure configuration**
- `src/infrastructure/config/env.ts` - Configuration des variables d'environnement
- `src/infrastructure/config/aws.ts` - Configuration AWS
- `create-dynamodb-table.json` - Script de création de table DynamoDB
- `DATABASE.md` - Documentation de l'architecture DynamoDB

#### **26 juillet - 11:15**
**feat: implement core infrastructure services**
- `src/infrastructure/services/dynamo.service.ts` - Service DynamoDB de base
- `src/infrastructure/services/cache.service.ts` - Service de cache en mémoire
- `src/infrastructure/services/rate-limiter.service.ts` - Service de limitation de taux
- `src/infrastructure/services/command-rate-limiter.service.ts` - Rate limiter pour commandes

#### **26 juillet - 14:30**
**feat: add Solana and blockchain services**
- `src/infrastructure/services/solanaweb3.service.ts` - Service Solana Web3
- `src/infrastructure/services/wallet-info.service.ts` - Service d'information wallet
- `src/infrastructure/services/lpagent.service.ts` - Service LP agent
- `src/infrastructure/services/meteora.service.ts` - Service Meteora
- `src/infrastructure/services/position-fetcher.service.ts` - Service de récupération de positions

#### **26 juillet - 17:45**
**feat: implement external API services**
- `src/infrastructure/services/coingecko.service.ts` - Service CoinGecko pour prix
- `src/infrastructure/services/api-pricing/solana-tracker-api-client.ts` - Client API Solana Tracker
- `src/infrastructure/services/api-pricing/solana-tracker-pricing.service.ts` - Service de pricing
- `src/infrastructure/services/api-pricing/api-load-balancer.ts` - Load balancer pour APIs

#### **27 juillet - 10:30**
**feat: setup repository layer with DynamoDB**
- `src/infrastructure/repositories/dynamo-guild-settings.repository.ts` - Repository guild settings
- `src/infrastructure/repositories/dynamo-channel-config.repository.ts` - Repository channel config
- `src/infrastructure/repositories/dynamo-global-message.repository.ts` - Repository messages globaux

#### **27 juillet - 13:45**
**feat: implement cache initialization service**
- `src/infrastructure/services/cache-initializer.service.ts` - Service d'initialisation du cache
- `src/infrastructure/services/position-display-scheduler.service.ts` - Planificateur d'affichage
- `src/infrastructure/services/message-dispatcher.service.ts` - Service de dispatch des messages

#### **27 juillet - 16:20**
**feat: add application use cases**
- `src/application/use-cases/ensure-guild-exists.use-case.ts` - Cas d'usage création guild
- `src/application/use-cases/init-guild-settings.use-case.ts` - Cas d'usage initialisation settings
- `src/application/use-cases/get-guild-settings.use-case.ts` - Cas d'usage récupération settings
- `src/application/use-cases/update-guild-settings.use-case.ts` - Cas d'usage mise à jour settings

#### **27 juillet - 19:30**
**feat: implement channel management use cases**
- `src/application/use-cases/add-channel-config.use-case.ts` - Cas d'usage ajout channel
- `src/application/use-cases/get-channel-config.use-case.ts` - Cas d'usage récupération channel
- `src/application/use-cases/update-channel-config.use-case.ts` - Cas d'usage mise à jour channel
- `src/application/use-cases/remove-channel-config.use-case.ts` - Cas d'usage suppression channel
- `src/application/use-cases/get-guild-channels.use-case.ts` - Cas d'usage listage channels

#### **30 juillet - 11:00**
**feat: add message parsing and processing**
- `src/application/parsers/metlex-message.parser.ts` - Parser messages Metlex
- `src/application/parsers/trigger-message.parser.ts` - Parser messages de déclenchement
- `src/application/parsers/position-status.parser.ts` - Parser statuts de position

#### **30 juillet - 14:15**
**feat: implement advanced position management**
- `src/application/use-cases/update-global-position-display.use-case.ts` - Cas d'usage affichage global

#### **30 juillet - 17:30**
**feat: setup presentation layer commands**
- `src/presentation/commands/command-runner.ts` - Runner de commandes
- `src/presentation/commands/command-errors.ts` - Gestion des erreurs de commandes
- `src/presentation/commands/channels.command.ts` - Commande de gestion des channels
- `src/presentation/commands/server-settings.command.ts` - Commande de configuration serveur

#### **30 juillet - 20:45**
**feat: add Discord slash commands**
- `src/presentation/commands/nft-price.command.ts` - Commande prix NFT
- `src/presentation/commands/position-size.command.ts` - Commande taille de position
- `src/presentation/commands/global-positions.command.ts` - Commande positions globales

### 🗓️ Août 2024

#### **2 août - 10:30**
**feat: implement Discord interaction handlers**
- `src/presentation/listeners/interactions/interaction-router.ts` - Routeur d'interactions
- `src/presentation/listeners/interactions/channel-interaction.handler.ts` - Handler interactions channels
- `src/presentation/listeners/interactions/server-interaction.handler.ts` - Handler interactions serveur

#### **2 août - 14:00**
**feat: setup message listeners and rules**
- `src/presentation/listeners/message-create/message-dispatcher.listener.ts` - Listener dispatch messages
- `src/presentation/listeners/message-create/message-rules/index.ts` - Index des règles
- `src/presentation/listeners/message-create/message-rules/closed-message.rule.ts` - Règle messages fermés
- `src/presentation/listeners/message-create/message-rules/cleanup-messages.rule.ts` - Règle nettoyage

#### **2 août - 17:30**
**feat: create Discord UI components**
- `src/presentation/ui/components/channel-select.component.ts` - Composant sélection channel
- `src/presentation/ui/components/server-select.component.ts` - Composant sélection serveur
- `src/presentation/ui/components/tag-select.component.ts` - Composant sélection tag

#### **3 août - 11:15**
**feat: implement Discord embeds**
- `src/presentation/ui/embeds/channel-detail.embed.ts` - Embed détail channel
- `src/presentation/ui/embeds/channel-list.embed.ts` - Embed liste channels
- `src/presentation/ui/embeds/server-settings.embed.ts` - Embed configuration serveur
- `src/presentation/ui/embeds/nft-price.embed.ts` - Embed prix NFT

#### **3 août - 15:00**
**feat: add position display embeds**
- `src/presentation/ui/embeds/position-size.embed.ts` - Embed taille position
- `src/presentation/ui/embeds/global-position.embed.ts` - Embed position globale

#### **3 août - 18:30**
**feat: create Discord modals**
- `src/presentation/ui/modals/wallet.modal.ts` - Modal configuration wallet
- `src/presentation/ui/modals/threshold.modal.ts` - Modal configuration seuil

#### **4 août - 10:45**
**feat: implement position image generation**
- `src/presentation/ui/position/build-position-image.ts` - Construction d'images de position
- `src/presentation/ui/position/select-background-image.ts` - Sélection d'images de fond
- `src/presentation/ui/position/build-position-message.ts` - Construction de messages de position
- `src/presentation/ui/position/build-triggered-message.ts` - Construction de messages déclenchés

#### **4 août - 14:20**
**feat: add helper utilities**
- `src/helpers/logger.ts` - Système de logging avancé
- `src/helpers/error-handler.ts` - Gestionnaire d'erreurs global
- `src/helpers/safe-pin.ts` - Utilitaire de pin sécurisé
- `src/helpers/files.ts` - Utilitaires de gestion de fichiers

#### **4 août - 17:45**
**feat: setup main application entry point**
- `src/index.ts` - Point d'entrée principal avec configuration Discord
- Configuration des intents et gestion des interactions
- Gestion des commandes slash et des listeners
- Configuration des hooks de fermeture et gestion d'erreurs

#### **10 août - 11:00**
**feat: add assets and final configuration**
- `assets/background_default.png` - Image de fond par défaut
- `assets/background_happy.png` - Image de fond heureux
- `assets/background_sad.png` - Image de fond triste
- `assets/background_summary.png` - Image de fond résumé
- `assets/background_trump.png` - Image de fond Trump
- `assets/fonts/` - Polices pour la génération d'images

#### **10 août - 14:30**
**docs: complete project documentation**
- `DATABASE.md` - Documentation complète de l'architecture
- Mise à jour des commentaires de code
- Finalisation de la documentation des APIs

## Résumé des types de commits utilisés

- **feat**: Nouvelles fonctionnalités
- **docs**: Documentation
- **style**: Formatage et style de code
- **refactor**: Refactoring de code existant
- **test**: Ajout de tests
- **chore**: Tâches de maintenance

## Horaires de commit
- **Weekends (vendredi/samedi)**: 10h-23h
- **Jours de semaine**: 20h-00h

## Structure logique du développement
1. **Domain Layer** (19-20 juillet) - Entités et interfaces métier
2. **Infrastructure Layer** (26-27 juillet) - Services et repositories
3. **Application Layer** (30 juillet) - Cas d'usage et parsers
4. **Presentation Layer** (2-4 août) - Interface Discord et UI
5. **Finalization** (10 août) - Assets et documentation

Ce plan simule un développement progressif et logique, avec des commits cohérents et des fonctionnalités qui s'ajoutent naturellement les unes aux autres.
