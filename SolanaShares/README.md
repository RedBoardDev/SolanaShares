# SolanaShares - Trading Pool Management System

## 📝 Description

SolanaShares est un système de gestion de pool de trading pour Solana. Chaque utilisateur Discord peut créer son propre wallet Solana et récupérer sa clé privée.

## 🚀 Fonctionnalités

- ✅ Création de wallet Solana via Discord (`/start`)
- ✅ Export de la clé privée (`/export`)
- 🔜 Transferts vers le hot wallet
- 🔜 Gestion des dépôts et retraits
- 🔜 Système de snapshots et parts

## 📋 Prérequis

- Node.js 20+
- NPM ou PNPM
- AWS Account (ou DynamoDB local pour le développement)
- Bot Discord configuré

## 🛠️ Installation

1. **Cloner le repository**
```bash
git clone <repository-url>
cd SolanaShares
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configuration**
Copier `.env.example` vers `.env` et remplir :
```bash
cp .env.example .env
```

Variables importantes :
- `DISCORD_TOKEN` : Token de votre bot Discord
- `DISCORD_CLIENT_ID` : ID client de votre bot Discord
- `AWS_*` : Credentials AWS (optionnel en dev)

4. **Créer les tables DynamoDB**
```bash
# Pour développement local avec docker-compose
docker-compose up -d dynamodb-local
npm run db:create-tables

# Pour production AWS
# Les tables seront créées automatiquement avec les bons credentials AWS
```

5. **Builder l'application**
```bash
npm run build
```

6. **Démarrer l'application**
```bash
# Développement
npm run dev

# Production
npm start
```

## 🎮 Commandes Discord

### `/start`
Crée un wallet Solana personnel lié à votre compte Discord. Vous recevrez :
- L'adresse de votre wallet
- La clé privée en Base64 (à conserver précieusement)

### `/export`
Récupère les informations de votre wallet existant :
- Adresse du wallet
- Clé privée en Base64

## 🔒 Sécurité

- Les clés privées sont chiffrées en base de données
- En développement : chiffrement mock
- En production : AWS KMS avec envelope encryption
- Les clés privées sont envoyées uniquement par DM Discord

## 🏗️ Architecture

```
src/
├── adapters/          # API REST & Bot Discord
├── application/       # Use cases (logique métier)
├── domain/           # Entités et interfaces
├── infra/            # Services externes (DynamoDB, KMS, Solana)
└── config/           # Configuration
```

## 🐳 Docker

Pour lancer en développement avec Docker :
```bash
docker-compose up
```

Cela lance :
- L'application Node.js
- DynamoDB local

## 📊 Tables DynamoDB

- `solana-shares-users-dev` : Utilisateurs Discord
- `solana-shares-wallets-dev` : Wallets et clés chiffrées
- `solana-shares-transactions-dev` : Historique des transactions
- `solana-shares-snapshots-dev` : Snapshots des parts

## 🚨 Important

- **Ne partagez JAMAIS votre clé privée**
- Sauvegardez votre clé privée en lieu sûr
- Le bot ne peut pas récupérer une clé privée perdue
- En production, utilisez AWS KMS pour le chiffrement

## 📝 TODO

- [ ] Implémenter les transferts vers le hot wallet
- [ ] Système de dépôts/retraits
- [ ] Calcul des parts et snapshots
- [ ] Interface web de monitoring
- [ ] Tests unitaires et d'intégration