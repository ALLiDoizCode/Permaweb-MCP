# AO Development Patterns and Best Practices

## Overview

This document provides comprehensive guidance for AO (Autonomous Objects) Lua development, including architectural patterns, handler structures, security considerations, and testing approaches. These patterns are designed for use by BMad AO development specialists and the broader Permaweb development community.

## Core AO Architecture Patterns

### Process Lifecycle Pattern

```lua
-- Standard AO process initialization pattern
local process = {
  _version = "1.0.0",
  _name = "Process Name",
  _description = "Process functionality description",
  _initialized = false
}

-- Initialization handler
Handlers.add(
  "Initialize",
  Handlers.utils.hasMatchingTag("Action", "Initialize"),
  function(msg)
    if not process._initialized then
      -- Initialize state variables
      process._initialized = true
      ao.send({
        Target = msg.From,
        Action = "InitializeResponse",
        Data = json.encode({ status = "initialized", version = process._version })
      })
    end
  end
)
```

### Handler Registration Pattern

```lua
-- Proper handler registration with validation
Handlers.add(
  "HandlerName",
  function(msg)
    -- Pattern matching logic
    return Handlers.utils.hasMatchingTag("Action", "ActionName")(msg)
  end,
  function(msg)
    -- Input validation
    if not msg.Data or msg.Data == "" then
      ao.send({
        Target = msg.From,
        Action = "Error",
        Data = json.encode({ error = "Missing required data" })
      })
      return
    end

    -- Handler logic
    local success, result = pcall(function()
      -- Safe execution block
      return processAction(msg)
    end)

    if success then
      -- Success response
      ao.send({
        Target = msg.From,
        Action = "ActionResponse",
        Data = json.encode(result)
      })
    else
      -- Error handling
      ao.send({
        Target = msg.From,
        Action = "Error",
        Data = json.encode({ error = "Handler execution failed" })
      })
    end
  end
)
```

## Token Contract Patterns

### Standard Token Implementation

```lua
-- Token state management
local TokenState = {
  Name = "",
  Ticker = "",
  Logo = "",
  Denomination = 12,
  TotalSupply = "0",
  Balances = {},
  Allowances = {}
}

-- Balance handler with validation
Handlers.add(
  "Balance",
  Handlers.utils.hasMatchingTag("Action", "Balance"),
  function(msg)
    local target = msg.Tags.Target or msg.From
    local balance = TokenState.Balances[target] or "0"

    ao.send({
      Target = msg.From,
      Action = "BalanceResponse",
      Data = json.encode({
        target = target,
        balance = balance,
        ticker = TokenState.Ticker
      })
    })
  end
)

-- Transfer handler with comprehensive validation
Handlers.add(
  "Transfer",
  Handlers.utils.hasMatchingTag("Action", "Transfer"),
  function(msg)
    -- Input validation
    local recipient = msg.Tags.Recipient
    local quantity = msg.Tags.Quantity

    if not recipient or not quantity then
      ao.send({
        Target = msg.From,
        Action = "TransferError",
        Data = json.encode({ error = "Missing recipient or quantity" })
      })
      return
    end

    -- Balance validation
    local senderBalance = TokenState.Balances[msg.From] or "0"
    if tonumber(senderBalance) < tonumber(quantity) then
      ao.send({
        Target = msg.From,
        Action = "TransferError",
        Data = json.encode({ error = "Insufficient balance" })
      })
      return
    end

    -- Execute transfer
    TokenState.Balances[msg.From] = tostring(tonumber(senderBalance) - tonumber(quantity))
    TokenState.Balances[recipient] = tostring((tonumber(TokenState.Balances[recipient]) or 0) + tonumber(quantity))

    -- Success notifications
    ao.send({
      Target = msg.From,
      Action = "TransferSuccess",
      Data = json.encode({
        from = msg.From,
        to = recipient,
        quantity = quantity
      })
    })

    ao.send({
      Target = recipient,
      Action = "TransferNotification",
      Data = json.encode({
        from = msg.From,
        quantity = quantity
      })
    })
  end
)
```

### Minting and Supply Management

