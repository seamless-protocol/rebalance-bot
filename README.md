# rebalance-bot

A bot that monitors and participates in Leverage Token rebalancing auctions.

## Features

- Monitors leverage tokens for rebalancing auctions
- Participates in auctions when profitable opportunities are found
- Supports multiple leverage tokens simultaneously
- Emits alerts to Slack when important events occur

## Prerequisites

- Node.js
- Docker (optional)
- Foundry (for smart contract development)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/seamless-protocol/rebalance-bot.git
cd rebalance-bot
```

2. Install dependencies:
```bash
npm install
```

3. Install Foundry (if you plan to work with smart contracts):
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

4. Create a `.env` file in the root directory (see .env.example)

## Running the Bot

### Without Docker

1. Build the project:
```bash
npm run build
```

2. Start the bot:
```bash
npm start
```

### With Docker

1. Build the Docker image:
```bash
docker build -t rebalance-bot .
```

2. Run the container:
```bash
docker run -it --env-file .env rebalance-bot
```

## Development

### Available Scripts

- `npm run dev`: Run in development mode with hot-reloading
- `npm run dev:watch`: Run in development mode with file watching
- `npm run build`: Build the project for production
- `npm run start`: Start the production server
- `npm run lint`: Run ESLint to check code quality
- `npm run lint:fix`: Run ESLint and automatically fix issues
- `npm run format`: Check code formatting with Prettier
- `npm run format:fix`: Format code with Prettier
- `npm run type-check`: Run TypeScript type checking

### Development Workflow

1. Start the development server:
```bash
npm run dev
```

2. Make your changes - the server will automatically reload

3. Before committing:
```bash
npm run lint:fix  # Fix linting issues
npm run format:fix  # Format code
npm run type-check  # Check types
```

4. Build for production:
```bash
npm run build
```

## Smart Contract Development

The project uses Foundry for smart contract development. The contracts are located in the `contracts/` directory.

### Foundry Commands

- Build contracts:
```bash
cd contracts
forge build
```

- Run tests:
```bash
forge test
```

- Format Solidity code:
```bash
forge fmt
```

- Generate gas snapshots:
```bash
forge snapshot
```

- Deploy contracts:
```bash
forge script script/DeployRebalancer.s.sol:DeployRebalancer --rpc-url <your_rpc_url> --private-key <your_private_key>
```

For more information about Foundry, see the [official documentation](https://book.getfoundry.sh/).

## Slack Alerts

Slack alerts can be emitted by setting the following environment variables:

- `SLACK_ALERT_CHANNEL_ID`: Slack channel ID that the alerts should be published to
- `SLACK_AUTH_TOKEN`: OAuth token for a Slack App with permissions to write in the channel

See [here](https://api.slack.com/quickstart) for information on setting up a Slack App.
