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

### Continuous Integration

The project includes automated testing and deployment workflows:
- Automated test execution and type checking on all pull requests
- Code coverage reporting and badge generation
- Deployment artifact building and validation
- Pull request coverage change reporting

## Deployment

### Quick Deploy

1. Build the project:
   ```bash
   bun run build
   ```

2. Deploy the generated `dist/proxy.js` to AWS Lambda

3. Configure your Lambda function with appropriate environment variables and permissions

### Using as a Package

You can also import this package directly in your own Lambda function:

```typescript
// Your Lambda handler
module.exports = require('@subscribe.dev/replicate-frontend-proxy');
```

### AWS Configuration

Ensure your Lambda function has:
- Node.js 18+ runtime
- Appropriate timeout settings (recommended: 30 seconds)
- Memory allocation based on your model requirements
- Function URL enabled for HTTP access

## Security Model

This proxy is designed with security as a primary concern:

- **No Stored Credentials**: API keys are provided with each request and never persisted on the server
- **Request Validation**: All incoming requests are validated for required fields and proper structure
- **Error Sanitization**: Error responses are logged comprehensively but sanitized before returning to clients
- **CORS Support**: Configured to work with any frontend domain while maintaining security
- **Audit Trail**: All requests and responses are logged for monitoring and debugging

The proxy acts as a security boundary, ensuring that sensitive API credentials never reach client-side code while maintaining full functionality.

## License

MIT License - see LICENSE file for details.
