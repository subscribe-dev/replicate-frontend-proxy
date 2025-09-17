# Replicate Frontend Proxy

[![CI](https://github.com/USER/replicate-frontend-proxy/actions/workflows/ci.yml/badge.svg)](https://github.com/USER/replicate-frontend-proxy/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/USER/replicate-frontend-proxy/branch/main/graph/badge.svg)](https://codecov.io/gh/USER/replicate-frontend-proxy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AWS Lambda function that serves as a secure proxy for the Replicate API. The proxy allows frontend applications to make requests to Replicate models without exposing API keys in client-side code.

## Features

- 🔒 Secure API key handling (never stored on server)
- 🌐 CORS-enabled for cross-origin requests
- 🚀 Serverless deployment with AWS Lambda
- 🧪 Comprehensive test coverage
- ⚡ Built with Bun for fast performance
- 📊 Automatic test reporting and coverage badges

## Architecture

- **Single Lambda Handler**: `src/proxy.ts` - Contains the main AWS Lambda handler function
- **Endpoints**:
  - `GET /health` - Health check endpoint
  - `GET /api/replicate` - Returns API instructions 
  - `POST /api/replicate` - Main proxy endpoint that forwards requests to Replicate API
  - `OPTIONS /api/replicate` - CORS preflight handling

## Usage

Send a POST request to `/api/replicate` with:

```json
{
  "model": "black-forest-labs/flux-schnell",
  "input": {
    "prompt": "a cute cat wearing a hat",
    "num_outputs": 1
  },
  "apiKey": "your-replicate-api-key"
}
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