```lua
-- Mint handler with admin validation
Handlers.add(
  "Mint",
  Handlers.utils.hasMatchingTag("Action", "Mint"),
  function(msg)
    -- Admin validation
    if msg.From ~= TokenState.Owner then
      ao.send({
        Target = msg.From,
        Action = "MintError",
        Data = json.encode({ error = "Unauthorized: Only owner can mint" })
      })
      return
    end

    local recipient = msg.Tags.Recipient or msg.From
    local quantity = msg.Tags.Quantity

    -- Quantity validation
    if not quantity or tonumber(quantity) <= 0 then
      ao.send({
        Target = msg.From,
        Action = "MintError",
        Data = json.encode({ error = "Invalid quantity" })
      })
      return
    end

    -- Update balances and supply
    TokenState.Balances[recipient] = tostring((tonumber(TokenState.Balances[recipient]) or 0) + tonumber(quantity))
    TokenState.TotalSupply = tostring(tonumber(TokenState.TotalSupply) + tonumber(quantity))

    ao.send({
      Target = msg.From,
      Action = "MintSuccess",
      Data = json.encode({
        recipient = recipient,
        quantity = quantity,
        newSupply = TokenState.TotalSupply
      })
    })
  end
)
```

## DAO Voting Patterns

### Proposal Management

```lua
-- DAO state management
local DAOState = {
  Name = "",
  Members = {},
  Proposals = {},
  ProposalCount = 0,
  VotingPeriod = 7 * 24 * 60 * 60 * 1000, -- 7 days in milliseconds
  QuorumThreshold = 0.5 -- 50% quorum requirement
}

-- Create proposal handler
Handlers.add(
  "CreateProposal",
  Handlers.utils.hasMatchingTag("Action", "CreateProposal"),
  function(msg)
    -- Member validation
    if not DAOState.Members[msg.From] then
      ao.send({
        Target = msg.From,
        Action = "ProposalError",
        Data = json.encode({ error = "Only DAO members can create proposals" })
      })
      return
    end

    local title = msg.Tags.Title
    local description = msg.Data

    if not title or not description then
      ao.send({
        Target = msg.From,
        Action = "ProposalError",
        Data = json.encode({ error = "Missing proposal title or description" })
      })
      return
    end

    -- Create proposal
    DAOState.ProposalCount = DAOState.ProposalCount + 1
    local proposalId = tostring(DAOState.ProposalCount)

    DAOState.Proposals[proposalId] = {
      id = proposalId,
      title = title,
      description = description,
      proposer = msg.From,
      created = msg.Timestamp,
      expires = msg.Timestamp + DAOState.VotingPeriod,
      votes = {
        yes = 0,
        no = 0,
        voters = {}
      },
      status = "active"
    }

    ao.send({
      Target = msg.From,
      Action = "ProposalCreated",
      Data = json.encode({
        proposalId = proposalId,
        title = title,
        expires = DAOState.Proposals[proposalId].expires
      })
    })
  end
)
```

### Voting Mechanism

```lua
-- Vote handler with validation
Handlers.add(
  "Vote",
  Handlers.utils.hasMatchingTag("Action", "Vote"),
  function(msg)
    local proposalId = msg.Tags.ProposalId
    local vote = msg.Tags.Vote -- "yes" or "no"

    -- Validation checks
    if not proposalId or not DAOState.Proposals[proposalId] then
      ao.send({
        Target = msg.From,
        Action = "VoteError",
        Data = json.encode({ error = "Invalid proposal ID" })
      })
      return
    end

    local proposal = DAOState.Proposals[proposalId]

    -- Check voting period
    if msg.Timestamp > proposal.expires then
      ao.send({
        Target = msg.From,
        Action = "VoteError",
        Data = json.encode({ error = "Voting period has ended" })
      })
      return
    end

    -- Check member status
    if not DAOState.Members[msg.From] then
      ao.send({
        Target = msg.From,
        Action = "VoteError",
        Data = json.encode({ error = "Only DAO members can vote" })
      })
      return
    end

    -- Check for duplicate voting
    if proposal.votes.voters[msg.From] then
      ao.send({
        Target = msg.From,
        Action = "VoteError",
        Data = json.encode({ error = "Already voted on this proposal" })
      })
      return
    end

    -- Record vote
    if vote == "yes" then
      proposal.votes.yes = proposal.votes.yes + 1
    elseif vote == "no" then
      proposal.votes.no = proposal.votes.no + 1
    else
      ao.send({
        Target = msg.From,
        Action = "VoteError",
        Data = json.encode({ error = "Invalid vote: must be 'yes' or 'no'" })
      })
      return
    end

    proposal.votes.voters[msg.From] = vote

    ao.send({
      Target = msg.From,
      Action = "VoteRecorded",
      Data = json.encode({
        proposalId = proposalId,
        vote = vote,
        currentTally = {
          yes = proposal.votes.yes,
          no = proposal.votes.no
        }
      })
    })
  end
)
```

