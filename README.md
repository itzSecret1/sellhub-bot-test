# SellAuth Discord Bot

This Discord bot is designed to help you manage your SellAuth shop directly from Discord. It includes commands for managing products, checking orders, and other administrative functions for your SellAuth store.

## Getting Started

To get started with the bot, clone the repository and create a `.env` file by copying `.env.example`:

`cp .env.example .env`

Then fill in the variables as shown below:

- `BOT_TOKEN:` Your Discord bot token, which authenticates the bot with Discord.
- `BOT_GUILD_ID:` The ID of the Discord server (guild) where the bot will operate.
- `BOT_USER_ID_WHITELIST:` A comma-separated list of user IDs allowed to use restricted commands (commands with the `onlyWhitelist: true` property). This restriction currently applies to all commands except "help", "ping", and "stats".
- `BOT_CUSTOMER_ROLE_ID:` The ID of the Discord role that will be assigned to customers who use the `claim` command.
- `SA_API_KEY:` Your SellAuth API key, available at your SellAuth dashboard under [Account -> API Access](https://dash.sellauth.com/api). If it’s not visible, click "Regenerate".
- `SA_SHOP_ID:` Your SellAuth shop ID, available at your SellAuth dashboard under [Account -> API Access](https://dash.sellauth.com/api).

## Installation

Make sure you have Node.js installed, then install the required packages:

`npm install`

Running the Bot

To start the bot, run:

`node index.js`

## Development Guidelines

### Contributions
We welcome contributions of new commands or features! Please ensure that any changes maintain code quality and respect the basic structure of the bot.

### Formatting
Before committing, run `npm run format` to auto-format the code.

## Community & Support

For help, inquiries, or to join the community, visit the [SellAuth Discord server](https://discord.sellauth.com).

Happy coding!

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
