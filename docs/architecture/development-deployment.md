# Development & Deployment

## Build System

- **TypeScript Compilation**: ES modules with .js extensions
- **Automated Testing**: Vitest with coverage reporting
- **Code Quality**: ESLint + Prettier integration
- **Dependency Management**: npm with lock files

## Testing Strategy

- **Unit Testing**: Individual component testing
- **Integration Testing**: Cross-service validation
- **Coverage Targets**: 90% functions, 85% lines
- **Mock Strategy**: External dependency isolation

## Deployment Architecture

- **CLI Distribution**: npm package deployment
- **Environment Configuration**: dotenv-based settings
- **Process Management**: PM2/systemd compatibility
- **Monitoring**: Structured logging and metrics