## Security Patterns

### Input Validation

```lua
-- Comprehensive input validation pattern
local function validateInput(msg, requiredFields)
  local errors = {}

  -- Check required fields
  for _, field in ipairs(requiredFields) do
    if not msg.Tags[field] or msg.Tags[field] == "" then
      table.insert(errors, "Missing required field: " .. field)
    end
  end

  -- Validate data format if present
  if msg.Data then
    local success, parsed = pcall(json.decode, msg.Data)
    if not success then
      table.insert(errors, "Invalid JSON format in data")
    end
  end

  return #errors == 0, errors
end

-- Usage in handlers
Handlers.add(
  "SecureHandler",
  Handlers.utils.hasMatchingTag("Action", "SecureAction"),
  function(msg)
    local isValid, errors = validateInput(msg, {"Target", "Amount"})

    if not isValid then
      ao.send({
        Target = msg.From,
        Action = "ValidationError",
        Data = json.encode({ errors = errors })
      })
      return
    end

    -- Continue with validated input
  end
)
```

### Access Control

```lua
-- Role-based access control pattern
local AccessControl = {
  roles = {
    admin = {},
    moderator = {},
    member = {}
  },
  permissions = {
    admin = {"create", "delete", "modify", "mint", "burn"},
    moderator = {"modify", "moderate"},
    member = {"view", "interact"}
  }
}

local function hasPermission(address, permission)
  for role, addresses in pairs(AccessControl.roles) do
    if addresses[address] then
      local perms = AccessControl.permissions[role]
      for _, perm in ipairs(perms) do
        if perm == permission then
          return true
        end
      end
    end
  end
  return false
end

-- Protected handler example
Handlers.add(
  "AdminAction",
  Handlers.utils.hasMatchingTag("Action", "AdminAction"),
  function(msg)
    if not hasPermission(msg.From, "modify") then
      ao.send({
        Target = msg.From,
        Action = "AccessDenied",
        Data = json.encode({ error = "Insufficient permissions" })
      })
      return
    end

    -- Continue with authorized action
  end
)
```

## Performance Optimization Patterns

### State Management Optimization

```lua
-- Efficient state management with lazy loading
local StateManager = {
  cache = {},
  cacheSize = 1000,
  accessCount = {}
}

local function getState(key)
  -- Update access count for LRU
  StateManager.accessCount[key] = (StateManager.accessCount[key] or 0) + 1

  if StateManager.cache[key] then
    return StateManager.cache[key]
  end

  -- Load from persistent storage
  local value = loadFromStorage(key)

  -- Cache management
  if #StateManager.cache >= StateManager.cacheSize then
    -- Remove least recently used item
    local lru = nil
    local minCount = math.huge

    for k, count in pairs(StateManager.accessCount) do
      if count < minCount then
        minCount = count
        lru = k
      end
    end

    StateManager.cache[lru] = nil
    StateManager.accessCount[lru] = nil
  end

  StateManager.cache[key] = value
  return value
end
```

### Message Batching

