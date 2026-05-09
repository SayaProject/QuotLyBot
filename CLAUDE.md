# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Running the Bot
- **Start**: `npm start` (runs `node railway-start.js`)
- **Collector only**: `npm run start:collector`
- **Worker only**: `npm run start:worker`
- **PM2 Production**: `pm2 start ecosystem.config.js` (cluster mode with health checker)
- **Docker**: `docker compose --profile dev up -d` (requires quote-api setup)

### Code Quality
- **Lint**: `npx eslint .` (ESLint with Standard config)
- **Test**: `npm test`

### Process Management
- **Health Check**: Bot runs health endpoint on port configured in environment
- **Monitoring**: Uses PM2 ecosystem config with auto-restart and memory limits

## Architecture Overview

### Cluster Architecture
The bot uses Node.js cluster mode with a master-worker pattern:

- **Collector Process** (`updates-collector.js`): Receives Telegram updates, assigns queues, and owns TDLib operations
- **Worker Processes** (`updates-worker.js`): Process queued Telegram updates
- **Railway Starter** (`railway-start.js`): Runs one collector, configurable workers, and `/health`

### Key Components

#### Bot Framework
- **Telegraf**: Main bot framework with middleware-based architecture
- **TDLib Integration**: Uses `helpers/tdlib/` for advanced Telegram features
- **Internationalization**: Multi-language support via `locales/` directory

#### Quote Generation System
- **Quote API**: External service for generating quote images (quote-api repo)
- **Sticker Management**: Dynamic sticker pack creation and cleanup

#### Database Layer
- **MongoDB**: Uses Mongoose for data modeling
- **Models**: User, Group, GroupMember, Quote, Counter, and Stats models
- **Caching**: In-memory caching for privacy settings and forward lookups

#### Message Processing
- **Handler System**: Modular handlers in `handlers/` directory
- **Middleware**: Rate limiting, stats collection, session management
- **Update Distribution**: Consistent hashing for worker assignment

### Core Features

#### Quote Generation
- **Multi-format**: Supports WebP stickers, PNG images, and documents
- **Customization**: Background colors, emoji brands, scaling options
- **Privacy**: Configurable privacy settings for user anonymization

#### Bot Management
- **Health Monitoring**: Circuit breaker pattern for TDLib operations
- **Adaptive Scaling**: Dynamic worker count based on CPU and queue load
- **Rate Limiting**: Per-user and per-chat rate limiting
- **Error Handling**: Comprehensive error handling with user-friendly messages

#### Advanced Features
- **Business API**: Support for Telegram Business connections
- **Inline Queries**: Inline bot functionality
- **Statistics**: Usage tracking and analytics

## Configuration

### Environment Variables
- `BOT_TOKEN`: Telegram bot token
- `MONGODB_URI`: MongoDB connection string
- `REDIS_URL`: Redis connection string
- `QUOTE_API_URI`: Quote generation API endpoint
- `TELEGRAM_API_ID`: Telegram API ID for TDLib
- `TELEGRAM_API_HASH`: Telegram API hash for TDLib
- `MAX_WORKERS`: Number of worker processes
- `WORKER_HANDLER_TIMEOUT`: Timeout for worker operations

### Database
- MongoDB connection configured in `database/connection.js`
- Models defined in `database/models/`

### TDLib Setup
- Requires TDLib binary at `helpers/tdlib/data/libtdjson.so`
- Can use prebuilt-tdlib npm package or manual compilation

## Development Notes

### Adding New Features
- Handlers go in `handlers/` directory
- Database models in `database/models/`
- Middleware in `middlewares/`
- Utilities in `utils/`

### Message Flow
1. Update received by master process
2. Distributed to worker based on user/chat ID hash
3. Worker processes update through handler middleware chain
4. Database operations handled asynchronously

### Performance Considerations
- Uses cluster mode for horizontal scaling
- Queue management prevents memory overflow
- Caching reduces database queries
- Circuit breaker prevents TDLib cascade failures

### Removed Optional Integrations

This Railway-ready fork does not include the optional AI, ads/payments, or FSTIK publisher integrations.
