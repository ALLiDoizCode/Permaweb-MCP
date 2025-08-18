import * as fs from "fs";
import * as path from "path";

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
import {
  DocumentationProtocolService,
  HandlerMetadata,
} from "./DocumentationProtocolService.js";
import { PermawebDocsResult } from "./PermawebDocsService.js";

/**
 * Service for generating Lua code based on AO documentation patterns and user requirements.
 *
 * This service provides template-based code generation for AO processes including:
 * - Handler pattern implementation (Handlers.add structure)
 * - Message routing logic based on documented examples
 * - State management code for stateful processes
 * - Best practices integration from documentation sources
 * - AO Documentation Protocol (ADP) compliance for self-documenting processes
 * - Comprehensive handler metadata for automatic tool integration
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

    calculator: {
      addition: `Handlers.add(
  "addition",
  Handlers.utils.hasMatchingTag("Action", "Add"),
  function(msg)
    local a = tonumber(msg.Tags.A or msg.Tags.a or msg.Data)
    local b = tonumber(msg.Tags.B or msg.Tags.b or "0")
    
    if not a or not b then
      ao.send({
        Target = msg.From,
        Action = "Error",
        Data = "Invalid input. Please provide numeric values for A and B."
      })
      return
    end
    
    local result = a + b
    ao.send({
      Target = msg.From,
      Action = "Sum",
      Data = tostring(result),
      Tags = {
        A = tostring(a),
        B = tostring(b),
        Result = tostring(result)
      }
    })
  end
)`,
      division: `Handlers.add(
  "division",
  Handlers.utils.hasMatchingTag("Action", "Divide"),
  function(msg)
    local a = tonumber(msg.Tags.A or msg.Tags.a or msg.Data)
    local b = tonumber(msg.Tags.B or msg.Tags.b or "1")
    
    if not a or not b then
      ao.send({
        Target = msg.From,
        Action = "Error",
        Data = "Invalid input. Please provide numeric values for A and B."
      })
      return
    end
    
    if b == 0 then
      ao.send({
        Target = msg.From,
        Action = "Error",
        Data = "Division by zero is not allowed."
      })
      return
    end
    
    local result = a / b
    ao.send({
      Target = msg.From,
      Action = "Quotient",
      Data = tostring(result),
      Tags = {
        A = tostring(a),
        B = tostring(b),
        Result = tostring(result)
      }
    })
  end
)`,
      multiplication: `Handlers.add(
  "multiplication",
  Handlers.utils.hasMatchingTag("Action", "Multiply"),
  function(msg)
    local a = tonumber(msg.Tags.A or msg.Tags.a or msg.Data)
    local b = tonumber(msg.Tags.B or msg.Tags.b or "1")
    
    if not a or not b then
      ao.send({
        Target = msg.From,
        Action = "Error",
        Data = "Invalid input. Please provide numeric values for A and B."
      })
      return
    end
    
    local result = a * b
    ao.send({
      Target = msg.From,
      Action = "Product",
      Data = tostring(result),
      Tags = {
        A = tostring(a),
        B = tostring(b),
        Result = tostring(result)
      }
    })
  end
)`,
      subtraction: `Handlers.add(
  "subtraction",
  Handlers.utils.hasMatchingTag("Action", "Subtract"),
  function(msg)
    local a = tonumber(msg.Tags.A or msg.Tags.a or msg.Data)
    local b = tonumber(msg.Tags.B or msg.Tags.b or "0")
    
    if not a or not b then
      ao.send({
        Target = msg.From,
        Action = "Error",
        Data = "Invalid input. Please provide numeric values for A and B."
      })
      return
    end
    
    local result = a - b
    ao.send({
      Target = msg.From,
      Action = "Difference",
      Data = tostring(result),
      Tags = {
        A = tostring(a),
        B = tostring(b),
        Result = tostring(result)
      }
    })
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

    counter: {
      current: `Handlers.add(
  "current",
  Handlers.utils.hasMatchingTag("Action", "Current"),
  function(msg)
    local value = Counter or 0
    
    ao.send({
      Target = msg.From,
      Action = "Counter",
      Data = tostring(value),
      Tags = {
        Operation = "Current",
        Current = tostring(value)
      }
    })
  end
)`,
      decrement: `Handlers.add(
  "decrement",
  Handlers.utils.hasMatchingTag("Action", "Decrement"),
  function(msg)
    if not Counter then
      Counter = 0
    end
    
    local step = tonumber(msg.Tags.Step or "1") or 1
    Counter = Counter - step
    
    ao.send({
      Target = msg.From,
      Action = "Counter",
      Data = tostring(Counter),
      Tags = {
        Operation = "Decrement",
        Step = tostring(step),
        Current = tostring(Counter)
      }
    })
  end
)`,
      increment: `Handlers.add(
  "increment",
  Handlers.utils.hasMatchingTag("Action", "Increment"),
  function(msg)
    if not Counter then
      Counter = 0
    end
    
    local step = tonumber(msg.Tags.Step or "1") or 1
    Counter = Counter + step
    
    ao.send({
      Target = msg.From,
      Action = "Counter",
      Data = tostring(Counter),
      Tags = {
        Operation = "Increment",
        Step = tostring(step),
        Current = tostring(Counter)
      }
    })
  end
)`,
      reset: `Handlers.add(
  "reset",
  Handlers.utils.hasMatchingTag("Action", "Reset"),
  function(msg)
    local oldValue = Counter or 0
    Counter = 0
    
    ao.send({
      Target = msg.From,
      Action = "Counter",
      Data = "0",
      Tags = {
        Operation = "Reset",
        Previous = tostring(oldValue),
        Current = "0"
      }
    })
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

    database: {
      delete: `Handlers.add(
  "delete",
  Handlers.utils.hasMatchingTag("Action", "Delete"),
  function(msg)
    if not Database then
      Database = {}
    end
    
    local key = msg.Tags.Key
    
    if not key then
      ao.send({
        Target = msg.From,
        Action = "Error",
        Data = "Key is required for delete operation."
      })
      return
    end
    
    local value = Database[key]
    Database[key] = nil
    
    if value then
      ao.send({
        Target = msg.From,
        Action = "Deleted",
        Data = "Key deleted successfully",
        Tags = {
          Key = key,
          Operation = "Delete",
          DeletedValue = value
        }
      })
    else
      ao.send({
        Target = msg.From,
        Action = "NotFound",
        Data = "Key not found",
        Tags = {
          Key = key,
          Operation = "Delete"
        }
      })
    end
  end
)`,
      retrieve: `Handlers.add(
  "retrieve",
  Handlers.utils.hasMatchingTag("Action", "Retrieve"),
  function(msg)
    if not Database then
      Database = {}
    end
    
    local key = msg.Tags.Key
    
    if not key then
      ao.send({
        Target = msg.From,
        Action = "Error",
        Data = "Key is required for retrieve operation."
      })
      return
    end
    
    local value = Database[key]
    
    if value then
      ao.send({
        Target = msg.From,
        Action = "Retrieved",
        Data = value,
        Tags = {
          Key = key,
          Operation = "Retrieve"
        }
      })
    else
      ao.send({
        Target = msg.From,
        Action = "NotFound",
        Data = "Key not found",
        Tags = {
          Key = key,
          Operation = "Retrieve"
        }
      })
    end
  end
)`,
      store: `Handlers.add(
  "store",
  Handlers.utils.hasMatchingTag("Action", "Store"),
  function(msg)
    if not Database then
      Database = {}
    end
    
    local key = msg.Tags.Key
    local value = msg.Data or msg.Tags.Value
    
    if not key then
      ao.send({
        Target = msg.From,
        Action = "Error",
        Data = "Key is required for store operation."
      })
      return
    end
    
    Database[key] = value
    
    ao.send({
      Target = msg.From,
      Action = "Stored",
      Data = "Value stored successfully",
      Tags = {
        Key = key,
        Operation = "Store"
      }
    })
  end
)`,
      update: `Handlers.add(
  "update",
  Handlers.utils.hasMatchingTag("Action", "Update"),
  function(msg)
    if not Database then
      Database = {}
    end
    
    local key = msg.Tags.Key
    local newValue = msg.Data or msg.Tags.Value
    
    if not key then
      ao.send({
        Target = msg.From,
        Action = "Error",
        Data = "Key is required for update operation."
      })
      return
    end
    
    local oldValue = Database[key]
    Database[key] = newValue
    
    ao.send({
      Target = msg.From,
      Action = "Updated",
      Data = "Value updated successfully",
      Tags = {
        Key = key,
        Operation = "Update",
        OldValue = oldValue or "null",
        NewValue = newValue or "null"
      }
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
   * Apply ADP template to existing process code
   * This method injects ADP compliance into manual deployments
   */
  async applyADPTemplateToCode(
    existingCode: string,
    processName: string,
    processDescription: string,
    detectedHandlers?: HandlerMetadata[],
  ): Promise<string> {
    // If code already has ADP compliance, return as-is
    if (existingCode.includes('protocolVersion = "1.0"')) {
      return existingCode;
    }

    const template = await this.loadADPTemplate();

    // Detect handlers from existing code if not provided
    const handlers =
      detectedHandlers || this.detectHandlersFromCode(existingCode);

    // Customize template
    let customizedTemplate = template
      .replace(
        /PROCESS_NAME = "Custom AO Process"/,
        `PROCESS_NAME = "${processName}"`,
      )
      .replace(
        /PROCESS_DESCRIPTION = "ADP-compliant process template"/,
        `PROCESS_DESCRIPTION = "${processDescription}"`,
      );

    // Update handler definitions if we detected any
    if (handlers.length > 0) {
      const handlerLuaArray = this.convertHandlerMetadataToLua(handlers);
      customizedTemplate = customizedTemplate.replace(
        /PROCESS_HANDLERS = \{[\s\S]*?\}/m,
        `PROCESS_HANDLERS = ${handlerLuaArray}`,
      );
    }

    // Combine with existing code, removing any old info handlers
    const cleanedCode = this.removeExistingInfoHandlers(existingCode);

    return `${customizedTemplate}\n\n-- EXISTING PROCESS CODE\n${cleanedCode}`;
  }

  /**
   * Create customized ADP template for specific process types
   */
  async createCustomADPTemplate(
    processTemplate: ProcessTemplate,
    processName: string,
    processDescription: string,
    customHandlers?: HandlerMetadata[],
  ): Promise<string> {
    const template = await this.loadADPTemplate();
    const handlers = customHandlers || [];

    // Add type-specific handlers based on template type
    switch (processTemplate) {
      case "token":
        handlers.push(
          ...DocumentationProtocolService.getTokenHandlerMetadata(),
        );
        break;
      case "custom":
      default:
        handlers.push(
          ...DocumentationProtocolService.getBasicProcessHandlerMetadata(),
        );
        break;
    }

    // Customize template
    const customizedTemplate = template
      .replace(
        /PROCESS_NAME = "Custom AO Process"/,
        `PROCESS_NAME = "${processName}"`,
      )
      .replace(
        /PROCESS_DESCRIPTION = "ADP-compliant process template"/,
        `PROCESS_DESCRIPTION = "${processDescription}"`,
      )
      .replace(
        /PROCESS_HANDLERS = \{[\s\S]*?\}/m,
        `PROCESS_HANDLERS = ${this.convertHandlerMetadataToLua(handlers)}`,
      );

    return customizedTemplate;
  }

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
    const documentationSources = Array.isArray(docs)
      ? docs.map((doc) => doc.url)
      : [];
    const explanation = this.generateExplanation(handlerPatterns, requirements);
    const bestPractices = this.extractBestPractices(docs || [], requirements);

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
   * Load ADP template from file system
   */
  async loadADPTemplate(): Promise<string> {
    try {
      const templatePath = path.join(
        process.cwd(),
        "src",
        "templates",
        "adp-info-handler.lua",
      );
      return await fs.promises.readFile(templatePath, "utf-8");
    } catch (error) {
      console.warn("Failed to load ADP template from file:", error);
      // Fallback to embedded template
      return this.getEmbeddedADPTemplate();
    }
  }

  /**
   * Assemble complete Lua code from selected patterns
   */
  private assembleCode(
    patterns: HandlerPattern[],
    requirements: RequirementAnalysis,
  ): string {
    const codeBlocks: string[] = [];

    // Add required imports at the top
    const imports = this.generateRequiredImports(patterns, requirements);
    if (imports.trim()) {
      codeBlocks.push(imports);
    }

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

    // Add ADP-compliant process info handler (always included)
    const adpInfoHandler = this.generateADPInfoHandler(patterns, requirements);
    codeBlocks.push(adpInfoHandler);

    // Add a basic Ping handler if not already included for ADP testing
    const hasPingHandler = patterns.some((p) => p.name === "ping-handler");
    if (!hasPingHandler) {
      codeBlocks.push(`
-- Basic Ping handler for ADP testing
Handlers.add('Ping', Handlers.utils.hasMatchingTag('Action', 'Ping'), function(msg)
    ao.send({
        Target = msg.From,
        Action = "Pong",
        Data = "pong"
    })
end)`);
    }

    // Ensure we only have ADP-compliant info handlers by filtering out any old format
    let finalCode = codeBlocks.join("\n\n");

    // Remove any old-format info handlers that contain "Process = ao.id" pattern
    // This is a more aggressive approach to ensure only ADP format is used
    if (finalCode.includes("Process = ao.id")) {
      // Split into lines and filter out old info handler blocks
      const lines = finalCode.split("\n");
      const filteredLines: string[] = [];
      let skipBlock = false;
      let braceCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Start skipping if we find old info handler pattern
        if (
          line.includes("Handlers.add") &&
          line.includes('"info"') &&
          !line.includes("ADP")
        ) {
          skipBlock = true;
          braceCount = 0;
          continue;
        }

        if (skipBlock) {
          // Count braces to know when the handler block ends
          braceCount += (line.match(/\{/g) || []).length;
          braceCount -= (line.match(/\}/g) || []).length;

          // End of handler block
          if (line.trim() === ")" && braceCount <= 0) {
            skipBlock = false;
            continue;
          }
          continue;
        }

        filteredLines.push(line);
      }

      finalCode = filteredLines.join("\n");
    }

    // Ensure we have the ADP handler
    if (!finalCode.includes("AO Documentation Protocol (ADP)")) {
      finalCode = finalCode.trim() + "\n\n" + adpInfoHandler;
    }

    return finalCode;
  }

  /**
   * Categorize handler based on action name
   */
  private categorizeHandler(action: string): "core" | "custom" | "utility" {
    const coreActions = ["Info", "Balance", "Transfer", "Balances"];
    const utilityActions = ["Ping", "Help", "Status"];

    if (coreActions.includes(action)) return "core";
    if (utilityActions.includes(action)) return "utility";
    return "custom";
  }

  /**
   * Convert HandlerMetadata array to Lua table format
   */
  private convertHandlerMetadataToLua(handlers: HandlerMetadata[]): string {
    const luaHandlers = handlers.map((handler) => {
      let luaHandler = `    {\n        action = "${handler.action}",\n        pattern = {`;

      // Add pattern (default to ["Action"] if not defined)
      const pattern = handler.pattern || ["Action"];
      luaHandler += pattern.map((p) => `"${p}"`).join(", ");
      luaHandler += "},\n";

      // Add description
      if (handler.description) {
        luaHandler += `        description = "${handler.description}",\n`;
      }

      // Add category (default to "custom" if not specified)
      const category = handler.category || "custom";
      luaHandler += `        category = "${category}",\n`;

      // Add parameters if present
      if (handler.parameters && handler.parameters.length > 0) {
        luaHandler += `        parameters = {\n`;
        handler.parameters.forEach((param) => {
          luaHandler += `            {\n`;
          luaHandler += `                name = "${param.name}",\n`;
          luaHandler += `                type = "${param.type}",\n`;
          luaHandler += `                required = ${param.required},\n`;
          if (param.description) {
            luaHandler += `                description = "${param.description}",\n`;
          }
          luaHandler += `            },\n`;
        });
        luaHandler += `        },\n`;
      }

      luaHandler += "    }";
      return luaHandler;
    });

    return `{\n${luaHandlers.join(",\n")}\n}`;
  }

  /**
   * Detect handlers from existing Lua code
   */
  private detectHandlersFromCode(code: string): HandlerMetadata[] {
    const handlers: HandlerMetadata[] = [];

    // Basic regex to find handler registrations
    const handlerMatches = code.matchAll(
      /Handlers\.add\(\s*['"](.*?)['"].*?hasMatchingTag\(\s*['"]Action['"],\s*['"](.*?)['"]\)/gs,
    );

    for (const match of handlerMatches) {
      const [, handlerName, actionValue] = match;
      if (handlerName && actionValue) {
        handlers.push({
          action: actionValue,
          category: this.categorizeHandler(actionValue),
          description: `${actionValue} handler`,
          pattern: ["Action"],
        });
      }
    }

    // Always ensure Info and Ping handlers are present
    const hasInfo = handlers.some((h) => h.action === "Info");
    const hasPing = handlers.some((h) => h.action === "Ping");

    if (!hasInfo) {
      handlers.unshift({
        action: "Info",
        category: "core",
        description: "Get process information and handler metadata",
        pattern: ["Action"],
      });
    }

    if (!hasPing) {
      handlers.push({
        action: "Ping",
        category: "utility",
        description: "Test if process is responding",
        pattern: ["Action"],
      });
    }

    return handlers;
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
      "Implement AO Documentation Protocol (ADP) for self-documenting processes",
      "Include comprehensive handler metadata in Info responses",
      "Use structured parameter validation with type checking",
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
    if ((requirements.detectedPatterns || []).includes("token-contract")) {
      practices.push(
        "Always validate transfer amounts are positive",
        "Check sufficient balance before transfers",
        "Use string arithmetic for token calculations",
      );
    }

    if ((requirements.detectedPatterns || []).includes("dao-governance")) {
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
   * Generate ADP-compliant info handler with comprehensive metadata
   */
  private generateADPInfoHandler(
    patterns: HandlerPattern[],
    requirements: RequirementAnalysis,
  ): string {
    // Generate handler metadata from the selected patterns
    const handlerMetadata = this.generateHandlerMetadata(
      patterns,
      requirements,
    );

    // Create standard info object with dynamic runtime values
    const standardInfo = {
      Description: `Generated AO process: ${requirements.userRequest}`,
      Name: "Generated AO Process",
    };

    // Format handlers JSON for Lua embedding with proper indentation
    const handlersJson = JSON.stringify(handlerMetadata, null, 8);
    const formattedHandlers = handlersJson.replace(/\\n/g, "\\n        ");

    return `
-- AO Documentation Protocol (ADP) v1.0 - Enhanced Info Handler
-- Auto-generated ADP-compliant handler for process self-documentation
Handlers.add('Info', Handlers.utils.hasMatchingTag('Action', 'Info'), function(msg)
    local infoResponse = {
        Name = "${standardInfo.Name}",
        Description = "${standardInfo.Description}",
        Owner = Owner or ao.env.Process.Owner,
        ProcessId = ao.id,
        protocolVersion = "1.0",
        lastUpdated = os.date("!%Y-%m-%dT%H:%M:%S.000Z"),
        handlers = ${formattedHandlers},
        capabilities = {
            supportsHandlerRegistry = true,
            supportsTagValidation = true,
            supportsExamples = true
        }
    }
    
    ao.send({
        Target = msg.From,
        Data = json.encode(infoResponse)
    })
    
    print("Sent ADP v1.0 compliant Info response to " .. msg.From)
end)`;
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

🔧 **AO Documentation Protocol (ADP) Integration:**
- Self-documenting Info handler with comprehensive metadata
- Automatic handler discovery for tools like Permamind
- Parameter validation rules and examples included
- Zero-configuration process interaction enabled

Complexity Level: ${requirements.complexity}
Process Type: ${requirements.processType}
Detected Patterns: ${(requirements.detectedPatterns || []).join(", ")}

The code follows AO best practices including proper message handling, error validation, response patterns, and ADP compliance for enhanced tool integration.`;
  }

  /**
   * Generate handler body code
   */
  private generateHandlerBody(requirements: RequirementAnalysis): string {
    if (requirements.complexity === "simple") {
      return `    ao.send({
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
   * Generate handler metadata for ADP compliance
   */
  private generateHandlerMetadata(
    patterns: HandlerPattern[],
    requirements: RequirementAnalysis,
  ): HandlerMetadata[] {
    const metadata: HandlerMetadata[] = [];

    // Always include Info handler metadata
    metadata.push({
      action: "Info",
      category: "core",
      description: "Get comprehensive process information and handler metadata",
      examples: ["Send Info message to get process details"],
      pattern: ["Action"],
    });

    // Always include Ping handler metadata for testing
    const hasPingHandler = patterns.some((p) => p.name === "ping-handler");
    if (!hasPingHandler) {
      metadata.push({
        action: "Ping",
        category: "utility",
        description: "Test if process is responding",
        examples: ["Send Ping to test connectivity"],
        pattern: ["Action"],
      });
    }

    // Generate metadata based on selected patterns
    for (const pattern of patterns) {
      const handlerMetadata = this.generateMetadataForPattern(
        pattern,
        requirements,
      );
      if (handlerMetadata) {
        metadata.push(handlerMetadata);
      }
    }

    return metadata;
  }

  /**
   * Generate handler name from requirements
   */
  private generateHandlerName(requirements: RequirementAnalysis): string {
    const keywords = requirements.extractedKeywords || [];

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
   * Generate handler metadata for a specific pattern
   */
  private generateMetadataForPattern(
    pattern: HandlerPattern,
    requirements: RequirementAnalysis,
  ): HandlerMetadata | null {
    switch (pattern.name) {
      case "auto-reply-handler":
        return {
          action: "Message",
          category: "utility",
          description: "Automatic reply to conversational messages",
          examples: ["Send greeting or help messages"],
          pattern: ["Action"],
        };

      case "balance-handler":
        return {
          action: "Balance",
          category: "core",
          description: "Get token balance for a specific address",
          examples: ["Check your own balance", "Check another address balance"],
          parameters: [
            {
              description: "Address to check balance for (defaults to sender)",
              examples: ["vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI"],
              name: "Target",
              required: false,
              type: "address",
            },
          ],
          pattern: ["Action"],
        };

      case "basic-handler": {
        const actionName = this.generateActionName(requirements);
        return {
          action: actionName,
          category: "custom",
          description: `Handle ${actionName} requests`,
          examples: [`Send ${actionName} message to process`],
          pattern: ["Action"],
        };
      }

      case "command-handler":
        return {
          action: "Command",
          category: "utility",
          description: "Execute bot commands",
          examples: ["Execute help command"],
          parameters: [
            {
              description: "Command to execute",
              examples: ["help", "status", "info"],
              name: "Command",
              required: true,
              type: "string",
              validation: {
                enum: ["help", "status", "info"],
              },
            },
            {
              description: "Command arguments",
              examples: ["arg1", "param1=value1"],
              name: "Args",
              required: false,
              type: "string",
            },
          ],
          pattern: ["Action"],
        };

      case "join-game-handler":
        return {
          action: "Join-Game",
          category: "core",
          description: "Join the game",
          examples: ["Join game with player name"],
          parameters: [
            {
              description: "Display name for the player",
              examples: ["Player1", "Alice"],
              name: "PlayerName",
              required: false,
              type: "string",
            },
          ],
          pattern: ["Action"],
        };

      case "join-room-handler":
        return {
          action: "Join",
          category: "core",
          description: "Join the chatroom",
          examples: ["Join chatroom with username"],
          parameters: [
            {
              description: "Display username (defaults to address)",
              examples: ["alice", "bob"],
              name: "Username",
              required: false,
              type: "string",
            },
          ],
          pattern: ["Action"],
        };

      case "message-handler":
        return {
          action: "Message",
          category: "core",
          description: "Send a message to the chatroom",
          examples: ["Send message to all chatroom members"],
          pattern: ["Action"],
        };

      case "move-handler":
        return {
          action: "Move",
          category: "core",
          description: "Make a game move",
          examples: ["Make move in the game"],
          parameters: [
            {
              description: "Game move data",
              examples: ["up", "down", "left", "right"],
              name: "Move",
              required: true,
              type: "string",
            },
          ],
          pattern: ["Action"],
        };

      case "ping-handler":
        return {
          action: "Ping",
          category: "utility",
          description: "Test if process is responding",
          examples: ["Send Ping to test connectivity"],
          pattern: ["Action"],
        };

      case "proposal-handler":
        return {
          action: "Create-Proposal",
          category: "core",
          description: "Create a new governance proposal",
          examples: ["Create proposal for protocol upgrade"],
          parameters: [
            {
              description: "Proposal title",
              examples: ["Increase token supply"],
              name: "Title",
              required: true,
              type: "string",
            },
            {
              description: "Detailed proposal description",
              examples: [
                "This proposal aims to increase the token supply by 10%",
              ],
              name: "Description",
              required: true,
              type: "string",
            },
          ],
          pattern: ["Action"],
        };

      case "transfer-handler":
        return {
          action: "Transfer",
          category: "core",
          description: "Transfer tokens to another address",
          examples: ["Transfer 100 tokens to address"],
          parameters: [
            {
              description: "Recipient address",
              examples: ["vh-NTHVvlKZqRxc8LyyTNok65yQ55a_PJ1zWLb9G2JI"],
              name: "Recipient",
              required: true,
              type: "address",
            },
            {
              description: "Amount to transfer (in token units)",
              examples: ["100", "1000000000000"],
              name: "Quantity",
              required: true,
              type: "string",
              validation: {
                pattern: "^[0-9]+$",
              },
            },
          ],
          pattern: ["Action"],
        };

      case "vote-handler":
        return {
          action: "Vote",
          category: "core",
          description: "Vote on a governance proposal",
          examples: ["Vote yes on proposal 1"],
          parameters: [
            {
              description: "ID of proposal to vote on",
              examples: ["1", "2"],
              name: "ProposalId",
              required: true,
              type: "string",
            },
            {
              description: "Vote choice",
              examples: ["yes", "no"],
              name: "Vote",
              required: true,
              type: "string",
              validation: {
                enum: ["yes", "no"],
              },
            },
          ],
          pattern: ["Action"],
        };

      default:
        // For unknown patterns, create a generic handler metadata
        return {
          action: pattern.name.replace(/-handler$/, "").replace(/-/g, ""),
          category: "custom",
          description: pattern.description || "Custom handler",
          examples: [pattern.description || "Custom action"],
          pattern: ["Action"],
        };
    }
  }

  /**
   * Generate process info handler (legacy method for backwards compatibility)
   */
  private generateProcessInfoHandler(): string {
    // This method is now deprecated in favor of generateADPInfoHandler
    // but kept for backwards compatibility
    return this.generateADPInfoHandler([], {
      complexity: "simple",
      detectedPatterns: [],
      extractedKeywords: [],
      processType: "stateless",
      suggestedDomains: [],
      userRequest: "Legacy process",
    });
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
   * Generate required imports based on patterns and templates used
   */
  private generateRequiredImports(
    patterns: HandlerPattern[],
    requirements: RequirementAnalysis,
  ): string {
    const imports: string[] = [];
    const allTemplateCode = patterns.map((p) => p.template).join("\n");

    // Check if json.encode is used anywhere in the generated code
    // ADP info handler always uses json.encode, so we always need it
    const needsJson =
      allTemplateCode.includes("json.encode") || patterns.length >= 0; // Always true since ADP handler uses json
    if (needsJson) {
      imports.push('local json = require("json")');
    }

    const detectedPatterns = requirements.detectedPatterns || [];

    // Add other potential imports based on patterns
    if (detectedPatterns.includes("token-contract")) {
      // Token contracts might need additional utilities
    }

    if (detectedPatterns.includes("dao-governance")) {
      // DAO might need additional utilities
    }

    // Return imports as a single block
    return imports.length > 0 ? imports.join("\n") + "\n" : "";
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

    if ((requirements.detectedPatterns || []).includes("token-contract")) {
      stateFields = `initialized = true,
    ticker = "TOKEN",
    name = "Generated Token",
    balances = {}`;
    }

    if ((requirements.detectedPatterns || []).includes("dao-governance")) {
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
   * Get embedded ADP template as fallback
   */
  private getEmbeddedADPTemplate(): string {
    return `-- AO Documentation Protocol (ADP) v1.0 - Info Handler Template
-- Auto-generated ADP-compliant handler for manual process deployment

-- CUSTOMIZE THESE VALUES FOR YOUR PROCESS
local PROCESS_NAME = "Custom AO Process"
local PROCESS_DESCRIPTION = "ADP-compliant process template"

-- DEFINE YOUR HANDLERS HERE
local PROCESS_HANDLERS = {
    {
        action = "Info",
        pattern = {"Action"},
        description = "Get process information and handler metadata",
        category = "core"
    },
    {
        action = "Ping",
        pattern = {"Action"}, 
        description = "Test if process is responding",
        category = "utility"
    }
}

-- ADP-COMPLIANT INFO HANDLER
Handlers.add('Info', Handlers.utils.hasMatchingTag('Action', 'Info'), function(msg)
    local infoResponse = {
        Name = PROCESS_NAME,
        Description = PROCESS_DESCRIPTION,
        Owner = Owner or ao.env.Process.Owner,
        ProcessId = ao.id,
        protocolVersion = "1.0",
        lastUpdated = os.date("!%Y-%m-%dT%H:%M:%S.000Z"),
        handlers = PROCESS_HANDLERS,
        capabilities = {
            supportsHandlerRegistry = true,
            supportsTagValidation = true,
            supportsExamples = true
        }
    }
    
    ao.send({
        Target = msg.From,
        Data = json.encode(infoResponse)
    })
end)

-- BASIC PING HANDLER
Handlers.add('Ping', Handlers.utils.hasMatchingTag('Action', 'Ping'), function(msg)
    ao.send({
        Target = msg.From,
        Data = "pong"
    })
end)`;
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
   * Remove existing Info handlers from code to avoid conflicts
   */
  private removeExistingInfoHandlers(code: string): string {
    // Remove old-style info handlers that might conflict
    return code
      .replace(/Handlers\.add\(\s*['"']info['"'][\s\S]*?\)\s*\n/gi, "")
      .replace(/Handlers\.add\(\s*['"']Info['"'][\s\S]*?\)\s*\n/gi, "");
  }

  /**
   * Select appropriate handler patterns based on requirements
   */
  private selectHandlerPatterns(
    requirements: RequirementAnalysis,
  ): HandlerPattern[] {
    const patterns: HandlerPattern[] = [];
    const userRequest = (requirements.userRequest || "").toLowerCase();
    const detectedPatterns = requirements.detectedPatterns || [];

    // Add functional templates first (highest priority)
    if (detectedPatterns.includes("calculator")) {
      if (
        userRequest.includes("add") ||
        userRequest.includes("addition") ||
        userRequest.includes("sum")
      ) {
        patterns.push({
          description: "Calculator addition handler with numeric validation",
          name: "addition-handler",
          template: this.templates.calculator.addition,
          usedPatterns: ["calculator", "handler"],
        });
      }
      if (
        userRequest.includes("subtract") ||
        userRequest.includes("subtraction") ||
        userRequest.includes("difference")
      ) {
        patterns.push({
          description: "Calculator subtraction handler with numeric validation",
          name: "subtraction-handler",
          template: this.templates.calculator.subtraction,
          usedPatterns: ["calculator", "handler"],
        });
      }
      if (
        userRequest.includes("multiply") ||
        userRequest.includes("multiplication") ||
        userRequest.includes("product")
      ) {
        patterns.push({
          description:
            "Calculator multiplication handler with numeric validation",
          name: "multiplication-handler",
          template: this.templates.calculator.multiplication,
          usedPatterns: ["calculator", "handler"],
        });
      }
      if (
        userRequest.includes("divide") ||
        userRequest.includes("division") ||
        userRequest.includes("quotient")
      ) {
        patterns.push({
          description:
            "Calculator division handler with zero-division protection",
          name: "division-handler",
          template: this.templates.calculator.division,
          usedPatterns: ["calculator", "handler"],
        });
      }
    }

    if (detectedPatterns.includes("counter")) {
      patterns.push({
        description: "Counter increment handler with step support",
        name: "increment-handler",
        template: this.templates.counter.increment,
        usedPatterns: ["counter", "handler", "state-management"],
      });
      patterns.push({
        description: "Counter decrement handler with step support",
        name: "decrement-handler",
        template: this.templates.counter.decrement,
        usedPatterns: ["counter", "handler", "state-management"],
      });
      patterns.push({
        description: "Counter reset handler",
        name: "reset-handler",
        template: this.templates.counter.reset,
        usedPatterns: ["counter", "handler", "state-management"],
      });
      patterns.push({
        description: "Counter current value handler",
        name: "current-handler",
        template: this.templates.counter.current,
        usedPatterns: ["counter", "handler", "state-management"],
      });
    }

    if (detectedPatterns.includes("database")) {
      patterns.push({
        description: "Database store handler with key validation",
        name: "store-handler",
        template: this.templates.database.store,
        usedPatterns: ["database", "handler", "state-management"],
      });
      patterns.push({
        description: "Database retrieve handler with key validation",
        name: "retrieve-handler",
        template: this.templates.database.retrieve,
        usedPatterns: ["database", "handler", "state-management"],
      });
      patterns.push({
        description: "Database update handler with key validation",
        name: "update-handler",
        template: this.templates.database.update,
        usedPatterns: ["database", "handler", "state-management"],
      });
      patterns.push({
        description: "Database delete handler with key validation",
        name: "delete-handler",
        template: this.templates.database.delete,
        usedPatterns: ["database", "handler", "state-management"],
      });
    }

    // Add basic handler only if no functional patterns were found
    if (patterns.length === 0 && detectedPatterns.includes("handler")) {
      patterns.push({
        description: "Basic message handler with action matching",
        name: "basic-handler",
        template: this.templates.basic.handler,
        usedPatterns: ["handler"],
      });
    }

    // Add token patterns
    if (detectedPatterns.includes("token-contract")) {
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
    if (detectedPatterns.includes("dao-governance")) {
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
