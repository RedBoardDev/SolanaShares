#!/bin/bash

# =================================================
# Script de démarrage rapide - Bot Discord PNL Solana
# =================================================

set -e

echo "🚀 Démarrage du Bot Discord PNL Solana avec Docker..."

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
print_message() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    print_error "Docker n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Vérifier si Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Vérifier si le fichier .env existe
if [ ! -f ".env" ]; then
    print_warning "Fichier .env non trouvé. Copie du template..."
    cp .env.docker .env
    print_warning "⚠️  Veuillez éditer le fichier .env avec vos configurations:"
    print_warning "   - DISCORD_TOKEN"
    print_warning "   - DISCORD_CLIENT_ID" 
    print_warning "   - HOT_WALLET_ADDRESS"
    echo ""
    print_message "Puis relancez: ./start.sh"
    exit 1
fi

# Vérifier les variables obligatoires
source .env

if [ -z "$DISCORD_TOKEN" ] || [ "$DISCORD_TOKEN" = "your_discord_bot_token_here" ]; then
    print_error "DISCORD_TOKEN manquant dans .env"
    exit 1
fi

if [ -z "$DISCORD_CLIENT_ID" ] || [ "$DISCORD_CLIENT_ID" = "your_discord_client_id_here" ]; then
    print_error "DISCORD_CLIENT_ID manquant dans .env"
    exit 1
fi

if [ -z "$HOT_WALLET_ADDRESS" ] || [ "$HOT_WALLET_ADDRESS" = "your_solana_hot_wallet_address_here" ]; then
    print_error "HOT_WALLET_ADDRESS manquant dans .env"
    exit 1
fi

print_success "Configuration validée ✅"

# Arrêter le conteneur s'il existe déjà
print_message "Arrêt du conteneur existant (si présent)..."
docker-compose down 2>/dev/null || true

# Construire et démarrer
print_message "Construction de l'image Docker..."
docker-compose build --no-cache

print_message "Démarrage du bot..."
docker-compose up -d

# Vérifier que le conteneur fonctionne
sleep 5
if docker-compose ps | grep -q "Up"; then
    print_success "🎉 Bot démarré avec succès!"
    print_message "📊 Hot Wallet: $HOT_WALLET_ADDRESS"
    print_message "💰 Coût mensuel: \$${MONTHLY_COST_USD:-40}"
    echo ""
    print_message "📝 Commandes utiles:"
    echo "   • Voir les logs: docker-compose logs -f"
    echo "   • Arrêter le bot: docker-compose down"
    echo "   • Redémarrer: docker-compose restart"
    echo "   • État du bot: docker-compose ps"
else
    print_error "Échec du démarrage. Vérifiez les logs:"
    docker-compose logs
    exit 1
fi