```lua
-- Efficient message batching pattern
local MessageBatch = {
  pending = {},
  batchSize = 10,
  batchTimeout = 5000 -- 5 seconds
}

local function addToBatch(target, action, data)
  if not MessageBatch.pending[target] then
    MessageBatch.pending[target] = {}
  end

  table.insert(MessageBatch.pending[target], {
    action = action,
    data = data,
    timestamp = ao.now()
  })

  -- Send batch if size limit reached
  if #MessageBatch.pending[target] >= MessageBatch.batchSize then
    sendBatch(target)
  end
end

local function sendBatch(target)
  local messages = MessageBatch.pending[target]
  if not messages or #messages == 0 then
    return
  end

  ao.send({
    Target = target,
    Action = "BatchMessage",
    Data = json.encode({
      batch = messages,
      count = #messages
    })
  })

  MessageBatch.pending[target] = {}
end
```

## Testing Patterns

### AOLite Testing Framework Integration

The AOLite testing framework provides comprehensive local testing capabilities for AO processes, enabling thorough validation before deployment. This framework allows agents to generate test suites, execute local testing, and interpret results for continuous validation.

#### AOLite Test Suite Generation

```javascript
// Agents use the AOLiteTestService to generate comprehensive test suites
// based on AO process analysis and handler extraction

// Example: Agent workflow for test suite generation
const testSuiteGeneration = {
  processAnalysis: {
    extractHandlers:
      "Analyze Lua code to identify handler functions and patterns",
    identifyTestScenarios:
      "Generate test scenarios for normal, edge, and error cases",
    generateTestData:
      "Create appropriate test data based on handler requirements",
  },

  testCaseCreation: {
    handlerTesting: "Create test cases for each identified handler",
    assertionGeneration:
      "Define assertions for expected outputs and state changes",
    messageSimulation: "Generate AO message structures for handler testing",
  },

  validationSetup: {
    environmentCreation: "Set up isolated AOLite test environments",
    stateInitialization: "Initialize process state for testing scenarios",
    coverageAnalysis: "Ensure comprehensive handler coverage",
  },
};
```

#### AOLite Test Execution Patterns

```javascript
// Comprehensive test execution workflow using AOLiteTestService
const aoliteTestExecution = {
  testEnvironmentSetup: {
    processDefinition: {
      id: "test-process-id",
      name: "Test Process",
      compiledLua: "-- AO process Lua code",
      version: "1.0.0",
    },

    configuration: {
      concurrent: false, // Sequential testing for reliability
      coverage: true, // Enable coverage analysis
      timeout: 30000, // 30 second timeout
      verbose: true, // Detailed logging
      retries: 3, // Retry failed tests
    },
  },

  testExecution: {
    sequentialMode: "Execute tests in order for dependency management",
    concurrentMode: "Run independent tests in parallel for performance",
    messageSimulation: "Simulate AO message processing in local environment",
    stateValidation: "Verify process state consistency after each test",
  },

  resultValidation: {
    assertionTypes: {
      equals: "Exact value matching",
      exists: "Presence validation",
      contains: "Substring or element presence",
      matches: "Regular expression matching",
      custom: "Custom validation functions",
    },

    statusChecking: "Validate message processing status (sent/failed/timeout)",
    performanceMetrics: "Measure execution time and resource usage",
    coverageReporting: "Track handler coverage and untested functionality",
  },
};
```

#### AOLite Test Result Interpretation

```javascript
// Agent workflow for interpreting AOLite test results
const resultInterpretation = {
  testAnalysis: {
    passFailAnalysis: "Categorize test results and identify failure patterns",
    performanceAnalysis: "Analyze execution times and resource usage",
    coverageAnalysis: "Review handler coverage and identify gaps",
    errorAnalysis: "Classify errors and provide debugging guidance",
  },

  recommendationGeneration: {
    failureRemediation: "Suggest fixes for failed test cases",
    performanceOptimization: "Identify performance bottlenecks and solutions",
    coverageImprovement: "Recommend additional test cases for better coverage",
    securityValidation: "Highlight security-related test failures",
  },

  reportGeneration: {
    formats: ["markdown", "json", "html"],
    metrics: {
      totalTests: "Number of test cases executed",
      passedTests: "Number of successful test cases",
      failedTests: "Number of failed test cases",
      duration: "Total execution time",
      coverage: "Handler coverage percentage",
    },

    detailedAnalysis: {
      assertionResults: "Individual assertion outcomes with expected vs actual",
      messageResults: "AO message processing results with timing",
      stateVerification: "Process state consistency validation",
      performanceData: "Execution metrics and benchmarks",
    },
  },
};
```

