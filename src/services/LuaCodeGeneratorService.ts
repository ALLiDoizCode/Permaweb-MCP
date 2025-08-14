import {
  HandlerDefinition,
  ProcessCodeResult,
  ProcessTemplate,
  ProcessTestCase,
} from "../types/guided-process.js";
import {
  AOPattern,
  ComplexityLevel,
  HandlerPattern,
  LuaCodeResult,
  ProcessType,
  RequirementAnalysis,
} from "../types/lua-workflow.js";
import { PermawebDocsResult } from "./PermawebDocsService.js";

/**
 * Service for generating Lua code based on AO documentation patterns and user requirements.
 *
 * This service provides template-based code generation for AO processes including:
 * - Handler pattern implementation (Handlers.add structure)
 * - Message routing logic based on documented examples
 * - State management code for stateful processes
 * - Best practices integration from documentation sources
 */
export class LuaCodeGeneratorService {
  private readonly templates = {
    basic: {
      handler: `Handlers.add(
  "{{name}}",
  Handlers.utils.hasMatchingTag("Action", "{{action}}"),
  function(msg)
    {{body}}
  end
)`,
      messageResponse: `-- Send response message
ao.send({
  Target = msg.From,
  Action = "{{responseAction}}",
  Data = {{responseData}}
})`,
      stateInit: `-- Initialize process state
if not State then
  State = {
    {{stateFields}}
  }
end`,
    },

    bot: {
      autoReply: `Handlers.add(
  "auto-reply",
  Handlers.utils.hasMatchingTag("Action", "Message"),
  function(msg)
    local content = (msg.Data or ""):lower()
    local reply = ""
    
    if content:find("hello") or content:find("hi") then
      reply = "Hello! How can I help you today?"
    elseif content:find("help") then
      reply = "I'm here to assist you. Send 'Command' action with Command tag for available commands."
    elseif content:find("thanks") or content:find("thank you") then
      reply = "You're welcome! Happy to help!"
    else
      reply = "I received your message. For specific commands, use Action='Command'."
    end
    
    ao.send({
      Target = msg.From,
      Action = "Auto-Reply",
      Data = reply
    })
  end
)`,
      command: `Handlers.add(
  "bot-command",
  Handlers.utils.hasMatchingTag("Action", "Command"),
  function(msg)
    local command = msg.Tags.Command
    local args = msg.Tags.Args or ""
    
    if command == "help" then
      ao.send({
        Target = msg.From,
        Action = "Command-Response",
        Data = "Available commands: help, status, info"
      })
    elseif command == "status" then
      ao.send({
        Target = msg.From,
        Action = "Command-Response",
        Data = "Bot is online and ready"
      })
    elseif command == "info" then
      ao.send({
        Target = msg.From,
        Action = "Command-Response",
        Data = json.encode({
          processId = ao.id,
          uptime = os.time() - (StartTime or 0),
          commands = {"help", "status", "info"}
        })
      })
    else
      ao.send({
        Target = msg.From,
        Action = "Command-Error",
        Error = "Unknown command: " .. command
      })
    end
  end
)`,
    },

    chatroom: {
      join: `Handlers.add(
  "join-room",
  Handlers.utils.hasMatchingTag("Action", "Join"),
  function(msg)
    local username = msg.Tags.Username or msg.From
    
    if not Members[msg.From] then
      Members[msg.From] = {
        username = username,
        joinedAt = msg.Timestamp,
        active = true
      }
      
      -- Notify all members
      for memberId, member in pairs(Members) do
        if member.active and memberId ~= msg.From then
          ao.send({
            Target = memberId,
            Action = "User-Joined",
            Username = username,
            From = msg.From
          })
        end
      end
    end
    
    ao.send({
      Target = msg.From,
      Action = "Join-Success",
      Username = username
    })
  end
)`,
      message: `Handlers.add(
  "send-message",
  Handlers.utils.hasMatchingTag("Action", "Message"),
  function(msg)
    if not Members[msg.From] or not Members[msg.From].active then
      ao.send({
        Target = msg.From,
        Action = "Message-Error",
        Error = "Must join room first"
      })
      return
    end
    
    local messageData = {
      from = msg.From,
      username = Members[msg.From].username,
      content = msg.Data,
      timestamp = msg.Timestamp
    }
    
    -- Broadcast to all active members
    for memberId, member in pairs(Members) do
      if member.active then
        ao.send({
          Target = memberId,
          Action = "New-Message",
          Data = json.encode(messageData)
        })
      end
    end
  end
)`,
    },

    dao: {
      proposal: `Handlers.add(
  "create-proposal",
  Handlers.utils.hasMatchingTag("Action", "Create-Proposal"),
  function(msg)
    local proposalId = #Proposals + 1
    local proposal = {
      id = proposalId,
      title = msg.Tags.Title,
      description = msg.Tags.Description,
      proposer = msg.From,
      votes = {},
      status = "active",
      created = msg.Timestamp
    }
    
    Proposals[proposalId] = proposal
    
    ao.send({
      Target = msg.From,
      Action = "Proposal-Created",
      ProposalId = tostring(proposalId)
    })
  end
)`,
      vote: `Handlers.add(
  "vote",
  Handlers.utils.hasMatchingTag("Action", "Vote"),
  function(msg)
    local proposalId = tonumber(msg.Tags.ProposalId)
    local vote = msg.Tags.Vote -- "yes" or "no"
    
    if not Proposals[proposalId] then
      ao.send({
        Target = msg.From,
        Action = "Vote-Error",
        Error = "Proposal not found"
      })
      return
    end
    
    if Proposals[proposalId].status ~= "active" then
      ao.send({
        Target = msg.From,
        Action = "Vote-Error",
        Error = "Proposal not active"
      })
      return
    end
    
    Proposals[proposalId].votes[msg.From] = vote
    
    ao.send({
      Target = msg.From,
      Action = "Vote-Recorded",
      ProposalId = tostring(proposalId),
      Vote = vote
    })
  end
)`,
    },

    game: {
      join: `Handlers.add(
  "join-game",
  Handlers.utils.hasMatchingTag("Action", "Join-Game"),
  function(msg)
    if not GameState then
      GameState = {
        players = {},
        status = "waiting",
        maxPlayers = 4
      }
    end
    
    if #GameState.players >= GameState.maxPlayers then
      ao.send({
        Target = msg.From,
        Action = "Join-Error",
        Error = "Game is full"
      })
      return
    end
    
    -- Check if already joined
    for _, player in ipairs(GameState.players) do
      if player.id == msg.From then
        ao.send({
          Target = msg.From,
          Action = "Join-Error",
          Error = "Already in game"
        })
        return
      end
    end
    
    table.insert(GameState.players, {
      id = msg.From,
      name = msg.Tags.PlayerName or "Player",
      score = 0,
      active = true
    })
    
    ao.send({
      Target = msg.From,
      Action = "Join-Success",
      PlayerCount = tostring(#GameState.players)
    })
    
    -- Start game if enough players
    if #GameState.players >= 2 and GameState.status == "waiting" then
      GameState.status = "active"
      for _, player in ipairs(GameState.players) do
        ao.send({
          Target = player.id,
          Action = "Game-Started",
          PlayerCount = tostring(#GameState.players)
        })
      end
    end
  end
)`,
      move: `Handlers.add(
  "make-move",
  Handlers.utils.hasMatchingTag("Action", "Move"),
  function(msg)
    if not GameState or GameState.status ~= "active" then
      ao.send({
        Target = msg.From,
        Action = "Move-Error",
        Error = "No active game"
      })
      return
    end
    
    -- Find player
    local player = nil
    for _, p in ipairs(GameState.players) do
      if p.id == msg.From then
        player = p
        break
      end
    end
    
    if not player then
      ao.send({
        Target = msg.From,
        Action = "Move-Error",
        Error = "Not in game"
      })
      return
    end
    
    local move = msg.Tags.Move
    -- Simple move validation (game-specific logic here)
    if move and #move > 0 then
      -- Process move (game-specific logic)
      player.score = player.score + 1
      
      -- Notify all players of the move
      for _, p in ipairs(GameState.players) do
        ao.send({
          Target = p.id,
          Action = "Move-Made",
          Player = player.name,
          Move = move,
          Score = tostring(player.score)
        })
      end
    else
      ao.send({
        Target = msg.From,
        Action = "Move-Error",
        Error = "Invalid move"
      })
    end
  end
)`,
    },

    token: {
      balance: `Handlers.add(
  "balance",
  Handlers.utils.hasMatchingTag("Action", "Balance"),
  function(msg)
    local target = msg.Tags.Target or msg.From
    local balance = Balances[target] or "0"
    ao.send({
      Target = msg.From,
      Action = "Balance-Response",
      Balance = balance,
      Ticker = Ticker,
      Account = target
    })
  end
)`,
      transfer: `Handlers.add(
  "transfer",
  Handlers.utils.hasMatchingTag("Action", "Transfer"),
  function(msg)
    local qty = tonumber(msg.Tags.Quantity)
    local target = msg.Tags.Recipient
    
    if not qty or qty <= 0 then
      ao.send({
        Target = msg.From,
        Action = "Transfer-Error",
        Error = "Invalid quantity"
      })
      return
    end
    
    local balance = tonumber(Balances[msg.From] or "0")
    if balance < qty then
      ao.send({
        Target = msg.From,
        Action = "Transfer-Error",
        Error = "Insufficient balance"
      })
      return
    end
    
    Balances[msg.From] = tostring(balance - qty)
    Balances[target] = tostring(tonumber(Balances[target] or "0") + qty)
    
    ao.send({
      Target = msg.From,
      Action = "Transfer-Success",
      Quantity = tostring(qty),
      Recipient = target
    })
  end
)`,
    },
  };

