# 🤖 SolanaShares Discord Bot

A high-performance Discord bot for tracking Solana positions with real-time notifications, built with TypeScript and AWS DynamoDB.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-14.17.0-blue.svg)](https://discord.js.org/)
[![AWS DynamoDB](https://img.shields.io/badge/AWS-DynamoDB-orange.svg)](https://aws.amazon.com/dynamodb/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ Features

- **Real-time Solana Position Tracking** - Monitor positions across multiple Discord channels
- **Multi-Guild Support** - Manage up to 20 Discord servers simultaneously
- **Smart Notifications** - Configurable alerts for position opens, closes, and updates
- **Performance Optimized** - In-memory caching for sub-millisecond response times
- **Clean Architecture** - Domain-driven design with clear separation of concerns
- **AWS Serverless Ready** - Built for cloud deployment with DynamoDB integration

## 📋 Table of Contents

- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Database Setup](#-database-setup)
- [Usage](#-usage)
- [Development](#-development)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## 🏗️ Architecture

This project follows **Clean Architecture** principles with a clear separation of concerns:

```
src/
├── domain/           # Business entities and interfaces
├── application/      # Use cases and business logic
├── infrastructure/   # External services (Discord, DynamoDB)
├── presentation/     # Discord interaction handlers
├── helpers/          # Utility functions and shared code
└── schemas/          # Data validation schemas
```

### Database Design

The bot uses **AWS DynamoDB** with a single-table design optimized for Discord bot workloads:

- **Primary Table**: `discord-bot-config`
- **Access Patterns**: O(1) channel lookups via Global Secondary Index
- **Cost Optimization**: Pay-per-request billing with in-memory caching
- **Scalability**: Supports up to 20 guilds with 1-5 channels each

## 📋 Prerequisites

### Required Software

- **Node.js** 22.13.0
- **npm** 11.0.0 or higher
- **TypeScript** 5.2.2
- **AWS CLI** (for database setup)

### System Requirements

- **RAM**: Minimum 512MB, Recommended 1GB+
- **Storage**: 100MB+ for dependencies
- **Network**: Stable internet connection for Discord API and AWS services

### AWS Account

- **AWS Account** with DynamoDB access
- **IAM User** with DynamoDB permissions
- **AWS Region** configured (default: eu-west-3)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/RedBoardDev/SolanaShares
cd soldecoder-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```bash
cp .env.example .env
# or create manually
```

Configure your environment variables following .env.example

### 4. Database Setup TODO update to the reality

#### Option A: AWS CLI (Recommended)

```bash
# Create DynamoDB table
aws dynamodb create-table \
  --table-name discord-bot-config \
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
```

#### Option B: Use JSON Template

```bash
# TODO not update
aws dynamodb create-table --cli-input-json file://create-dynamodb-table.json
```

## ⚙️ Configuration

### Discord Bot Setup

1. **Create Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Navigate to "Bot" section
   - Copy the bot token

2. **Bot Permissions**
   - Enable required Gateway Intents
   - Set bot permissions for your server (permission integer: 2147609600)
   - Invite bot to your Discord server

3. **Environment Variables**
   - Set `DISCORD_TOKEN` with your bot token
   - Set `DISCORD_ADMIN_USER_ID` with your admin user ID

### AWS Configuration

1. **IAM User Setup**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "dynamodb:GetItem",
           "dynamodb:PutItem",
           "dynamodb:UpdateItem",
           "dynamodb:DeleteItem",
           "dynamodb:Query",
           "dynamodb:Scan"
         ],
         "Resource": "arn:aws:dynamodb:eu-west-3:*:table/discord-bot-config"
       }
     ]
   }
   ```

2. **AWS CLI Configuration**
   ```bash
   aws configure
   # Enter your Access Key ID, Secret Access Key, and Region
   ```

## 🎯 Usage

### Development Mode

```bash
# Start development server with hot reload
npm run dev
```

### Production Mode

```bash
# Using PM2 (recommended for production)
npm run pm2:start
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
```

## 🛠️ Development

### Code Quality

This project uses **Biome** for linting and formatting:

```bash
# Check formatting
npm run format:check

# Fix formatting
npm run format:fix

# Check linting
npm run lint:check

# Fix linting issues
npm run lint:fix
```

### TypeScript Configuration

- **Target**: ES2022
- **Module**: ESNext
- **Strict Mode**: Enabled
- **Path Mapping**: Configured for clean imports
- **Module Resolution**: Node.js

### Project Structure

```
src/
├── domain/           # Business logic and entities
│   ├── entities/     # Domain entities
│   └── interfaces/   # Repository and service interfaces
├── application/      # Application use cases
│   └── use-cases/    # Business logic implementation
├── infrastructure/   # External integrations
│   ├── repositories/ # Data access layer
│   └── services/     # External service clients
├── presentation/     # Discord interaction handling
│   └── handlers/     # Command and interaction handlers
├── helpers/          # Utility functions
├── schemas/          # Data validation
└── index.ts          # Application entry point
```

### Adding New Features

1. **Domain Layer**: Define entities and interfaces
2. **Application Layer**: Implement use cases
3. **Infrastructure Layer**: Create data access implementations
4. **Presentation Layer**: Add Discord interaction handlers
5. **Update schemas** for data validation

## 🚀 Deployment

### PM2 Production Deployment

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
npm run pm2:start

# Monitor logs
npm run pm2:logs

# Restart application
npm run pm2:restart

# Stop application
npm run pm2:stop
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

### 1. Fork the Repository

```bash
git clone https://github.com/RedBoardDev/SolanaShares
cd soldecoder-bot
```

### 2. Create Feature Branch

```bash
git checkout -b feature/amazing-feature
```

### 3. Make Changes

- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed

### 4. Run Quality Checks

```bash
npm run check:all
npm run typescript:check
```

### 5. Commit and Push

```bash
git add .
git commit -m "feat: add amazing feature"
git push origin feature/amazing-feature
```

### 6. Create Pull Request

- Provide clear description of changes
- Include any relevant issue numbers
- Ensure all checks pass

### Code Style Guidelines

- Use **TypeScript** with strict mode
- Follow **Clean Architecture** principles
- Use **Biome** for formatting and linting
- Write **descriptive commit messages**
- Include **JSDoc comments**, only if needed

## 📊 Performance & Monitoring

### Caching Strategy

- **In-Memory Cache**: All channel configurations cached at startup
- **Zero Database Queries**: Normal operation uses cache only
- **Cache Invalidation**: Automatic updates on configuration changes
- **Fallback Recovery**: Database fallback if cache corruption detected

### Monitoring

```bash
# View application logs
npm run pm2:logs

# Check application status
pm2 status

# Monitor resource usage
pm2 monit
```
### Debug Mode

```bash

# Enable debug logging // TODO TO IMPLEMENT
LOG_LEVEL=debug npm run dev

# Check TypeScript compilation
npm run typescript:check
```

## 📚 Additional Resources

- [Discord.js Documentation](https://discord.js.org/)
- [AWS DynamoDB Developer Guide](https://docs.aws.amazon.com/amazondynamodb/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Clean Architecture Principles](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