#### Test-Driven Development with AOLite

```javascript
// Agent workflow for test-driven AO development
const testDrivenDevelopment = {
  developmentWorkflow: {
    step1: "spawnProcess() - Create development AO process",
    step2: "generateAoliteTests() - Agent generates test specifications",
    step3: "executeAoliteTests() - Run initial tests (should fail)",
    step4: "evalProcess() - Deploy handler implementations",
    step5: "executeAoliteTests() - Validate implementation",
    step6: "iterateUntilPass() - Refine implementation based on test results",
  },

  continuousTesting: {
    preDeploymentValidation: "Run AOLite tests before production deployment",
    regressionTesting: "Ensure changes don't break existing functionality",
    performanceMonitoring: "Track performance metrics across implementations",
    qualityGates: "Use test results to determine deployment readiness",
  },

  agentCollaboration: {
    aoDevToQa:
      "ao-developer creates process, permaweb-qa generates comprehensive tests",
    sharedContext: "Test results and analysis shared between agents",
    iterativeImprovement: "Collaborative refinement based on test outcomes",
    knowledgeTransfer: "Agents learn from test patterns and results",
  },
};
```

### Unit Testing Approach

```lua
-- Test framework pattern for AO processes
local TestFramework = {
  tests = {},
  passed = 0,
  failed = 0
}

local function test(name, testFunction)
  TestFramework.tests[name] = testFunction
end

local function runTests()
  for name, testFunc in pairs(TestFramework.tests) do
    local success, result = pcall(testFunc)

    if success and result then
      TestFramework.passed = TestFramework.passed + 1
      print("✓ " .. name)
    else
      TestFramework.failed = TestFramework.failed + 1
      print("✗ " .. name .. " - " .. tostring(result))
    end
  end

  print("\nTest Results: " .. TestFramework.passed .. " passed, " .. TestFramework.failed .. " failed")
end

-- Example test cases
test("Token balance calculation", function()
  local balance = calculateBalance("test-address", 100)
  return balance == 100
end)

test("Transfer validation", function()
  local isValid = validateTransfer("sender", "recipient", 50)
  return isValid == true
end)
```

### Integration Testing

```lua
-- Integration test handler
Handlers.add(
  "RunIntegrationTests",
  Handlers.utils.hasMatchingTag("Action", "RunIntegrationTests"),
  function(msg)
    local testResults = {}

    -- Test 1: End-to-end transfer flow
    local transferTest = {
      name = "E2E Transfer Test",
      steps = {
        "Initialize balances",
        "Execute transfer",
        "Verify balance updates",
        "Check notifications"
      },
      status = "running"
    }

    -- Execute test steps
    local success = true
    for i, step in ipairs(transferTest.steps) do
      local stepResult = executeTestStep(step, msg)
      if not stepResult then
        success = false
        transferTest.status = "failed at step " .. i
        break
      end
    end

    if success then
      transferTest.status = "passed"
    end

    table.insert(testResults, transferTest)

    ao.send({
      Target = msg.From,
      Action = "IntegrationTestResults",
      Data = json.encode({
        tests = testResults,
        summary = {
          total = #testResults,
          passed = success and 1 or 0,
          failed = success and 0 or 1
        }
      })
    })
  end
)
```

## Error Handling and Debugging

### Comprehensive Error Handling

```lua
-- Centralized error handling pattern
local ErrorHandler = {
  codes = {
    INVALID_INPUT = "E001",
    INSUFFICIENT_BALANCE = "E002",
    ACCESS_DENIED = "E003",
    PROCESS_ERROR = "E004",
    NETWORK_ERROR = "E005"
  },

  messages = {
    E001 = "Invalid input provided",
    E002 = "Insufficient balance for operation",
    E003 = "Access denied - insufficient permissions",
    E004 = "Internal process error occurred",
    E005 = "Network communication error"
  }
}

local function handleError(code, details, msgFrom)
  ao.send({
    Target = msgFrom,
    Action = "Error",
    Data = json.encode({
      code = code,
      message = ErrorHandler.messages[code] or "Unknown error",
      details = details,
      timestamp = ao.now()
    })
  })
end

-- Usage example
Handlers.add(
  "SafeHandler",
  Handlers.utils.hasMatchingTag("Action", "SafeAction"),
  function(msg)
    local success, result = pcall(function()
      -- Risky operation
      return performOperation(msg)
    end)

    if not success then
      handleError(ErrorHandler.codes.PROCESS_ERROR, result, msg.From)
      return
    end

    -- Success response
    ao.send({
      Target = msg.From,
      Action = "SafeActionResponse",
      Data = json.encode(result)
    })
  end
)
```