  /**
   * Generate Lua code based on documentation and requirements
   */
  async generateLuaCode(
    docs: PermawebDocsResult[],
    requirements: RequirementAnalysis,
  ): Promise<LuaCodeResult> {
    const handlerPatterns = this.selectHandlerPatterns(requirements);
    const generatedCode = this.assembleCode(handlerPatterns, requirements);
    const usedTemplates = handlerPatterns.map((pattern) => pattern.name);
    const documentationSources = docs.map((doc) => doc.url);
    const explanation = this.generateExplanation(handlerPatterns, requirements);
    const bestPractices = this.extractBestPractices(docs, requirements);

    return {
      bestPractices,
      documentationSources,
      explanation,
      generatedCode,
      handlerPatterns,
      usedTemplates,
    };
  }

  /**
   * Generate process code with complete structure for guided deployment
   */
  async generateProcessCode(
    docs: PermawebDocsResult[],
    requirements: RequirementAnalysis,
  ): Promise<ProcessCodeResult> {
    // Generate base code
    const baseResult = await this.generateLuaCode(docs, requirements);

    // Determine process template
    const templateUsed = this.determineProcessTemplate(requirements);

    // Extract process structure
    const processStructure = this.extractProcessStructure(
      baseResult,
      templateUsed,
    );

    // Generate test cases
    const testCases = this.generateProcessTestCases(
      processStructure.handlers,
      templateUsed,
    );

    // Generate deployment instructions
    const deploymentInstructions =
      this.generateDeploymentInstructions(processStructure);

    return {
      ...baseResult,
      deploymentInstructions,
      processStructure,
      templateUsed,
      testCases,
    };
  }

