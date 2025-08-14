import {
  ComplexityLevel,
  ProcessType,
  RequirementAnalysis,
} from "../types/lua-workflow.js";
import {
  DocumentationExample,
  ErrorHandlingPattern,
} from "../types/process-architecture.js";
import { PermawebDocs, PermawebDocsResult } from "./PermawebDocsService.js";

/**
 * Service for suggesting error handling patterns based on AO documentation
 * and architectural requirements.
 *
 * This service extracts error handling patterns from existing AO documentation
 * and best practices to:
 * - Recommend appropriate error handling strategies
 * - Provide implementation templates for different error scenarios
 * - Generate error handling patterns based on process complexity
 * - Validate error handling implementations against best practices
 */
export class ErrorHandlingPatternService {
  private readonly errorPatterns = {
    basicValidation: {
      complexity: "simple" as ComplexityLevel,
      description: "Simple validation of message inputs",
      implementation: `Handlers.add("{{ACTION}}", function(msg)
  -- Basic validation
  if not msg.Data or msg.Data == "" then
    return { 
      success = false, 
      error = "Data is required",
      code = "INVALID_DATA"
    }
  end
  
  -- Process request
  local result = processRequest(msg.Data)
  return { 
    success = true, 
    data = result 
  }
end)`,
      name: "Basic Input Validation",
      pattern: `-- Basic input validation pattern
if not msg.Data or msg.Data == "" then
  return { error = "Invalid input: Data is required" }
end

if not msg.Tags or not msg.Tags.Action then
  return { error = "Invalid input: Action tag is required" }
end`,
      useCases: ["Simple processes", "Input validation", "Data checking"],
    },
    circuitBreaker: {
      complexity: "complex" as ComplexityLevel,
      description: "Prevent cascading failures with circuit breaker",
      implementation: `-- Circuit breaker for external operations
local externalServiceBreaker = initializeCircuitBreaker(5, 30000)

Handlers.add("{{ACTION}}", function(msg)
  -- Use circuit breaker for external calls
  local result = executeWithCircuitBreaker(function()
    return callExternalService(msg.Data)
  end)
  
  if result.error then
    return {
      success = false,
      error = result.error,
      code = "EXTERNAL_SERVICE_ERROR",
      circuitBreakerState = externalServiceBreaker.state
    }
  end
  
  return {
    success = true,
    data = result.data
  }
end)`,
      name: "Circuit Breaker Pattern",
      pattern: `-- Circuit breaker pattern
local circuitBreaker = {
  state = "CLOSED", -- CLOSED, OPEN, HALF_OPEN
  failureCount = 0,
  failureThreshold = 5,
  timeout = 30000, -- 30 seconds
  lastFailureTime = 0
}

local function executeWithCircuitBreaker(operation)
  if circuitBreaker.state == "OPEN" then
    if (os.time() * 1000) - circuitBreaker.lastFailureTime > circuitBreaker.timeout then
      circuitBreaker.state = "HALF_OPEN"
    else
      return { error = "Circuit breaker is OPEN" }
    end
  end
  
  local success, result = pcall(operation)
  
  if success then
    circuitBreaker.failureCount = 0
    circuitBreaker.state = "CLOSED"
    return { data = result }
  else
    circuitBreaker.failureCount = circuitBreaker.failureCount + 1
    circuitBreaker.lastFailureTime = os.time() * 1000
    
    if circuitBreaker.failureCount >= circuitBreaker.failureThreshold then
      circuitBreaker.state = "OPEN"
    end
    
    return { error = "Operation failed: " .. tostring(result) }
  end
end`,
      useCases: [
        "External service calls",
        "Distributed systems",
        "High availability",
      ],
    },
    errorLogging: {
      complexity: "complex" as ComplexityLevel,
      description: "Detailed error logging and monitoring",
      implementation: `Handlers.add("{{ACTION}}", function(msg)
  local success, result = pcall(function()
    return executeOperation(msg)
  end)
  
  if not success then
    -- Log detailed error information
    local errorInfo = logError("Handler:{{ACTION}}", result, "ERROR", {
      messageId = msg.Id,
      from = msg.From,
      action = msg.Action,
      dataSize = string.len(msg.Data or "")
    })
    
    return {
      success = false,
      error = "Operation failed",
      code = "INTERNAL_ERROR",
      errorId = errorInfo.timestamp
    }
  end
  
  return {
    success = true,
    data = result
  }
end)

-- Error monitoring handler
Handlers.add("GetErrorLogs", function(msg)
  -- Return recent error logs for monitoring
  local recentErrors = {}
  local now = os.time()
  
  for _, log in ipairs(errorLogs or {}) do
    if now - log.timestamp < 3600 then -- Last hour
      table.insert(recentErrors, log)
    end
  end
  
  return {
    errors = recentErrors,
    count = #recentErrors
  }
end)`,
      name: "Comprehensive Error Logging",
      pattern: `-- Error logging pattern
local function logError(context, error, severity, metadata)
  local errorLog = {
    timestamp = os.time(),
    context = context,
    error = tostring(error),
    severity = severity or "ERROR",
    metadata = metadata or {},
    stackTrace = debug.traceback()
  }
  
  -- Log to process state for persistence
  errorLogs = errorLogs or {}
  table.insert(errorLogs, errorLog)
  
  -- Keep only last 100 errors
  if #errorLogs > 100 then
    table.remove(errorLogs, 1)
  end
  
  return errorLog
end`,
      useCases: ["Production systems", "Debugging", "System monitoring"],
    },
    retryPattern: {
      complexity: "complex" as ComplexityLevel,
      description: "Retry failed operations with increasing delays",
      implementation: `Handlers.add("{{ACTION}}", function(msg)
  -- Retry critical operations
  local result = retryWithBackoff(function()
    return executeCriticalOperation(msg)
  end, 3, 1000) -- 3 retries, starting with 1 second delay
  
  if result.error then
    return {
      success = false,
      error = result.error,
      code = "MAX_RETRIES_EXCEEDED"
    }
  end
  
  return {
    success = true,
    data = result.data
  }
end)`,
      name: "Retry with Exponential Backoff",
      pattern: `-- Retry pattern with exponential backoff
local function retryWithBackoff(operation, maxRetries, baseDelay)
  local retries = 0
  local delay = baseDelay
  
  while retries < maxRetries do
    local success, result = pcall(operation)
    
    if success then
      return { data = result }
    end
    
    retries = retries + 1
    if retries < maxRetries then
      -- Wait with exponential backoff
      os.execute("sleep " .. (delay / 1000))
      delay = delay * 2
    end
  end
  
  return { error = "Operation failed after " .. maxRetries .. " retries" }
end`,
      useCases: [
        "Network operations",
        "Temporary failures",
        "Resource contention",
      ],
    },
    stateValidation: {
      complexity: "moderate" as ComplexityLevel,
      description: "Validate state before and after operations",
      implementation: `Handlers.add("{{ACTION}}", function(msg)
  -- Pre-operation state validation
  local isValidBefore = pcall(validateState, currentState)
  if not isValidBefore then
    return {
      success = false,
      error = "Invalid state before operation",
      code = "INVALID_STATE_PRE"
    }
  end
  
  -- Execute operation with rollback capability
  local originalState = deepCopy(currentState)
  local success, result = pcall(function()
    return executeStateOperation(msg, currentState)
  end)
  
  if not success then
    -- Rollback state
    currentState = originalState
    return {
      success = false,
      error = "Operation failed, state rolled back",
      code = "OPERATION_ROLLBACK"
    }
  end
  
  -- Post-operation state validation
  local isValidAfter = pcall(validateState, currentState)
  if not isValidAfter then
    -- Rollback state
    currentState = originalState
    return {
      success = false,
      error = "Invalid state after operation, rolled back",
      code = "INVALID_STATE_POST"
    }
  end
  
  return {
    success = true,
    data = result,
    state = currentState
  }
end)`,
      name: "State Validation Pattern",
      pattern: `-- State validation pattern
local function validateState(state)
  if not state then
    error("State is not initialized")
  end
  
  if state.balance and state.balance < 0 then
    error("Invalid state: negative balance")
  end
  
  return true
end

-- Before operation
validateState(currentState)

-- Perform operation
local newState = updateState(currentState, operation)

-- After operation
validateState(newState)`,
      useCases: [
        "Stateful processes",
        "Financial operations",
        "Critical state changes",
      ],
    },
    trycatch: {
      complexity: "moderate" as ComplexityLevel,
      description: "Structured error handling with protected calls",
      implementation: `Handlers.add("{{ACTION}}", function(msg)
  -- Protected execution
  local success, result = pcall(function()
    -- Validate inputs
    validateInputs(msg)
    
    -- Execute business logic
    return executeOperation(msg)
  end)
  
  if not success then
    return {
      success = false,
      error = "Operation failed: " .. tostring(result),
      code = "EXECUTION_ERROR",
      timestamp = msg.Timestamp
    }
  end
  
  return {
    success = true,
    data = result,
    timestamp = msg.Timestamp
  }
end)`,
      name: "Try-Catch Error Handling",
      pattern: `-- Try-catch pattern using pcall
local success, result = pcall(function()
  return riskyOperation(data)
end)

if not success then
  return { error = "Operation failed: " .. tostring(result) }
end

return { data = result }`,
      useCases: ["Complex operations", "External calls", "State modifications"],
    },
  };

