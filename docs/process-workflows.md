# Process Management Workflows

This guide demonstrates how to use Permamind's integrated process management tools for complete AO process lifecycle management.

## Overview

Permamind provides four complementary tools that work together to enable comprehensive AO process workflows:

1. **CreateProcessCommand** - Spawn new AO processes
2. **EvalProcessCommand** - Execute Lua code within processes
3. **ExecuteActionCommand** - Communicate with processes via natural language
4. **QueryAOProcessMessagesCommand** - Query process message history

## Complete Process Lifecycle

### 1. Process Creation

Start by creating a new AO process:

```typescript
// Create a new AO process
const createResult = await createProcessTool.execute({});
const processId = JSON.parse(createResult).processId;
```

The CreateProcessCommand spawns a fresh AO process with:

- 3-second initialization delay for proper setup
- Default AOS module configuration
- Access to embedded templates (token, DAO, etc.)

### 2. Code Evaluation & Setup

Once created, use EvalProcessCommand to initialize your process:

```typescript
// Initialize process with handlers
const setupCode = `
-- Initialize process state
local State = {
  name = "MyProcess",
  version = "1.0.0",
  counter = 0
}

-- Add a ping handler
Handlers.add(
  "ping",
  Handlers.utils.hasMatchingTag("Action", "Ping"),
  function(msg)
    State.counter = State.counter + 1
    return {
      Output = json.encode({
        message = "Pong!",
        counter = State.counter,
        timestamp = msg.Timestamp
      })
    }
  end
)

-- Add an info handler
Handlers.add(
  "info",
  Handlers.utils.hasMatchingTag("Action", "Info"),
  function(msg)
    return {
      Output = json.encode(State)
    }
  end
)
`;

const evalResult = await evalProcessTool.execute({
  processId: processId,
  code: setupCode,
});
```

### 3. Natural Language Communication

Communicate with your process using ExecuteActionCommand:

```typescript
// Define process documentation in markdown
const processMarkdown = `
# MyProcess Documentation

## Overview
A simple demonstration process with ping and info handlers.

## Available Actions

### Ping
- **Action**: Ping
- **Description**: Returns "Pong!" and increments counter
- **Example**: Send a ping message to test the process

### Info
- **Action**: Info
- **Description**: Returns current process state
- **Example**: Get process information and current counter value
`;

// Send natural language requests
const pingResult = await executeActionTool.execute({
  processId: processId,
  request: "Send a ping message to test the process",
  processMarkdown: processMarkdown,
});

const infoResult = await executeActionTool.execute({
  processId: processId,
  request: "Get the current process state and counter value",
  processMarkdown: processMarkdown,
});
```

### 4. Message History & Monitoring

Query process communications using QueryAOProcessMessagesCommand:

```typescript
// Get recent messages
const recentMessages = await queryMessagesTool.execute({
  processId: processId,
  first: 10,
  sort: "INGESTED_AT_DESC",
});

// Query specific action types
const pingMessages = await queryMessagesTool.execute({
  processId: processId,
  action: "Ping",
  first: 5,
});

// Get messages within a time range
const fromMessages = await queryMessagesTool.execute({
  fromProcessId: processId,
  first: 20,
});
```

## Integration Patterns

### With Memory Tools

Combine process management with Permamind's memory system:

```typescript
// Store process creation in memory
await addMemoryTool.execute({
  content: `Created AO process ${processId} with ping/info handlers`,
  memoryType: "procedure",
  importance: 0.8,
  context: {
    processId: processId,
    processType: "custom",
    handlers: ["ping", "info"],
  },
});

// Search for process-related memories
const processMemories = await searchMemoriesTool.execute({
  query: "AO process creation",
  memoryTypes: ["procedure"],
  limit: 10,
});
```

### With Token Tools

Create and manage token processes:

```typescript
// Create a token process using embedded template
const tokenResult = await createProcessTool.execute({
  // Uses embedded token template automatically
});

// Initialize token with specific parameters
const tokenSetup = `
-- Configure token parameters
Token = {
  Name = "MyToken",
  Ticker = "MTK",
  Denomination = 12,
  TotalSupply = 1000000 * (10 ^ 12),
  Owner = ao.id
}
`;

await evalProcessTool.execute({
  processId: JSON.parse(tokenResult).processId,
  code: tokenSetup,
});
```

### BMAD Workflow Integration

Process tools work seamlessly within BMAD automation:

```typescript
// BMAD task example for automated process deployment
const bmadWorkflow = `
# Deploy Process Workflow

## Steps
1. Create new AO process
2. Evaluate initialization code
3. Test process functionality
4. Store deployment information