  /**
   * Assemble complete Lua code from selected patterns
   */
  private assembleCode(
    patterns: HandlerPattern[],
    requirements: RequirementAnalysis,
  ): string {
    const codeBlocks: string[] = [];

    // Add initialization block for stateful processes
    if (
      requirements.processType === "stateful" ||
      requirements.processType === "multi-process"
    ) {
      codeBlocks.push(this.generateStateInitialization(requirements));
    }

    // Add all selected handler patterns
    for (const pattern of patterns) {
      codeBlocks.push(this.processTemplate(pattern.template, requirements));
    }

    // Add process info handler
    codeBlocks.push(this.generateProcessInfoHandler());

    return codeBlocks.join("\n\n");
  }

  /**
   * Determine the appropriate process template based on requirements
   */
  private determineProcessTemplate(
    requirements: RequirementAnalysis,
  ): ProcessTemplate {
    const userRequest = requirements.userRequest.toLowerCase();
    const patterns = requirements.detectedPatterns;

    if (patterns.includes("token-contract") || userRequest.includes("token")) {
      return "token";
    }
    if (
      userRequest.includes("chat") ||
      userRequest.includes("room") ||
      userRequest.includes("messaging")
    ) {
      return "chatroom";
    }
    if (
      userRequest.includes("bot") ||
      userRequest.includes("agent") ||
      userRequest.includes("assistant")
    ) {
      return "bot";
    }
    if (
      userRequest.includes("game") ||
      userRequest.includes("player") ||
      userRequest.includes("match")
    ) {
      return "game";
    }

    return "custom";
  }

