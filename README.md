# SellAuth Discord Bot

A Discord bot for managing SellAuth e-commerce shops with product variants, stock management, and role-based access control.

## Features
- Slash command system with role-based permissions
- Product and variant management
- Stock management (/replace, /unreplace, /add-stock, /delete-stock)
- Invoice viewing and processing
- Coupon management
- Automatic SellAuth synchronization

## Setup

### 1. Environment Variables
Copy `.env.example` to `.env` and fill in your values:
```
BOT_TOKEN=your_discord_bot_token
BOT_GUILD_ID=your_guild_id
BOT_ADMIN_ROLE_ID=1440390894430982224
BOT_STAFF_ROLE_ID=1440390892900061336
BOT_CUSTOMER_ROLE_ID=your_customer_role_id
BOT_USER_ID_WHITELIST=user_ids_comma_separated
SA_API_KEY=your_sellauth_api_key
SA_SHOP_ID=112723
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Bot
```bash
npm start
```

## Deployment on Railway

1. Go to [Railway.app](https://railway.app)
2. Create new project → GitHub Repository → select `sell-auth-bot-test`
3. Add environment variables in Railway:
   - BOT_TOKEN
   - BOT_GUILD_ID
   - BOT_ADMIN_ROLE_ID
   - BOT_STAFF_ROLE_ID
   - BOT_CUSTOMER_ROLE_ID
   - BOT_USER_ID_WHITELIST
   - SA_API_KEY
   - SA_SHOP_ID
4. Click Deploy

Your bot will run 24/7 on Railway!

## Role Permissions

- **Owner (BOT_ADMIN_ROLE_ID)**: Full access to all commands
- **Staff (BOT_STAFF_ROLE_ID)**: Limited access (/help, /replace, /unreplace, /invoice-view)

## Architecture

The bot uses:
- **Discord.js v14** for Discord API integration
- **SellAuth REST API** for shop management
- **Automatic variant sync** every second
- **GitHub auto-sync** for continuous code updates