  constructor(private permawebDocsService: PermawebDocs) {}

  /**
   * Analyze error handling patterns from documentation
   */
  async analyzeErrorPatternsFromDocs(docs: PermawebDocsResult[]): Promise<{
    examples: Record<string, DocumentationExample[]>;
    patterns: Record<string, number>;
  }> {
    try {
      const patterns: Record<string, number> = {};
      const examples: Record<string, DocumentationExample[]> = {};

      for (const doc of docs) {
        const detectedPatterns = this.detectErrorPatterns(doc.content);

        for (const pattern of detectedPatterns) {
          patterns[pattern] = (patterns[pattern] || 0) + 1;

          if (!examples[pattern]) {
            examples[pattern] = [];
          }

          examples[pattern].push({
            domain: doc.domain,
            excerpt: this.extractErrorRelevantExcerpt(doc.content, pattern),
            relevance: doc.relevanceScore,
            source: doc.url,
            title: this.extractTitle(doc.content),
          });
        }
      }

      return { examples, patterns };
    } catch (error) {
      throw new Error(
        `ErrorHandlingPatternService.analyzeErrorPatternsFromDocs failed: ${error}`,
      );
    }
  }

  /**
   * Generate error handling patterns based on requirements
   */
  async generateErrorHandlingPatterns(
    requirements: RequirementAnalysis,
    processType: ProcessType,
  ): Promise<ErrorHandlingPattern[]> {
    try {
      const patterns: ErrorHandlingPattern[] = [];

      // Always include basic validation
      patterns.push(this.createPattern("basicValidation", requirements));

      // Add patterns based on complexity
      if (
        requirements.complexity === "moderate" ||
        requirements.complexity === "complex"
      ) {
        patterns.push(this.createPattern("trycatch", requirements));

        // Add state validation for stateful processes
        if (processType === "stateful") {
          patterns.push(this.createPattern("stateValidation", requirements));
        }
      }

      // Add complex patterns for complex systems
      if (requirements.complexity === "complex") {
        patterns.push(this.createPattern("errorLogging", requirements));

        // Add circuit breaker for multi-process systems
        if (processType === "multi-process") {
          patterns.push(this.createPattern("circuitBreaker", requirements));
          patterns.push(this.createPattern("retryPattern", requirements));
        }
      }

      return patterns;
    } catch (error) {
      throw new Error(
        `ErrorHandlingPatternService.generateErrorHandlingPatterns failed: ${error}`,
      );
    }
  }

