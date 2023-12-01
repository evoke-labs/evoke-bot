# evoke-bot

> A GitHub App built with [Probot](https://github.com/probot/probot) that Bot App for Evoke Github

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t evoke-bot .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> evoke-bot
```

## Contributing

If you have suggestions for how evoke-bot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2023 Hashan Chathuranga
