# Coding Standards

## TypeScript Standards

- **Strict Mode**: Full TypeScript strict mode enabled
- **Type Safety**: Explicit typing preferred, avoid `any`
- **ES Modules**: Use ES modules with `.js` extensions for local imports
- **Interface Usage**: Use interfaces for data structures

## Code Quality

- **Prettier**: Auto-formatting with project configuration
- **ESLint**: TypeScript ESLint configuration
- **Line Length**: 100 characters maximum
- **Indentation**: 2 spaces
- **Quotes**: Double quotes for strings
- **Semicolons**: Required

## Error Handling

- Comprehensive try-catch blocks with meaningful error messages
- Proper error propagation and logging
- Graceful failure management

## File Naming Conventions

- **Services**: PascalCase with Service suffix (`AIMemoryService.ts`)
- **Models**: PascalCase (`AIMemory.ts`, `WorkflowDefinition.ts`)
- **Tests**: `.unit.test.ts` or `.integration.test.ts` suffix
- **Constants**: camelCase with descriptive names