  /**
   * Get error handling best practices
   */
  getErrorHandlingBestPractices(
    processType: ProcessType,
    complexity: ComplexityLevel,
  ): string[] {
    const basePractices = [
      "Always validate input parameters",
      "Return consistent error response format",
      "Use descriptive error messages",
      "Log errors for debugging and monitoring",
    ];

    const typePractices: Record<ProcessType, string[]> = {
      "multi-process": [
        "Handle inter-process communication failures",
        "Implement timeout and retry mechanisms",
      ],
      stateful: [
        "Validate state before and after operations",
        "Implement rollback mechanisms for failed state changes",
      ],
      stateless: ["Keep error handling simple", "Avoid storing error state"],
    };

    const complexityPractices: Record<ComplexityLevel, string[]> = {
      complex: [
        "Use advanced patterns like circuit breakers",
        "Implement comprehensive monitoring",
        "Design error recovery strategies",
      ],
      moderate: [
        "Implement try-catch error handling",
        "Add proper error logging",
      ],
      simple: ["Use basic validation patterns"],
    };

    return [
      ...basePractices,
      ...typePractices[processType],
      ...complexityPractices[complexity],
    ];
  }

  /**
   * Recommend error handling strategy based on architecture decision
   */
  async recommendErrorHandlingStrategy(
    processType: ProcessType,
    complexity: ComplexityLevel,
    detectedPatterns: string[],
  ): Promise<{
    monitoring: ErrorHandlingPattern[];
    primary: ErrorHandlingPattern[];
    secondary: ErrorHandlingPattern[];
  }> {
    try {
      const primary: ErrorHandlingPattern[] = [];
      const secondary: ErrorHandlingPattern[] = [];
      const monitoring: ErrorHandlingPattern[] = [];

      // Primary patterns (always needed)
      primary.push(this.createPatternForType("basicValidation", complexity));

      if (complexity !== "simple") {
        primary.push(this.createPatternForType("trycatch", complexity));
      }

      // Secondary patterns based on process type
      if (processType === "stateful") {
        secondary.push(
          this.createPatternForType("stateValidation", complexity),
        );
      }

      if (processType === "multi-process") {
        secondary.push(this.createPatternForType("circuitBreaker", complexity));
        secondary.push(this.createPatternForType("retryPattern", complexity));
      }

      // Monitoring patterns for complex systems
      if (complexity === "complex") {
        monitoring.push(this.createPatternForType("errorLogging", complexity));
      }

      return { monitoring, primary, secondary };
    } catch (error) {
      throw new Error(
        `ErrorHandlingPatternService.recommendErrorHandlingStrategy failed: ${error}`,
      );
    }
  }

