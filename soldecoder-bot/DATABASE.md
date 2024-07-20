# DynamoDB Discord Bot - Contexte Architecture

## 📋 Spécifications du projet

### Contraintes business
- Bot Discord multi-serveur (max 20 guilds actives prévues)
- 1-5 channels suivis par guild (moyenne 3)
- Budget < 5$/mois, objectif coût proche de 0€
- Side project, pas de haute disponibilité requise
- Région AWS unique, pas de sharding nécessaire

### Données métier
```typescript
// Channel suivi
interface ChannelConfig {
  channelId: string;     // ID Discord unique globalement
  guildId: string;       // ID Discord unique globalement
  image: boolean;
  notifyOnClose: boolean;
  pin: boolean;
  tagType: 'USER' | 'ROLE';
  tagId: number;
  threshold: number;
}

// Settings guild
interface GuildSettings {
  guildId: string;
  timezone: string;
  positionDisplayEnabled: boolean;
  summaryPreferences: {
    dailySummary: boolean;
    weeklySummary: boolean;
    monthlySummary: boolean;
    // + paramètres similaires aux channels
  };
}
```

### Patterns d'accès critiques
1. **onMessageCreate** (99% du trafic) : Récupérer config channel par channelId uniquement
2. **Lister channels d'une guild** (rare, admin) : Query par guildId
3. **CRUD config** (très rare) : Add/update/delete channel ou guild settings

## 🗃️ Architecture DynamoDB retenue

### Table unique : `discord-bot-config`
```
PK (String)              SK (String)              Type (String)      Data
GUILD#{guildId}         SETTINGS                 guild_settings     { timezone, positionDisplayEnabled, ... }
GUILD#{guildId}         CHANNEL#{channelId}      channel_config     { image, notifyOnClose, pin, ... }
```

### GSI : `ChannelIndex`
```
GSI_PK (String)         GSI_SK (String)          Projection
CHANNEL#{channelId}     GUILD#{guildId}          ALL
```

**Justification** : Accès direct O(1) par channelId via GSI, groupement logique par guild via PK.

## 🚀 Stratégie cache mémoire (CRITIQUE)

### Principe fondamental
- **Cache complet en mémoire** au démarrage du bot
- **ZERO requête DynamoDB** sur le trafic normal (onMessageCreate)
- Invalidation cache uniquement lors des modifications via bot

### Structure cache côté application
```typescript
// Cache principal : accès O(1) par channelId
const channelCache = new Map<string, ChannelConfig & { guildId: string }>();

// Cache guild : listage channels par guild
const guildChannelsCache = new Map<string, string[]>();

// Cache settings guild
const guildSettingsCache = new Map<string, GuildSettings>();
```

### Initialisation (1 scan au démarrage)
```typescript
async function initializeCache() {
  const allItems = await dynamodb.scan({ TableName: 'discord-bot-config' }).promise();

  for (const item of allItems.Items) {
    if (item.Type === 'channel_config') {
      const channelId = item.SK.replace('CHANNEL#', '');
      const guildId = item.PK.replace('GUILD#', '');

      channelCache.set(channelId, { guildId, ...item });

      if (!guildChannelsCache.has(guildId)) {
        guildChannelsCache.set(guildId, []);
      }
      guildChannelsCache.get(guildId).push(channelId);
    }

    if (item.Type === 'guild_settings') {
      const guildId = item.PK.replace('GUILD#', '');
      guildSettingsCache.set(guildId, item);
    }
  }
}
```

## ⚡ Patterns d'implémentation

### Pattern 1: onMessageCreate (critique performance)
```typescript
function onMessageCreate(message: DiscordMessage) {
  const channelConfig = channelCache.get(message.channel.id);

  if (!channelConfig) {
    // Channel non suivi, ignore
    return;
  }

  // Traitement avec config (0ms, 0 coût DB)
  processMessage(message, channelConfig);
}
```

### Pattern 2: CRUD avec invalidation cache
```typescript
async function addChannel(guildId: string, channelId: string, config: ChannelConfig) {
  // 1. Persist DynamoDB
  await dynamodb.putItem({
    TableName: 'discord-bot-config',
    Item: {
      PK: `GUILD#${guildId}`,
      SK: `CHANNEL#${channelId}`,
      Type: 'channel_config',
      ...config
    }
  }).promise();

  // 2. Update cache immédiatement
  channelCache.set(channelId, { guildId, ...config });

  if (!guildChannelsCache.has(guildId)) {
    guildChannelsCache.set(guildId, []);
  }
  guildChannelsCache.get(guildId).push(channelId);
}
```

### Pattern 3: Fallback robuste (optionnel)
```typescript
async function getChannelConfigSafe(channelId: string) {
  let config = channelCache.get(channelId);

  if (!config) {
    // Fallback DB si cache défaillant
    const result = await dynamodb.query({
      TableName: 'discord-bot-config',
      IndexName: 'ChannelIndex',
      KeyConditionExpression: 'GSI_PK = :pk',
      ExpressionAttributeValues: { ':pk': `CHANNEL#${channelId}` }
    }).promise();

    if (result.Items.length > 0) {
      config = result.Items[0];
      channelCache.set(channelId, config); // Répare le cache
    }
  }

  return config;
}

## 🎯 Points critiques pour l'implémentation

1. **OBLIGATOIRE** : Toujours mettre à jour le cache après écriture DB
2. **PERFORMANCE** : channelCache.get() doit être O(1) pour onMessageCreate
3. **ROBUSTESSE** : Prévoir robeste gestion d'erreur avec recuperation DB si cache corrompu
4. **COÛT** : Éviter absolument les Query/Scan dans le code métier normal
5. **SIMPLICITÉ** : Une seule table, pas de joins, design minimal
6. **TTL**: Le cache se mettra à jour tout les 30 minutes (à voir) pour avoir un TTL de secours

Cette architecture garantit des coûts négligeables avec des performances optimales pour un bot Discord de cette taille.



graph TD
    A["🎯 Repository.getByGuildId()"] --> B["📁 Cache.getGuildSettings()"]
    B --> C{"🔍 Entry exists?"}
    C -->|No| D["❌ Return null"]
    C -->|Yes| E{"⏰ Expired?"}
    E -->|Yes| F["🗑️ Delete + Return null"]
    E -->|No| G["✅ Return entry.data"]

    D --> H["💾 DB Query"]
    F --> H
    G --> I["🚀 Return to user (0ms)"]

    H --> J["📝 Map to Entity"]
    J --> K["💾 Cache.setGuildSettings()"]
    K --> L["🚀 Return to user (DB + cache)"]

    style G fill:#90EE90
    style I fill:#90EE90
    style H fill:#FFE4B5
    style L fill:#FFE4B5


aws dynamodb create-table \
  --table-name solanashares-config \
  --attribute-definitions \
    AttributeName=PK,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=GSI_PK,AttributeType=S \
    AttributeName=GSI_SK,AttributeType=S \
  --key-schema \
    AttributeName=PK,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes \
    'IndexName=ChannelIndex,KeySchema=[{AttributeName=GSI_PK,KeyType=HASH},{AttributeName=GSI_SK,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
  --billing-mode PAY_PER_REQUEST \
  --region eu-west-3
