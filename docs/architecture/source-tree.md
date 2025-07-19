# Source Tree Structure

## Project Structure

```
src/
├── services/          # Core business logic services
├── models/           # Data models and TypeScript interfaces
├── tools/            # MCP tool implementations
│   ├── bmad/         # BMAD methodology tools
│   ├── memory/       # Memory management tools
│   ├── process/      # AO process tools
│   ├── token/        # Token operation tools
│   ├── contact/      # Contact management tools
│   ├── documentation/# Documentation tools
│   └── user/         # User tools
├── types/            # Type definitions
├── constants.ts      # Configuration constants
├── process.ts        # AO process creation and messaging
├── relay.ts          # Arweave data relay functions
└── server.ts         # Main MCP server implementation
```

## Tool Organization

Each tool category follows the factory pattern:
- `ToolFactory.ts` - Factory class for tool registration
- `commands/` - Individual command implementations  
- `index.ts` - Exports for the tool category

## Service Layer

Services provide business logic abstraction:
- AI Memory operations
- Process communication
- Documentation management
- Resource loading and caching