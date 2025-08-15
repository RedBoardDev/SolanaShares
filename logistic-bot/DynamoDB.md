# DynamoDB Logistic Bot - Architecture

## 📋 Spécifications du projet

### Contraintes business
- Bot Discord pour suivi des participants SolanaShares
- Gestion des participants et de leurs investissements
- Statistiques globales en temps réel
- Budget optimisé, architecture serverless
- Région AWS : eu-west-3

### Données métier
```typescript
// Participant
interface Participant {
  userId: string;           // Discord user ID
  walletAddress: string;    // Solana wallet address
  investedAmount: number;   // SOL amount invested
  createdAt: number;        // Timestamp
  updatedAt: number;        // Timestamp
}

// Global Statistics
interface GlobalStats {
  totalInvested: number;      // Total SOL invested across all participants
  participantCount: number;   // Total number of participants
  activeParticipants: number; // Number of participants with investedAmount > 0
  updatedAt: number;         // Last update timestamp
}
```

### Patterns d'accès critiques
1. **Recherche par wallet address** (fréquent) : Trouver un participant via son wallet
2. **Recherche par Discord user** (fréquent) : Trouver un participant via son Discord ID
3. **Statistiques globales** (très fréquent) : Affichage temps réel des stats
4. **Liste tous les participants** (rare) : Pour les rapports et statistiques
5. **CRUD participants** : Création, mise à jour, suppression

## 🗃️ Architecture DynamoDB retenue

### Table unique : `solanashares-logistic`
```
PK (String)              SK (String)              Type (String)      Data
GLOBAL#STATS            GLOBAL#STATS             global_stats       { totalInvested, participantCount, activeParticipants, updatedAt }
USER#{userId}           WALLET#{walletAddress}   participant        { investedAmount, createdAt, updatedAt }
```

### GSI : `WalletAddressIndex`
```
GSI_PK (String)         GSI_SK (String)          Projection
WALLET#{walletAddress}  USER#{userId}            ALL
```

**Justification** :
- Accès direct O(1) par wallet address via GSI
- Accès direct O(1) par Discord user via PK
- Groupement logique des données
- Statistiques globales isolées pour performance optimale

## 🚀 Stratégie cache mémoire (CRITIQUE)

### Principe fondamental
- **Cache intelligent en mémoire** pour optimiser les accès fréquents
- **Fallback DynamoDB** rapide avec requêtes optimisées
- Cache des statistiques globales pour éviter les calculs répétitifs

### Structure cache côté application
```typescript
// Cache principal : accès O(1) par wallet address
const participantCacheByWallet = new Map<string, ParticipantEntity>();

// Cache secondaire : accès O(1) par Discord user
const participantCacheByUser = new Map<string, ParticipantEntity>();

// Cache des statistiques globales (très fréquent)
let globalStatsCache: GlobalStatsEntity | null = null;
let globalStatsCacheTimestamp = 0;
```

## ⚡ Patterns d'implémentation

### Pattern 1: Recherche par wallet (optimisé GSI)
```typescript
async function findByWalletAddress(walletAddress: string) {
  // 1. Essayer le cache d'abord
  const cached = participantCacheByWallet.get(walletAddress);
  if (cached) return cached;

  // 2. Fallback DB via GSI (optimisé)
  const result = await dynamodb.query({
    TableName: 'solanashares-logistic',
    IndexName: 'WalletAddressIndex',
    KeyConditionExpression: 'GSI_PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `WALLET#${walletAddress}`
    }
  });

  // 3. Cache le résultat
  if (result.Items?.[0]) {
    const participant = mapToEntity(result.Items[0]);
    participantCacheByWallet.set(walletAddress, participant);
    participantCacheByUser.set(participant.userId, participant);
    return participant;
  }

  return null;
}
```

### Pattern 2: Recherche par Discord user (table principale)
```typescript
async function findByDiscordUser(userId: string) {
  // 1. Essayer le cache d'abord
  const cached = participantCacheByUser.get(userId);
  if (cached) return cached;

  // 2. Fallback DB via table principale (optimisé)
  const result = await dynamodb.query({
    TableName: 'solanashares-logistic',
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'WALLET#'
    }
  });

  // 3. Cache le résultat
  if (result.Items?.[0]) {
    const participant = mapToEntity(result.Items[0]);
    participantCacheByWallet.set(participant.walletAddress, participant);
    participantCacheByUser.set(userId, participant);
    return participant;
  }

  return null;
}
```

### Pattern 3: Statistiques globales (single item read)
```typescript
async function getGlobalStats() {
  // 1. Cache très court (30 secondes) pour les stats
  const cacheAge = Date.now() - globalStatsCacheTimestamp;
  if (globalStatsCache && cacheAge < 30000) {
    return globalStatsCache;
  }

  // 2. Single item read (très rapide)
  const result = await dynamodb.get({
    TableName: 'solanashares-logistic',
    Key: {
      PK: 'GLOBAL#STATS',
      SK: 'GLOBAL#STATS'
    }
  });

  // 3. Cache le résultat
  if (result.Item) {
    globalStatsCache = mapToGlobalStatsEntity(result.Item);
    globalStatsCacheTimestamp = Date.now();
    return globalStatsCache;
  }

  return null;
}
```

### Pattern 4: Mise à jour atomique avec cache
```typescript
async function updateParticipant(participant: ParticipantEntity) {
  // 1. Persist DynamoDB
  await dynamodb.update({
    TableName: 'solanashares-logistic',
    Key: {
      PK: `USER#${participant.userId}`,
      SK: `WALLET#${participant.walletAddress}`
    },
    UpdateExpression: 'SET investedAmount = :amount, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':amount': participant.investedAmount,
      ':updatedAt': participant.updatedAt
    }
  });

  // 2. Update cache immédiatement
  participantCacheByWallet.set(participant.walletAddress, participant);
  participantCacheByUser.set(participant.userId, participant);

  // 3. Invalider le cache des stats globales
  globalStatsCache = null;
}
```

## 🎯 Points critiques pour l'implémentation

1. **OBLIGATOIRE** : Toujours mettre à jour le cache après écriture DB
2. **PERFORMANCE** : Utiliser les GSI pour les requêtes par wallet address
3. **ROBUSTESSE** : Prévoir fallback DB si cache manquant
4. **COÛT** : Éviter les scans, privilégier get/query optimisés
5. **SIMPLICITÉ** : Une seule table, pas de joins, design minimal
6. **ATOMICITÉ** : Mettre à jour les stats globales de manière cohérente

## 🛠️ Commande création table

```bash
aws dynamodb create-table \
  --table-name solanashares-logistic \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI_PK,AttributeType=S \
    AttributeName=GSI_SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    'IndexName=WalletAddressIndex,KeySchema=[{AttributeName=GSI_PK,KeyType=HASH},{AttributeName=GSI_SK,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-3
```

Cette architecture garantit des performances optimales avec des coûts minimaux pour le suivi des participants SolanaShares.