  /**
   * Validate error handling implementation
   */
  validateErrorHandling(
    code: string,
    requirements: RequirementAnalysis,
  ): {
    issues: string[];
    score: number;
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check for basic validation
    if (!code.includes("if not") && !code.includes("validate")) {
      issues.push("Missing input validation");
      score -= 20;
      suggestions.push("Add input validation to prevent invalid operations");
    }

    // Check for error returns
    if (!code.includes("error") && !code.includes("return {")) {
      issues.push("Missing error return statements");
      score -= 15;
      suggestions.push("Add proper error return statements");
    }

    // Check for protected calls in complex systems
    if (requirements.complexity === "complex" && !code.includes("pcall")) {
      issues.push("Missing protected calls for complex operations");
      score -= 10;
      suggestions.push("Use pcall for protected execution of risky operations");
    }

    // Check for state validation in stateful systems
    if (
      requirements.processType === "stateful" &&
      code.includes("state") &&
      !code.includes("validate")
    ) {
      issues.push("Missing state validation");
      score -= 15;
      suggestions.push("Add state validation before and after operations");
    }

    return {
      issues,
      score: Math.max(0, score),
      suggestions,
    };
  }

  /**
   * Create error pattern instance
   */
  private createPattern(
    patternType: keyof typeof this.errorPatterns,
    requirements: RequirementAnalysis,
  ): ErrorHandlingPattern {
    const pattern = this.errorPatterns[patternType];

    return {
      complexity: pattern.complexity,
      description: pattern.description,
      documentation: [],
      implementation: this.customizeImplementation(
        pattern.implementation,
        requirements,
      ),
      name: pattern.name,
      pattern: pattern.pattern,
      useCases: pattern.useCases,
    };
  }

  /**
   * Create pattern for specific type
   */
  private createPatternForType(
    patternType: keyof typeof this.errorPatterns,
    complexity: ComplexityLevel,
  ): ErrorHandlingPattern {
    const pattern = this.errorPatterns[patternType];

    return {
      complexity,
      description: pattern.description,
      documentation: [],
      implementation: pattern.implementation,
      name: pattern.name,
      pattern: pattern.pattern,
      useCases: pattern.useCases,
    };
  }

  /**
   * Customize implementation based on requirements
   */
  private customizeImplementation(
    implementation: string,
    requirements: RequirementAnalysis,
  ): string {
    let customized = implementation;

    // Replace action placeholder
    const primaryAction = requirements.detectedPatterns[0] || "process";
    customized = customized.replace(/\{\{ACTION\}\}/g, primaryAction);

    // Add pattern-specific customizations
    if (requirements.detectedPatterns.includes("token-contract")) {
      customized = customized.replace(
        "executeOperation(msg)",
        "executeTokenOperation(msg)",
      );
      customized = customized.replace(
        "processRequest(msg.Data)",
        "processTokenRequest(msg)",
      );
    }

    if (requirements.detectedPatterns.includes("dao-governance")) {
      customized = customized.replace(
        "executeOperation(msg)",
        "executeGovernanceAction(msg)",
      );
    }

    return customized;
  }

  /**
   * Detect error handling patterns in content
   */
  private detectErrorPatterns(content: string): string[] {
    const patterns: string[] = [];
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes("if not") || lowerContent.includes("validate")) {
      patterns.push("validation");
    }

    if (lowerContent.includes("pcall") || lowerContent.includes("try")) {
      patterns.push("try-catch");
    }

    if (lowerContent.includes("error") && lowerContent.includes("log")) {
      patterns.push("logging");
    }

    if (lowerContent.includes("retry") || lowerContent.includes("attempt")) {
      patterns.push("retry");
    }

    if (lowerContent.includes("circuit") || lowerContent.includes("breaker")) {
      patterns.push("circuit-breaker");
    }

    if (lowerContent.includes("state") && lowerContent.includes("validate")) {
      patterns.push("state-validation");
    }

    return patterns;
  }

  /**
   * Extract error handling relevant excerpt
   */
  private extractErrorRelevantExcerpt(
    content: string,
    pattern: string,
  ): string {
    const lines = content.split("\n");

    // Find lines containing error handling keywords
    const errorKeywords = [
      "error",
      "validate",
      "pcall",
      "try",
      "catch",
      "fail",
    ];
    const relevantLines = lines.filter((line) =>
      errorKeywords.some((keyword) => line.toLowerCase().includes(keyword)),
    );

    if (relevantLines.length > 0) {
      return relevantLines.slice(0, 2).join(" ");
    }

    return content.substring(0, 200);
  }

  /**
   * Extract title from document
   */
  private extractTitle(content: string): string {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : "Error Handling Pattern";
  }
}
