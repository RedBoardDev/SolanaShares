# Multi-stage build pour optimiser la taille
FROM node:20-alpine AS builder

# Installer les dépendances système nécessaires
RUN apk add --no-cache python3 make g++

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production && npm cache clean --force

# Copier le code source
COPY . .

# Compiler TypeScript
RUN npm run build

# Stage de production
FROM node:20-alpine AS production

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

# Installer SQLite
RUN apk add --no-cache sqlite

# Définir le répertoire de travail
WORKDIR /app

# Copier les dépendances depuis le stage builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Créer le répertoire pour la base de données
RUN mkdir -p /app/data && chown -R botuser:nodejs /app

# Changer vers l'utilisateur non-root
USER botuser

# Exposer le port (si besoin pour monitoring)
EXPOSE 3000

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/pool.db

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Bot is running')" || exit 1

# Commande de démarrage
CMD ["node", "dist/index.js"]