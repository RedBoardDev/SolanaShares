# ==============================================
# Makefile pour Bot Discord PNL Solana
# ==============================================

.PHONY: help build start stop restart logs status clean setup test

# Variables
COMPOSE_FILE = docker-compose.yml
CONTAINER_NAME = solana-pnl-bot
IMAGE_NAME = solana-pnl-bot

# Couleurs pour l'affichage
BLUE = \033[0;34m
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

# Commande d'aide par défaut
help: ## Affiche l'aide
	@echo ""
	@echo "$(BLUE)🚀 Bot Discord PNL Solana - Commandes Docker$(NC)"
	@echo ""
	@echo "$(GREEN)Commandes principales:$(NC)"
	@echo "  make setup     - Configuration initiale (crée .env)"
	@echo "  make start     - Démarre le bot"
	@echo "  make stop      - Arrête le bot"
	@echo "  make restart   - Redémarre le bot"
	@echo ""
	@echo "$(GREEN)Monitoring:$(NC)"
	@echo "  make logs      - Affiche les logs en temps réel"
	@echo "  make status    - Affiche l'état du conteneur"
	@echo ""
	@echo "$(GREEN)Développement:$(NC)"
	@echo "  make build     - Reconstruit l'image"
	@echo "  make clean     - Nettoie les images et volumes"
	@echo "  make test      - Teste la configuration"
	@echo ""

setup: ## Configuration initiale
	@echo "$(BLUE)📋 Configuration initiale...$(NC)"
	@if [ ! -f .env ]; then \
		echo "$(YELLOW)Création du fichier .env...$(NC)"; \
		cp .env.docker .env; \
		echo "$(RED)⚠️  Veuillez éditer .env avec vos configurations!$(NC)"; \
		echo "$(YELLOW)Variables requises:$(NC)"; \
		echo "  - DISCORD_TOKEN"; \
		echo "  - DISCORD_CLIENT_ID"; \
		echo "  - HOT_WALLET_ADDRESS"; \
	else \
		echo "$(GREEN)✅ Fichier .env déjà existant$(NC)"; \
	fi

test: ## Teste la configuration
	@echo "$(BLUE)🧪 Test de la configuration...$(NC)"
	@if [ ! -f .env ]; then \
		echo "$(RED)❌ Fichier .env manquant. Lancez: make setup$(NC)"; \
		exit 1; \
	fi
	@source .env && \
	if [ -z "$$DISCORD_TOKEN" ] || [ "$$DISCORD_TOKEN" = "your_discord_bot_token_here" ]; then \
		echo "$(RED)❌ DISCORD_TOKEN manquant dans .env$(NC)"; \
		exit 1; \
	fi && \
	if [ -z "$$DISCORD_CLIENT_ID" ] || [ "$$DISCORD_CLIENT_ID" = "your_discord_client_id_here" ]; then \
		echo "$(RED)❌ DISCORD_CLIENT_ID manquant dans .env$(NC)"; \
		exit 1; \
	fi && \
	if [ -z "$$HOT_WALLET_ADDRESS" ] || [ "$$HOT_WALLET_ADDRESS" = "your_solana_hot_wallet_address_here" ]; then \
		echo "$(RED)❌ HOT_WALLET_ADDRESS manquant dans .env$(NC)"; \
		exit 1; \
	fi
	@echo "$(GREEN)✅ Configuration valide!$(NC)"

build: ## Reconstruit l'image Docker
	@echo "$(BLUE)🔨 Construction de l'image...$(NC)"
	@docker-compose build --no-cache
	@echo "$(GREEN)✅ Image construite!$(NC)"

start: setup test ## Démarre le bot
	@echo "$(BLUE)🚀 Démarrage du bot...$(NC)"
	@docker-compose up -d
	@sleep 3
	@if docker-compose ps | grep -q "Up"; then \
		echo "$(GREEN)🎉 Bot démarré avec succès!$(NC)"; \
		echo "$(BLUE)📝 Commandes utiles:$(NC)"; \
		echo "  make logs    - Voir les logs"; \
		echo "  make stop    - Arrêter le bot"; \
		echo "  make status  - État du bot"; \
	else \
		echo "$(RED)❌ Échec du démarrage$(NC)"; \
		docker-compose logs; \
	fi

stop: ## Arrête le bot
	@echo "$(BLUE)⏹️  Arrêt du bot...$(NC)"
	@docker-compose down
	@echo "$(GREEN)✅ Bot arrêté$(NC)"

restart: ## Redémarre le bot
	@echo "$(BLUE)🔄 Redémarrage du bot...$(NC)"
	@docker-compose restart
	@echo "$(GREEN)✅ Bot redémarré$(NC)"

logs: ## Affiche les logs en temps réel
	@echo "$(BLUE)📋 Logs du bot (Ctrl+C pour quitter):$(NC)"
	@docker-compose logs -f

status: ## Affiche l'état du conteneur
	@echo "$(BLUE)📊 État du conteneur:$(NC)"
	@docker-compose ps
	@echo ""
	@echo "$(BLUE)💾 Utilisation des ressources:$(NC)"
	@if docker ps | grep -q $(CONTAINER_NAME); then \
		docker stats --no-stream $(CONTAINER_NAME); \
	else \
		echo "$(RED)❌ Conteneur non démarré$(NC)"; \
	fi

clean: ## Nettoie les images et volumes
	@echo "$(YELLOW)🧹 Nettoyage...$(NC)"
	@docker-compose down -v
	@docker image prune -f
	@docker volume prune -f
	@echo "$(GREEN)✅ Nettoyage terminé$(NC)"

# Commandes de développement
dev-logs: ## Logs détaillés pour développement
	@docker-compose logs -f --tail=100

dev-shell: ## Accès shell au conteneur
	@docker-compose exec $(CONTAINER_NAME) /bin/sh

dev-rebuild: ## Reconstruction complète pour développement
	@echo "$(BLUE)🔄 Reconstruction complète...$(NC)"
	@docker-compose down
	@docker-compose build --no-cache
	@docker-compose up -d
	@echo "$(GREEN)✅ Reconstruction terminée$(NC)"