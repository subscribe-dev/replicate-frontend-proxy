# Replicate Frontend Proxy

[![CI](https://github.com/subscribe-dev/replicate-frontend-proxy/actions/workflows/ci.yml/badge.svg)](https://github.com/USER/replicate-frontend-proxy/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/subscribe-dev/replicate-frontend-proxy/branch/main/graph/badge.svg)](https://codecov.io/gh/USER/replicate-frontend-proxy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A secure, serverless proxy service that enables frontend applications to safely interact with Replicate AI models without exposing API credentials in client-side code.

## Overview

This package provides a ready-to-deploy AWS Lambda function that acts as an intermediary between your frontend applications and the Replicate API. By routing requests through this proxy, you can integrate AI models into your web applications while maintaining security best practices and keeping sensitive API keys on the server side.

The proxy is designed for easy deployment and requires minimal configuration, making it simple to add AI capabilities to any frontend project.

## Key Features

- **Secure API Key Management**: API keys are provided per-request and never stored on the server
- **Cross-Origin Support**: CORS-enabled to work with any frontend domain
- **Serverless Architecture**: Deploys as an AWS Lambda function for automatic scaling and cost efficiency
- **Production Ready**: Comprehensive error handling, logging, and test coverage
- **High Performance**: Built with Bun runtime for optimal speed
- **Open Source**: MIT licensed with full source code available

## How It Works

The proxy provides a simple HTTP API that forwards requests to Replicate while maintaining security:

1. Your frontend sends a request to the proxy with the model name, input parameters, and API key
2. The proxy validates the request and forwards it to the appropriate Replicate model endpoint
3. Replicate processes the request and returns the result
4. The proxy returns the result to your frontend application

### API Endpoints

- `POST /api/replicate` - Main proxy endpoint for model predictions
- `GET /api/replicate` - Returns usage instructions
- `GET /health` - Service health check
- `OPTIONS /api/replicate` - CORS preflight support

## Usage Example

Send a POST request to your deployed proxy endpoint:

```javascript
const response = await fetch('https://your-lambda-url.amazonaws.com/api/replicate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'black-forest-labs/flux-schnell',
    input: {
      prompt: 'a professional headshot of a person',
      num_outputs: 1
    },
    apiKey: 'your-replicate-api-key'
  })
});

const result = await response.json();
console.log(result);
```

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0

### Setup

```bash
bun install
```

### Scripts

- `bun run test` - Run tests with coverage
- `bun run test:ci` - Run tests with CI reporting (JUnit + LCOV)
- `bun run typecheck` - Type check TypeScript
- `bun run build` - Build for AWS Lambda deployment
- `bun run dev` - Run locally
- `bun run clean` - Clean build and coverage directories

### Testing

The project includes comprehensive tests with:
- Unit tests for all endpoints
- Mock Replicate API responses
- Error handling scenarios
- CORS validation
- Coverage reporting

### CI/CD

GitHub Actions automatically:
- ✅ Runs tests and type checking
- 📊 Generates test reports and coverage
- 🏗️ Builds deployment artifacts
- 📈 Updates coverage badges
- 💬 Comments PR coverage changes

## Deployment

The built CommonJS output will be in `dist/proxy.js`, ready for AWS Lambda deployment.

Host a lambda with content something like:

```typescript
// Entire lambda code for a simple proxy to the replicate-frontend-proxy:
module.exports = require('@subscribe.dev/replicate-frontend-proxy');
```

## Security

- API keys are passed in request body and never stored
- CORS enabled with wildcard origin for frontend flexibility
- Comprehensive error logging without exposing sensitive data
- Request validation for required fields

## License

MIT License - see LICENSE file for details.