  /**
   * Extract best practices from documentation
   */
  private extractBestPractices(
    docs: PermawebDocsResult[],
    requirements: RequirementAnalysis,
  ): string[] {
    const practices = [
      "Always validate message parameters before processing",
      "Use Handlers.utils.hasMatchingTag for action matching",
      "Send response messages with appropriate action tags",
      "Include error handling for invalid inputs",
      "Use ao.send() for message responses",
    ];

    // Add complexity-specific practices
    if (
      requirements.complexity === "complex" ||
      requirements.processType === "stateful"
    ) {
      practices.push(
        "Initialize state variables at process startup",
        "Validate state consistency before modifications",
        "Use proper data types for numeric operations",
      );
    }

    // Add pattern-specific practices
    if (requirements.detectedPatterns.includes("token-contract")) {
      practices.push(
        "Always validate transfer amounts are positive",
        "Check sufficient balance before transfers",
        "Use string arithmetic for token calculations",
      );
    }

    if (requirements.detectedPatterns.includes("dao-governance")) {
      practices.push(
        "Implement proposal voting periods",
        "Track member voting rights",
        "Validate proposal states before actions",
      );
    }

    return practices;
  }

  /**
   * Extract structured process components from generated code
   */
  private extractProcessStructure(
    baseResult: LuaCodeResult,
    templateUsed: ProcessTemplate,
  ) {
    const generatedCode = baseResult.generatedCode;

    // Extract handlers using regex pattern
    const handlers: HandlerDefinition[] = [];
    const handlerMatches = generatedCode.matchAll(
      /Handlers\.add\(\s*"([^"]+)",\s*([^,]+(?:,\s*[^,]+)*?),\s*function\(([^)]*)\)(.*?)end\s*\)/gs,
    );

    for (const match of handlerMatches) {
      const [, name, matchCriteria, params, body] = match;
      handlers.push({
        handleFunction: `function(${params})${body}end`,
        matchCriteria: matchCriteria.trim(),
        name: name,
      });
    }

    // Extract initialization code (everything before first handler)
    const firstHandlerIndex = generatedCode.indexOf("Handlers.add");
    const initializationCode =
      firstHandlerIndex > 0
        ? generatedCode.substring(0, firstHandlerIndex).trim()
        : "";

    // Generate state definition based on template
    const stateDefinition =
      this.generateStateDefinitionForTemplate(templateUsed);

    // Extract utility functions (functions defined outside handlers)
    const utilityFunctions = this.extractUtilityFunctions(generatedCode);

