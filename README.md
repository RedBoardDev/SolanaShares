# Bot Discord PNL avec tracking on-chain Solana 🚀

Bot Discord pour suivre le PNL (Profit & Loss) d'un pool de trading Solana avec tracking automatique des dépôts on-chain et calcul précis des shares.

## 🐳 Démarrage rapide avec Docker (RECOMMANDÉ)

### 1. Prérequis
- Docker et Docker Compose installés
- Un bot Discord configuré
- Une adresse de hot wallet Solana

### 2. Installation en 30 secondes

```bash
# Cloner le repository
git clone <url>
cd solana-pnl-bot

# Lancer le script de démarrage automatique
./start.sh
```

Le script va :
1. ✅ Vérifier que Docker est installé
2. ✅ Créer un fichier `.env` si nécessaire
3. ✅ Valider votre configuration
4. ✅ Construire l'image Docker optimisée
5. ✅ Démarrer le bot automatiquement

### 3. Configuration

Éditez le fichier `.env` créé automatiquement :

```env
# Discord (OBLIGATOIRE)
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id

# Solana (OBLIGATOIRE)
HOT_WALLET_ADDRESS=your_solana_hot_wallet_address

# Optionnel
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
MONTHLY_COST_USD=40
```

### 4. Commandes Docker utiles

```bash
# Voir les logs en temps réel
docker-compose logs -f

# Arrêter le bot
docker-compose down

# Redémarrer le bot
docker-compose restart

# Voir l'état du bot
docker-compose ps

# Reconstruire après modification du code
docker-compose build --no-cache && docker-compose up -d
```

## 🔧 Installation manuelle (développement)

Si vous préférez installer manuellement :

1. Cloner le repository
2. Installer les dépendances :
```bash
npm install
```

3. Créer un fichier `.env` :
```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
HOT_WALLET_ADDRESS=your_solana_hot_wallet_address
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
MONTHLY_COST_USD=40
```

4. Lancer le bot :
```bash
npm run dev
```

## 🎮 Commandes Discord

- `/wallet <address>` - Associe votre wallet Solana à votre compte Discord
- `/pnl` - Affiche votre PNL personnel avec les frais
- `/pool` - Affiche les statistiques globales du pool
- `/sync` - Force la synchronisation des dépôts (Admin uniquement)

## 🔄 Comment ça marche

### 1. Association du wallet
Les utilisateurs doivent d'abord associer leur wallet Solana avec `/wallet <address>`.

### 2. Détection des dépôts
Le bot scanne automatiquement les transactions du hot wallet toutes les heures pour détecter les nouveaux dépôts. Seuls les dépôts provenant de wallets associés sont comptabilisés.

### 3. Calcul des shares
Les shares évoluent dynamiquement :
- À chaque nouveau dépôt, les shares sont recalculées
- Un utilisateur qui dépose tôt aura une part plus importante sur la durée
- Les shares sont pondérées par le temps pour le calcul des frais

### 4. Calcul du PNL
```
PNL Brut = Valeur actuelle des parts - Total investi
Frais = $40/mois × Share moyenne pondérée × Nombre de mois
PNL Net = PNL Brut - Frais
```

### 5. Exemple
- Alice dépose 10 SOL (100% du pool)
- Après 1 mois, Bob dépose 10 SOL (maintenant 50% chacun)
- Après 2 mois total :
  - Alice paie : $40 × 1 mois à 100% + $40 × 1 mois à 50% = $60
  - Bob paie : $40 × 1 mois à 50% = $20

## 🏗️ Architecture Docker

- **Multi-stage build** : Image finale < 200MB
- **Alpine Linux** : Base ultra-légère et sécurisée
- **Utilisateur non-root** : Sécurité renforcée
- **Volume persistant** : Base de données SQLite conservée
- **Health checks** : Monitoring automatique
- **Resource limits** : 512MB RAM max, 0.5 CPU max
- **Logs rotatifs** : Évite l'accumulation des logs

## 🛡️ Sécurité

- ✅ Les clés privées ne sont jamais stockées
- ✅ Seules les adresses publiques sont enregistrées
- ✅ Les dépôts sont vérifiés on-chain
- ✅ Conteneur sécurisé avec utilisateur non-root
- ✅ Variables d'environnement isolées

## 📊 Monitoring

Le conteneur inclut des health checks automatiques. Vous pouvez monitorer :

```bash
# État de santé
docker-compose ps

# Logs détaillés
docker-compose logs -f

# Métriques système
docker stats solana-pnl-bot
```

## 🚨 Dépannage

### Le bot ne démarre pas
```bash
# Vérifier les logs
docker-compose logs

# Vérifier la configuration
cat .env

# Reconstruire complètement
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Base de données corrompue
```bash
# Arrêter le bot
docker-compose down

# Supprimer le volume (⚠️ perte de données)
docker volume rm $(docker volume ls -q | grep bot_data)

# Redémarrer
docker-compose up -d
```

## 📈 Performance

- **RAM** : ~100-200MB en fonctionnement
- **CPU** : ~5-10% lors des synchronisations
- **Réseau** : Minimal (requêtes RPC uniquement)
- **Stockage** : ~10-50MB pour la base SQLite

## 🎯 Prêt à l'emploi

Avec Docker, le bot est prêt en moins de 2 minutes :
1. Clone ✅
2. `./start.sh` ✅  
3. Éditer `.env` ✅
4. Bot fonctionnel ! 🎉

Aucune installation de Node.js, TypeScript, ou configuration de base de données requise !