## Implementation
- Use CreateProcessCommand for process spawning
- Use EvalProcessCommand for setup and testing
- Use ExecuteActionCommand for functionality validation
- Use memory tools for deployment tracking
`;

// Execute within BMAD context
await bmadTaskTool.execute({
  taskId: "deploy-process",
  parameters: {
    processType: "custom",
    testingRequired: true,
  },
});
```

## Advanced Workflows

### Concurrent Process Management

Handle multiple processes simultaneously:

```typescript
// Create multiple processes concurrently
const createPromises = [
  createProcessTool.execute({}),
  createProcessTool.execute({}),
  createProcessTool.execute({}),
];

const createResults = await Promise.all(createPromises);
const processIds = createResults.map((result) => JSON.parse(result).processId);

// Evaluate different code on each process
const evalPromises = processIds.map((id, index) =>
  evalProcessTool.execute({
    processId: id,
    code: `local processIndex = ${index}; return processIndex`,
  }),
);

await Promise.all(evalPromises);
```

### Error Handling & Recovery

Implement robust error handling:

```typescript
try {
  // Attempt process creation
  const createResult = await createProcessTool.execute({});
  const processId = JSON.parse(createResult).processId;

  // Validate process is responding
  const testResult = await evalProcessTool.execute({
    processId: processId,
    code: "return 'Process is alive'",
  });

  if (!JSON.parse(testResult).success) {
    throw new Error("Process not responding");
  }
} catch (error) {
  // Log error and attempt recovery
  await addMemoryTool.execute({
    content: `Process creation failed: ${error.message}`,
    memoryType: "reasoning",
    importance: 0.9,
    context: { error: true, operation: "process_creation" },
  });

  // Retry with different configuration
  // ... recovery logic
}
```

### Performance Monitoring

Monitor process performance and health:

```typescript
// Performance testing workflow
const performanceTest = async (processId: string) => {
  const startTime = Date.now();

  // Send multiple ping requests
  const pingPromises = Array.from({ length: 10 }, () =>
    executeActionTool.execute({
      processId: processId,
      request: "Send a ping message",
      processMarkdown: processMarkdown,
    }),
  );

  const results = await Promise.all(pingPromises);
  const endTime = Date.now();

  const successCount = results.filter(
    (result) => JSON.parse(result).success,
  ).length;

  return {
    totalTime: endTime - startTime,
    successRate: successCount / results.length,
    averageResponseTime: (endTime - startTime) / results.length,
  };
};

// Run performance test
const perfStats = await performanceTest(processId);

// Store performance data
await addMemoryTool.execute({
  content: `Process performance: ${perfStats.successRate * 100}% success rate, ${perfStats.averageResponseTime}ms avg response time`,
  memoryType: "performance",
  importance: 0.7,
  context: {
    processId: processId,
    metrics: perfStats,
  },
});
```

## Best Practices

### 1. Process Documentation

Always maintain clear process documentation:

```markdown
# Process Documentation Template

## Overview

Brief description of process purpose and functionality

## Handlers

List all available message handlers with:

- Action tags they respond to
- Expected parameters
- Response format
- Usage examples

## State Schema

Document the process state structure

## Integration Notes

How this process integrates with other systems
```

### 2. Testing Strategy

Implement comprehensive process testing:

```typescript
// Test suite for process validation
const testProcess = async (processId: string) => {
  const tests = [
    {
      name: "Ping Handler",
      action: "Send a ping message",
      expected: "Pong!",
    },
    {
      name: "Info Handler",
      action: "Get process information",
      expected: "version",
    },
  ];

  for (const test of tests) {
    const result = await executeActionTool.execute({
      processId: processId,
      request: test.action,
      processMarkdown: processMarkdown,
    });

    const response = JSON.parse(result);
    if (!response.success || !response.output.includes(test.expected)) {
      throw new Error(`Test failed: ${test.name}`);
    }
  }
};
```

### 3. State Management

Manage process state effectively:

```typescript
// State backup and restore
const backupState = `
-- Backup current state
local backup = json.encode(State)
Send({
  Target = ao.id,
  Action = "State-Backup",
  Data = backup
})
`;

await evalProcessTool.execute({
  processId: processId,
  code: backupState,
});
```

## Conclusion

Permamind's integrated process management tools provide a complete solution for AO process lifecycle management. By combining process creation, code evaluation, natural language communication, and message monitoring, you can build sophisticated AO applications with ease.

The tools work seamlessly together and integrate with Permamind's memory system, token tools, and BMAD workflow automation to provide a comprehensive development experience.
