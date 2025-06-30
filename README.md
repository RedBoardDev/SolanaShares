# Bot Discord PNL Simple

Un bot Discord simplifié pour calculer le PNL (Profit and Loss) d'un pool de trading avec partage des coûts mensuels.

## 🚀 Fonctionnalités

- 📊 Calcul du PNL individuel avec prise en compte des shares
- 💰 Tracking des investissements multiples par utilisateur
- 📅 Calcul automatique des frais mensuels (40$/mois partagés selon les parts)
- 🎯 Vue globale du pool de trading
- 💡 Interface simple via commandes Discord

## 📋 Prérequis

- Node.js 18+ 
- Un bot Discord configuré
- Les tokens Discord (bot token et client ID)

## 🛠️ Installation

1. **Cloner le projet**
```bash
git clone <url>
cd simple-pnl-bot
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer l'environnement**
```bash
cp .env.example .env
# Éditer .env avec vos tokens Discord
```

## ⚙️ Configuration

Éditer le fichier `.env` :
- `DISCORD_TOKEN` : Le token de votre bot Discord
- `DISCORD_CLIENT_ID` : L'ID client de votre application Discord
- `MONTHLY_COST_USD` : Coût mensuel du pool (défaut: 40$)

## 🎮 Commandes Discord

### `/pnl`
Affiche votre PNL personnel avec :
- Total investi
- Part actuelle dans le pool (%)
- Valeur actuelle de vos parts
- Frais mensuels à votre charge
- PNL net après frais

### `/invest <amount>`
Enregistre un nouvel investissement
- `amount` : Montant en USD

### `/pool`
Affiche les statistiques globales :
- Nombre d'investisseurs
- Total investi
- Valeur actuelle du pool
- PNL global

### `/setpool <value>` (Admin)
Met à jour la valeur actuelle du pool
- `value` : Valeur totale en USD

## 🚦 Démarrage

```bash
# Mode développement (avec rechargement automatique)
npm run dev

# Build pour production
npm run build

# Démarrer en production
npm start
```

## 📊 Calcul du PNL

Le bot calcule le PNL selon cette formule :

1. **Part de l'utilisateur** = (Investissement utilisateur / Total investi) × 100
2. **Valeur des parts** = Valeur actuelle du pool × Part utilisateur
3. **Frais mensuels** = Part utilisateur × 40$ × Nombre de mois
4. **PNL Net** = Valeur des parts - Total investi - Frais mensuels

## 💡 Exemple

- Alice investit 1000$ (50% du pool)
- Bob investit 1000$ (50% du pool)
- Après 2 mois, le pool vaut 2500$
- Frais: 40$/mois × 2 mois = 80$ (40$ chacun)

**PNL d'Alice:**
- Investi: 1000$
- Valeur des parts: 1250$ (50% de 2500$)
- Frais: 40$
- **PNL Net: +210$ (+21%)**

## 🔧 Base de données

Le bot utilise SQLite pour stocker :
- Les investissements de chaque utilisateur
- Les snapshots de la valeur du pool
- Automatiquement créée au premier lancement

## 📝 Notes

- Les frais mensuels sont calculés depuis le premier investissement
- Les parts sont recalculées à chaque nouvel investissement
- La valeur du pool doit être mise à jour manuellement par un admin
- Toutes les valeurs sont en USD

## 🤝 Support

En cas de problème, vérifiez :
1. Les tokens Discord sont corrects
2. Le bot a les permissions nécessaires sur votre serveur
3. Les logs dans la console pour les erreurs

## 📄 License

MIT