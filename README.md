# Bot Discord PNL avec tracking on-chain Solana

Bot Discord pour suivre le PNL (Profit & Loss) d'un pool de trading Solana avec tracking automatique des dépôts on-chain et calcul précis des shares.

## Fonctionnalités

- **Tracking automatique on-chain** : Scanne les transactions Solana pour détecter les dépôts
- **Calcul précis des shares** : Les parts évoluent à chaque nouveau dépôt dans le pool
- **Calcul du PNL** : Basé sur la valeur actuelle du hot wallet
- **Partage des frais** : $40/mois répartis selon les shares pondérées dans le temps
- **Association wallet-utilisateur** : Chaque utilisateur associe son wallet Solana

## Installation

1. Cloner le repository
2. Installer les dépendances :
```bash
npm install
```

3. Créer un fichier `.env` :
```env
# Discord
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id

# Pool settings
HOT_WALLET_ADDRESS=your_solana_hot_wallet_address
MONTHLY_COST_USD=40

# Solana RPC (optionnel)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

4. Lancer le bot :
```bash
npm run dev
```

## Commandes Discord

- `/wallet <address>` - Associe votre wallet Solana à votre compte Discord
- `/pnl` - Affiche votre PNL personnel avec les frais
- `/pool` - Affiche les statistiques globales du pool
- `/sync` - Force la synchronisation des dépôts (Admin uniquement)

## Comment ça marche

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

## Architecture

- **SQLite** : Base de données locale pour stocker les associations et les dépôts
- **@solana/web3.js** : Interaction avec la blockchain Solana
- **discord.js** : Bot Discord
- **TypeScript** : Typage fort et meilleure DX

## Sécurité

- Les clés privées ne sont jamais stockées
- Seules les adresses publiques sont enregistrées
- Les dépôts sont vérifiés on-chain

## Notes importantes

- Le bot nécessite un RPC Solana fonctionnel
- Les dépôts doivent être envoyés depuis le wallet associé
- La synchronisation peut prendre du temps selon le nombre de transactions
- Le prix du SOL est fixé à $100 (à remplacer par une API de prix réelle)

## TODO

- [ ] Intégrer une API de prix pour SOL/USD en temps réel
- [ ] Ajouter support pour les tokens SPL
- [ ] Historique détaillé des transactions
- [ ] Exports CSV pour la comptabilité
- [ ] Notifications Discord pour les nouveaux dépôts