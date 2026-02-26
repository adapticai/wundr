# @wundr/orchestrator-daemon

WebSocket server and Neolith backend integration for Orchestrator (Virtual Principal) daemons.

## Overview

The Orchestrator Daemon package provides a robust WebSocket server infrastructure for real-time
communication between Orchestrator daemon clients and the Neolith backend. It includes:

- **WebSocket Server** - Production-ready WebSocket server with authentication
- **Connection Management** - Connection lifecycle, authentication, and session tracking
- **Event Routing** - Redis-based pub/sub for event distribution
- **Message Handling** - Protocol-compliant message processing
- **Offline Queueing** - Automatic message queueing when clients are disconnected
- **Connection Recovery** - Built-in reconnection and retry logic
- **Heartbeat Monitoring** - Connection health monitoring and timeout detection

## Features

- JWT-based authentication using Neolith daemon tokens
- Real-time event streaming with selective subscriptions
- Automatic connection recovery and reconnection
- Offline message queueing (up to 1000 events, 7-day retention)
- Heartbeat monitoring with configurable intervals
- Rate limiting and connection quotas
- Comprehensive error handling
- Full TypeScript support with type definitions
- Integration tests with mock Neolith backend

## Installation

```bash
npm install @wundr/orchestrator-daemon
```

## Documentation

- [WebSocket API Protocol](./WEBSOCKET_API.md) - Complete protocol documentation
- [Architecture Guide](./ARCHITECTURE.md) - System design and components
- [Integration Guide](./INTEGRATION.md) - Neolith backend integration
- [Examples](../examples/) - Code examples and recipes

## Quick Start

See [README.md](../README.md) in the package root for quick start guide.

## Support

- Documentation: https://docs.wundr.io/orchestrator-daemon
- Issues: https://github.com/wundr/wundr/issues
- Email: support@wundr.io