    return {
      handlers,
      initializationCode,
      stateDefinition,
      utilityFunctions,
    };
  }

  /**
   * Extract utility functions from code
   */
  private extractUtilityFunctions(code: string): string[] {
    const utilityFunctions: string[] = [];

    // Simple pattern to find function definitions outside of handlers
    const functionMatches = code.matchAll(/^(local\s+function\s+\w+.*?end)/gms);

    for (const match of functionMatches) {
      // Only include if it's not inside a handler
      if (!match[1].includes("Handlers.add")) {
        utilityFunctions.push(match[1].trim());
      }
    }

    return utilityFunctions;
  }

  /**
   * Generate action name from requirements
   */
  private generateActionName(requirements: RequirementAnalysis): string {
    const name = this.generateHandlerName(requirements);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Generate deployment instructions for process structure
   */
  private generateDeploymentInstructions(processStructure: any): string[] {
    const instructions = [];

    if (processStructure.stateDefinition) {
      instructions.push(
        "1. Deploy state initialization code to set up process variables",
      );
    }

    if (processStructure.initializationCode) {
      instructions.push("2. Deploy process initialization code");
    }

    if (processStructure.utilityFunctions.length > 0) {
      instructions.push("3. Deploy utility functions for process operations");
    }

    if (processStructure.handlers.length > 0) {
      instructions.push(
        `4. Deploy ${processStructure.handlers.length} message handlers`,
      );
    }

    instructions.push("5. Validate deployment by testing handler registration");
    instructions.push("6. Run functionality tests to ensure proper operation");

    return instructions;
  }

  /**
   * Generate explanation for the generated code
   */
  private generateExplanation(
    patterns: HandlerPattern[],
    requirements: RequirementAnalysis,
  ): string {
    const patternDescriptions = patterns
      .map((p) => `- ${p.name}: ${p.description}`)
      .join("\n");

    return `This AO process was generated based on your requirements: "${requirements.userRequest}"

The generated code includes the following components:

${patternDescriptions}

Complexity Level: ${requirements.complexity}
Process Type: ${requirements.processType}
Detected Patterns: ${requirements.detectedPatterns.join(", ")}

The code follows AO best practices including proper message handling, error validation, and response patterns.`;
  }

  /**
   * Generate handler body code
   */
  private generateHandlerBody(requirements: RequirementAnalysis): string {
    if (requirements.complexity === "simple") {
      return `    print("Received message: " .. (msg.Data or ""))
    ao.send({
      Target = msg.From,
      Action = "Response",
      Data = "Processed successfully"
    })`;
    }

    return `    -- Process the incoming message
    local result = "Processed: " .. (msg.Tags.Action or "Unknown")
    
    ao.send({
      Target = msg.From,
      Action = "Response",
      Data = result
    })`;
  }

  /**
   * Generate handler name from requirements
   */
  private generateHandlerName(requirements: RequirementAnalysis): string {
    const keywords = requirements.extractedKeywords;

    // Try to find a meaningful handler name
    const actionKeywords = keywords.filter(
      (k) =>
        !["and", "for", "from", "or", "the", "with"].includes(k) &&
        k.length > 2,
    );

    if (actionKeywords.length > 0) {
      return actionKeywords[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    return "custom";
  }

  /**
   * Generate process info handler
   */
  private generateProcessInfoHandler(): string {
    return `Handlers.add(
  "info",
  Handlers.utils.hasMatchingTag("Action", "Info"),
  function(msg)
    local info = {
      Process = ao.id,
      Name = Name or "Generated AO Process",
      Owner = Owner or ao.id
    }
    
    ao.send({
      Target = msg.From,
      Action = "Info-Response",
      Data = json.encode(info)
    })
  end
)`;
  }

  /**
   * Generate test cases for process handlers
   */
  private generateProcessTestCases(
    handlers: HandlerDefinition[],
    template: ProcessTemplate,
  ): ProcessTestCase[] {
    const testCases: ProcessTestCase[] = [];

    // Generate handler registration tests
    for (const handler of handlers) {
      testCases.push({
        description: `Test ${handler.name} handler registration`,
        expectedBehavior: `Handler ${handler.name} should be registered and accessible`,
        testCode: `
-- Test handler registration for ${handler.name}
local handlerFound = false
for _, h in ipairs(Handlers.list) do
  if h.name == "${handler.name}" then
    handlerFound = true
    break
  end
end
assert(handlerFound, "Handler ${handler.name} not registered")
return "Handler ${handler.name} registered successfully"`,
      });
    }

    // Generate template-specific tests
    switch (template) {
      case "bot":
        testCases.push({
          description: "Test bot responsiveness",
          expectedBehavior: "Bot should respond to basic commands",
          testCode: `
assert(StartTime ~= nil, "StartTime not set")
assert(type(StartTime) == "number", "StartTime should be a number")
return "Bot state initialized correctly"`,
        });
        break;

      case "chatroom":
        testCases.push({
          description: "Test chatroom state initialization",
          expectedBehavior: "Chatroom state should be ready for members",
          testCode: `
assert(Members ~= nil, "Members not initialized")
assert(type(Members) == "table", "Members should be a table")
return "Chatroom state initialized correctly"`,
        });
        break;

      case "game":
        testCases.push({
          description: "Test game state initialization",
          expectedBehavior: "Game state should be ready for players",
          testCode: `
assert(GameState ~= nil, "GameState not initialized")
assert(GameState.players ~= nil, "Player list not initialized")
assert(GameState.status == "waiting", "Game should start in waiting status")
return "Game state initialized correctly"`,
        });
        break;

      case "token":
        testCases.push({
          description: "Test token state initialization",
          expectedBehavior:
            "Token state variables should be properly initialized",
          testCode: `
assert(Balances ~= nil, "Balances not initialized")
assert(Ticker ~= nil, "Ticker not initialized")
return "Token state initialized correctly"`,
        });
        break;
    }

    return testCases;
  }

  /**
   * Generate response action name
   */
  private generateResponseAction(requirements: RequirementAnalysis): string {
    return this.generateActionName(requirements) + "-Response";
  }

  /**
   * Generate state definition for specific template types
   */
  private generateStateDefinitionForTemplate(
    template: ProcessTemplate,
  ): string {
    switch (template) {
      case "bot":
        return `-- Bot state initialization
if not Commands then Commands = {} end
if not StartTime then StartTime = os.time() end
if not BotName then BotName = "Generated Bot" end`;

      case "chatroom":
        return `-- Chatroom state initialization  
if not Members then Members = {} end
if not Messages then Messages = {} end
if not RoomName then RoomName = "Generated Chatroom" end`;

      case "game":
        return `-- Game state initialization
if not GameState then 
  GameState = {
    players = {},
    status = "waiting",
    maxPlayers = 4,
    currentTurn = 1
  }
end`;

      case "token":
        return `-- Token state initialization
if not Balances then Balances = {} end
if not Ticker then Ticker = "TOKEN" end
if not Name then Name = "Generated Token" end
if not Denomination then Denomination = 12 end`;

      default:
        return `-- Process state initialization
if not State then
  State = {
    initialized = true,
    created = os.time()
  }
end`;
    }
  }

  /**
   * Generate state initialization code
   */
  private generateStateInitialization(
    requirements: RequirementAnalysis,
  ): string {
    let stateFields = "initialized = true";

    if (requirements.detectedPatterns.includes("token-contract")) {
      stateFields = `initialized = true,
    ticker = "TOKEN",
    name = "Generated Token",
    balances = {}`;
    }

    if (requirements.detectedPatterns.includes("dao-governance")) {
      stateFields = `initialized = true,
    proposals = {},
    members = {},
    votingPeriod = 7 * 24 * 60 * 60 * 1000 -- 7 days in milliseconds`;
    }

    return this.templates.basic.stateInit.replace(
      "{{stateFields}}",
      stateFields,
    );
  }

  /**
   * Process template with variable substitution
   */
  private processTemplate(
    template: string,
    requirements: RequirementAnalysis,
  ): string {
    let processed = template;

    // Basic substitutions based on requirements
    const substitutions = {
      "{{action}}": this.generateActionName(requirements),
      "{{body}}": this.generateHandlerBody(requirements),
      "{{name}}": this.generateHandlerName(requirements),
      "{{responseAction}}": this.generateResponseAction(requirements),
      "{{responseData}}": `"Process response to: " .. msg.Tags.Action`,
    };

    for (const [placeholder, replacement] of Object.entries(substitutions)) {
      processed = processed.replace(
        new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"),
        replacement,
      );
    }

    return processed;
  }

  /**
   * Select appropriate handler patterns based on requirements
   */
  private selectHandlerPatterns(
    requirements: RequirementAnalysis,
  ): HandlerPattern[] {
    const patterns: HandlerPattern[] = [];
    const userRequest = requirements.userRequest.toLowerCase();

    // Add basic handler for all requests
    if (requirements.detectedPatterns.includes("handler")) {
      patterns.push({
        description: "Basic message handler with action matching",
        name: "basic-handler",
        template: this.templates.basic.handler,
        usedPatterns: ["handler"],
      });
    }

    // Add token patterns
    if (requirements.detectedPatterns.includes("token-contract")) {
      patterns.push({
        description: "Token balance query handler",
        name: "balance-handler",
        template: this.templates.token.balance,
        usedPatterns: ["token-contract", "handler"],
      });

      patterns.push({
        description: "Token transfer handler with validation",
        name: "transfer-handler",
        template: this.templates.token.transfer,
        usedPatterns: ["token-contract", "handler", "state-management"],
      });
    }

    // Add DAO patterns
    if (requirements.detectedPatterns.includes("dao-governance")) {
      patterns.push({
        description: "DAO proposal creation handler",
        name: "proposal-handler",
        template: this.templates.dao.proposal,
        usedPatterns: ["dao-governance", "handler", "state-management"],
      });

      patterns.push({
        description: "DAO voting handler with validation",
        name: "vote-handler",
        template: this.templates.dao.vote,
        usedPatterns: ["dao-governance", "handler", "state-management"],
      });
    }

    // Add chatroom patterns
    if (
      userRequest.includes("chat") ||
      userRequest.includes("room") ||
      userRequest.includes("messaging")
    ) {
      patterns.push({
        description: "Chatroom join handler for user management",
        name: "join-room-handler",
        template: this.templates.chatroom.join,
        usedPatterns: ["handler", "state-management"],
      });

      patterns.push({
        description: "Message broadcasting handler for chatroom",
        name: "message-handler",
        template: this.templates.chatroom.message,
        usedPatterns: ["handler", "message-routing", "state-management"],
      });
    }

    // Add bot patterns
    if (
      userRequest.includes("bot") ||
      userRequest.includes("agent") ||
      userRequest.includes("assistant")
    ) {
      patterns.push({
        description: "Bot command handler for interactive commands",
        name: "command-handler",
        template: this.templates.bot.command,
        usedPatterns: ["handler", "message-routing"],
      });

      patterns.push({
        description: "Auto-reply handler for conversational responses",
        name: "auto-reply-handler",
        template: this.templates.bot.autoReply,
        usedPatterns: ["handler", "message-routing"],
      });
    }

    // Add game patterns
    if (
      userRequest.includes("game") ||
      userRequest.includes("player") ||
      userRequest.includes("match")
    ) {
      patterns.push({
        description: "Game join handler for player management",
        name: "join-game-handler",
        template: this.templates.game.join,
        usedPatterns: ["handler", "state-management"],
      });

      patterns.push({
        description: "Game move handler for gameplay mechanics",
        name: "move-handler",
        template: this.templates.game.move,
        usedPatterns: ["handler", "state-management"],
      });
    }

    // Ensure at least one pattern is selected
    if (patterns.length === 0) {
      patterns.push({
        description: "Simple ping-pong handler for testing",
        name: "ping-handler",
        template: `Handlers.add(
  "ping",
  Handlers.utils.hasMatchingTag("Action", "Ping"),
  function(msg)
    ao.send({
      Target = msg.From,
      Action = "Pong",
      Data = "Hello from AO process!"
    })
  end
)`,
        usedPatterns: ["handler"],
      });
    }

    return patterns;
  }
}
