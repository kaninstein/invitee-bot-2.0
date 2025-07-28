# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Start development server with hot reload using nodemon
- `npm start` - Run production build from dist/
- `npm run typecheck` - Check TypeScript types without compilation
- `npm run lint` - Run ESLint on TypeScript files
- `npm test` - Run Jest test suite

### Running the Bot
Development mode (polling): `npm run dev`
Production mode (webhook): Build first, then `npm start` with webhook environment variables

## Architecture Overview

This is a Telegram bot for crypto community access control via Blofin affiliate verification. The bot uses a hybrid Express.js + Telegraf architecture:

### Core Components
- **Entry Point**: `src/index.ts` - Initializes Express server, Telegraf bot, database connections, and health endpoints
- **Bot Logic**: `src/bot/bot.ts` - Bot command handlers, middleware pipeline, and event processing
- **Blofin Integration**: `src/services/blofinService.ts` - API client with HMAC-SHA256 authentication for affiliate verification
- **User Management**: `src/services/userService.ts` - PostgreSQL-backed user registration and access control
- **Middleware Stack**: Rate limiting, authentication, logging, and error handling

### Deployment Modes
- **Development**: Polling mode for local testing
- **Production**: Webhook mode with `/webhook` endpoint

### Database Schema
PostgreSQL with Redis caching. User records track Telegram IDs, Blofin UIDs, verification status, and group access permissions.

### Authentication Flow
1. User starts bot → receives personalized Blofin referral link
2. User registers on Blofin via affiliate link
3. User provides UID → bot verifies via Blofin API
4. Verified users get group access, unverified users are removed

### API Endpoints
- `/health` - Service health checks (database, Redis, Blofin API)
- `/metrics` - System metrics and user statistics
- `/webhook` - Telegram webhook endpoint

### Key Services
- **Blofin API**: Affiliate verification using HMAC-signed requests
- **PostgreSQL**: User data persistence
- **Redis**: Session caching and rate limiting
- **Scheduler**: Cleanup tasks via node-cron

### Environment Configuration
All configuration via environment variables or .env file. Critical variables include Telegram tokens, Blofin API credentials, database URLs, and Redis connection strings.

#### Test Mode Variables
- `NODE_ENV=development` - Automatically disables rate limiting
- `TEST_MODE=true` - Explicitly disable rate limiting for testing
- `DISABLE_RATE_LIMIT=true` - Alternative flag to disable rate limiting

Any of these variables will bypass all rate limiting restrictions, allowing unlimited testing of bot commands.

## Logging and Debugging

### Log System
- **Location**: `logs/` directory (auto-created)
- **Levels**: ERROR, WARN, INFO, DEBUG, TRACE (configurable via LOG_LEVEL env var)
- **File Structure**: Separate files per level + general `app.log`
- **Features**: Automatic rotation (10MB max), colored console output in development

### Debug Commands
- `node test-logging.js` - Test logging system functionality
- View logs: `tail -f logs/app.log` or `tail -f logs/error.log`
- Search errors: `grep "\[ERROR\]" logs/error.log | tail -20`
- Monitor API calls: `grep "BLOFIN_" logs/app.log`

### Log Categories
- `BLOFIN_*`: API requests, authentication, verification
- `TELEGRAM_*`: Bot events, user interactions
- `API_*`: HTTP requests/responses
- `SECURITY`: Authentication issues, rate limiting
- `PERFORMANCE`: Slow operations (>1s)