### Logging and Monitoring

```lua
-- Logging pattern for AO processes
local Logger = {
  level = "INFO", -- DEBUG, INFO, WARN, ERROR
  logs = {},
  maxLogs = 1000
}

local function log(level, message, context)
  if Logger.logs then
    -- Manage log size
    if #Logger.logs >= Logger.maxLogs then
      table.remove(Logger.logs, 1) -- Remove oldest log
    end

    table.insert(Logger.logs, {
      level = level,
      message = message,
      context = context,
      timestamp = ao.now()
    })
  end
end

-- Logging functions
local function logDebug(message, context)
  if Logger.level == "DEBUG" then
    log("DEBUG", message, context)
  end
end

local function logInfo(message, context)
  log("INFO", message, context)
end

local function logWarn(message, context)
  log("WARN", message, context)
end

local function logError(message, context)
  log("ERROR", message, context)
end

-- Get logs handler
Handlers.add(
  "GetLogs",
  Handlers.utils.hasMatchingTag("Action", "GetLogs"),
  function(msg)
    local level = msg.Tags.Level or "INFO"
    local count = tonumber(msg.Tags.Count) or 100

    local filteredLogs = {}
    for i = #Logger.logs, math.max(1, #Logger.logs - count + 1), -1 do
      local logEntry = Logger.logs[i]
      if not level or logEntry.level == level then
        table.insert(filteredLogs, logEntry)
      end
    end

    ao.send({
      Target = msg.From,
      Action = "LogsResponse",
      Data = json.encode({
        logs = filteredLogs,
        total = #Logger.logs
      })
    })
  end
)
```

## Deployment and Production Considerations

### Production Readiness Checklist

1. **Security Validation**
   - All inputs validated and sanitized
   - Access controls properly implemented
   - Error handling prevents information leakage
   - No hardcoded secrets or sensitive data

2. **Performance Optimization**
   - State management optimized for efficiency
   - Message handling optimized for throughput
   - Memory usage within reasonable limits
   - No infinite loops or recursive operations

3. **Monitoring and Observability**
   - Comprehensive logging implemented
   - Error tracking and reporting
   - Performance metrics collection
   - Health check endpoints

4. **Testing Coverage**
   - Unit tests for all critical functions
   - Integration tests for message flows
   - Edge case and error condition testing
   - Load testing for performance validation

5. **Documentation**
   - API documentation for all handlers
   - Architecture and design documentation
   - Deployment and operational guides
   - Security and compliance documentation

### Continuous Integration Pattern

```lua
-- CI/CD validation handler
Handlers.add(
  "ValidateDeployment",
  Handlers.utils.hasMatchingTag("Action", "ValidateDeployment"),
  function(msg)
    local validationResults = {
      security = validateSecurity(),
      performance = validatePerformance(),
      functionality = validateFunctionality(),
      compliance = validateCompliance()
    }

    local overallStatus = "passed"
    for category, result in pairs(validationResults) do
      if not result.passed then
        overallStatus = "failed"
        break
      end
    end

    ao.send({
      Target = msg.From,
      Action = "ValidationResults",
      Data = json.encode({
        status = overallStatus,
        details = validationResults,
        timestamp = ao.now()
      })
    })
  end
)
```

## Conclusion

These patterns provide a comprehensive foundation for building robust, secure, and performant AO processes. They should be adapted and extended based on specific use case requirements while maintaining the core principles of security, performance, and maintainability.

For additional guidance and support, use the `queryPermawebDocs` tool to access the latest AO documentation and community resources.
