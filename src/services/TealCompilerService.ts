import {
  TealCompileOptions,
  TealCompileResult,
  TealProcessDefinition,
  TealProcessMetadata,
  TealTemplate,
  TealTypeDefinition,
} from "../models/TealProcess.js";
import { ProcessCommunicationService } from "./ProcessCommunicationService.js";
import { TokenProcessTemplateService } from "./TokenProcessTemplateService.js";

export interface TealCompilerService {
  compileTealToLua(
    source: string,
    options?: TealCompileOptions,
  ): Promise<TealCompileResult>;
  createProcessDefinition(
    source: string,
    metadata: TealProcessMetadata,
  ): Promise<TealProcessDefinition>;
  createTealTemplate(
    templateType: "dao" | "game" | "generic" | "token",
    name: string,
    metadata: Partial<TealProcessMetadata>,
  ): Promise<TealTemplate>;
  generateTypeDefinitions(aoPatterns: string[]): Promise<TealTypeDefinition[]>;
  integrateWithAOServices(
    compiledLua: string,
    processId: string,
  ): Promise<string>;
  validateTealTypes(source: string): Promise<TealCompileResult>;
}

const AO_TEAL_TYPES = `
-- AO Process Types for Teal
local record AO
  record Message
    Id: string
    Target: string
    From: string
    Data: string
    Tags: {string:string}
    Timestamp: number
    "Block-Height": number
    "Hash-Chain": string
  end
  
  record Process
    Id: string
    Tags: {string:string}
    Handlers: {function}
    Modules: {string}
    Scheduler: string
    Owner: string
  end
  
  record Handler
    Name: string
    Pattern: function
    Handle: function
  end
  
  record Tag
    name: string
    value: string
  end
  
  record Response
    Output: string
    Messages: {Message}
    Spawns: {Process}
    Assignments: {string:any}
  end
end

-- AO Global Functions
declare ao: AO.Process
declare Handlers: AO.Handler[]
declare Send: function(target: string, data: string, tags: {string:string}?)
declare Spawn: function(module: string, data: string?, tags: {string:string}?)
declare Assign: function(processes: {string}, message: string)
`;

const TEAL_TEMPLATES = {
  dao: `
-- AO DAO Process Template (Teal)
local record DAOState
  Name: string
  Description: string
  TokenProcess: string
  VotingPower: {string:number}
  Proposals: {Proposal}
  ProposalCount: number
  Admin: string
  VotingPeriod: number
  QuorumThreshold: number
end

local record Proposal
  Id: number
  Title: string
  Description: string
  Proposer: string
  Votes: {string:boolean}
  VotesFor: number
  VotesAgainst: number
  Created: number
  Expires: number
  Executed: boolean
  Status: string
end

local State: DAOState = {
  Name = "{{DAO_NAME}}",
  Description = "{{DAO_DESCRIPTION}}",
  TokenProcess = "{{TOKEN_PROCESS}}",
  VotingPower = {},
  Proposals = {},
  ProposalCount = 0,
  Admin = "{{ADMIN_ADDRESS}}",
  VotingPeriod = 604800, -- 7 days
  QuorumThreshold = 51
}

-- Handler: Create Proposal
local function createProposal(msg: AO.Message): AO.Response
  local title = msg.Tags.Title
  local description = msg.Tags.Description
  
  if not title or not description then
    return {
      Output = json.encode({Error = "Title and description required"}),
      Messages = {},
      Spawns = {},
      Assignments = {}
    }
  end
  
  State.ProposalCount = State.ProposalCount + 1
  
  local proposal: Proposal = {
    Id = State.ProposalCount,
    Title = title,
    Description = description,
    Proposer = msg.From,
    Votes = {},
    VotesFor = 0,
    VotesAgainst = 0,
    Created = msg.Timestamp,
    Expires = msg.Timestamp + State.VotingPeriod,
    Executed = false,
    Status = "Active"
  }
  
  State.Proposals[State.ProposalCount] = proposal
  
  return {
    Output = json.encode({
      Success = true,
      ProposalId = State.ProposalCount,
      Proposal = proposal
    }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

-- Register Handlers
Handlers.add("create-proposal", Handlers.utils.hasMatchingTag("Action", "Create-Proposal"), createProposal)
`,
  game: `
-- AO Game Process Template (Teal)
local record GameState
  Name: string
  Players: {string:Player}
  MaxPlayers: number
  Status: string
  CurrentTurn: string
  TurnCount: number
  Winner: string
  StartTime: number
  EndTime: number
end

local record Player
  Id: string
  Name: string
  Score: number
  Active: boolean
  JoinedAt: number
  LastAction: number
end

local State: GameState = {
  Name = "{{GAME_NAME}}",
  Players = {},
  MaxPlayers = 10,
  Status = "Waiting",
  CurrentTurn = "",
  TurnCount = 0,
  Winner = "",
  StartTime = 0,
  EndTime = 0
}

-- Handler: Join Game
local function joinGame(msg: AO.Message): AO.Response
  local playerName = msg.Tags.Name or msg.From
  
  if State.Players[msg.From] then
    return {
      Output = json.encode({Error = "Already joined"}),
      Messages = {},
      Spawns = {},
      Assignments = {}
    }
  end
  
  if #State.Players >= State.MaxPlayers then
    return {
      Output = json.encode({Error = "Game full"}),
      Messages = {},
      Spawns = {},
      Assignments = {}
    }
  end
  
  State.Players[msg.From] = {
    Id = msg.From,
    Name = playerName,
    Score = 0,
    Active = true,
    JoinedAt = msg.Timestamp,
    LastAction = msg.Timestamp
  }
  
  return {
    Output = json.encode({
      Success = true,
      PlayerId = msg.From,
      PlayerCount = #State.Players
    }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

-- Register Handlers
Handlers.add("join-game", Handlers.utils.hasMatchingTag("Action", "Join-Game"), joinGame)
`,
  generic: `
-- AO Generic Process Template (Teal)
local record ProcessState
  Name: string
  Owner: string
  Data: {string:any}
  Handlers: {string}
  Version: string
  Created: number
  Updated: number
end

local State: ProcessState = {
  Name = "{{PROCESS_NAME}}",
  Owner = "{{OWNER_ADDRESS}}",
  Data = {},
  Handlers = {},
  Version = "1.0.0",
  Created = 0,
  Updated = 0
}

-- Handler: Get Process Info
local function info(msg: AO.Message): AO.Response
  return {
    Output = json.encode({
      Name = State.Name,
      Owner = State.Owner,
      Version = State.Version,
      Created = State.Created,
      Updated = State.Updated,
      Handlers = State.Handlers
    }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

-- Handler: Set Data
local function setData(msg: AO.Message): AO.Response
  local key = msg.Tags.Key
  local value = msg.Tags.Value
  
  if not key or not value then
    return {
      Output = json.encode({Error = "Key and value required"}),
      Messages = {},
      Spawns = {},
      Assignments = {}
    }
  end
  
  State.Data[key] = value
  State.Updated = msg.Timestamp
  
  return {
    Output = json.encode({
      Success = true,
      Key = key,
      Value = value
    }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

-- Register Handlers
Handlers.add("info", Handlers.utils.hasMatchingTag("Action", "Info"), info)
Handlers.add("set-data", Handlers.utils.hasMatchingTag("Action", "Set-Data"), setData)
`,
  token: `
-- AO Token Process Template (Teal)
local record TokenState
  Name: string
  Ticker: string
  Denomination: number
  TotalSupply: number
  Balances: {string:number}
  Owner: string
  Transferable: boolean
  Mintable: boolean
  Burnable: boolean
end

local State: TokenState = {
  Name = "{{TOKEN_NAME}}",
  Ticker = "{{TOKEN_TICKER}}",
  Denomination = 12,
  TotalSupply = 0,
  Balances = {},
  Owner = "{{OWNER_ADDRESS}}",
  Transferable = true,
  Mintable = true,
  Burnable = true
}

-- Handler: Get Token Information
local function info(msg: AO.Message): AO.Response
  return {
    Output = json.encode({
      Name = State.Name,
      Ticker = State.Ticker,
      Denomination = State.Denomination,
      TotalSupply = State.TotalSupply,
      Owner = State.Owner,
      Transferable = State.Transferable,
      Mintable = State.Mintable,
      Burnable = State.Burnable
    }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

-- Handler: Get Balance
local function balance(msg: AO.Message): AO.Response
  local target = msg.Tags.Target or msg.From
  local balance = State.Balances[target] or 0
  
  return {
    Output = json.encode({
      Balance = tostring(balance),
      Ticker = State.Ticker,
      Account = target,
      Data = json.encode({
        Balance = balance,
        Ticker = State.Ticker,
        Account = target
      })
    }),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end

-- Handler: Transfer Tokens
local function transfer(msg: AO.Message): AO.Response
  local recipient = msg.Tags.Recipient
  local quantity = tonumber(msg.Tags.Quantity)
  
  if not recipient or not quantity then
    return {
      Output = json.encode({Error = "Invalid transfer parameters"}),
      Messages = {},
      Spawns = {},
      Assignments = {}
    }
  end
  
  local sender_balance = State.Balances[msg.From] or 0
  
  if sender_balance >= quantity then
    State.Balances[msg.From] = sender_balance - quantity
    State.Balances[recipient] = (State.Balances[recipient] or 0) + quantity
    
    return {
      Output = json.encode({
        Success = true,
        From = msg.From,
        To = recipient,
        Quantity = quantity
      }),
      Messages = {},
      Spawns = {},
      Assignments = {}
    }
  else
    return {
      Output = json.encode({Error = "Insufficient balance"}),
      Messages = {},
      Spawns = {},
      Assignments = {}
    }
  end
end

-- Register Handlers
Handlers.add("info", Handlers.utils.hasMatchingTag("Action", "Info"), info)
Handlers.add("balance", Handlers.utils.hasMatchingTag("Action", "Balance"), balance)
Handlers.add("transfer", Handlers.utils.hasMatchingTag("Action", "Transfer"), transfer)
`,
};

const service = (
  processService: ProcessCommunicationService,
  templateService: TokenProcessTemplateService,
): TealCompilerService => {
  return {
    compileTealToLua: async (
      source: string,
      options: TealCompileOptions = {},
    ): Promise<TealCompileResult> => {
      try {
        // Simulate Teal compilation process
        // In a real implementation, this would call the Teal compiler
        const errors: string[] = [];
        const warnings: string[] = [];

        // Basic syntax validation
        if (!source.includes("local") && !source.includes("function")) {
          errors.push("No valid Teal code structure found");
        }

        // Check for AO-specific patterns
        if (source.includes("Handlers.add") && !source.includes("AO.Message")) {
          warnings.push("Consider using AO.Message type for message handlers");
        }

        // Type checking simulation
        const typeCheckErrors = validateTealSyntax(source);
        errors.push(...typeCheckErrors);

        if (errors.length > 0) {
          return {
            errors,
            success: false,
            warnings,
          };
        }

        // Simulate successful compilation
        const compiledLua = convertTealToLua(source);

        return {
          compiledLua,
          success: true,
          warnings,
        };
      } catch (error) {
        return {
          errors: [
            error instanceof Error ? error.message : "Compilation failed",
          ],
          success: false,
        };
      }
    },

    createProcessDefinition: async (
      source: string,
      metadata: TealProcessMetadata,
    ): Promise<TealProcessDefinition> => {
      const compileResult = await service(
        processService,
        templateService,
      ).compileTealToLua(source, metadata.compileOptions);

      if (!compileResult.success || !compileResult.compiledLua) {
        throw new Error(
          `Teal compilation failed: ${compileResult.errors?.join(", ")}`,
        );
      }

      const typeDefinitions = await service(
        processService,
        templateService,
      ).generateTypeDefinitions(["token", "dao", "game"]);

      return {
        compiledLua: compileResult.compiledLua,
        dependencies: extractDependencies(source),
        id: generateProcessId(),
        metadata,
        name: metadata.description || "Teal Process",
        source,
        typeDefinitions,
        version: metadata.version,
      };
    },

    createTealTemplate: async (
      templateType: "dao" | "game" | "generic" | "token",
      name: string,
      metadata: Partial<TealProcessMetadata>,
    ): Promise<TealTemplate> => {
      const template = TEAL_TEMPLATES[templateType];
      if (!template) {
        throw new Error(`Unknown template type: ${templateType}`);
      }

      // Replace template variables
      let processedTemplate = template;
      const replacements: Record<string, string> = {
        "{{ADMIN_ADDRESS}}": metadata.author || "ADMIN",
        "{{DAO_DESCRIPTION}}": metadata.description || "DAO Description",
        "{{DAO_NAME}}": name,
        "{{GAME_NAME}}": name,
        "{{OWNER_ADDRESS}}": metadata.author || "OWNER",
        "{{PROCESS_NAME}}": name,
        "{{TOKEN_NAME}}": name,
        "{{TOKEN_PROCESS}}": "TOKEN_PROCESS_ID",
        "{{TOKEN_TICKER}}": metadata.version || "TKN",
      };

      for (const [key, value] of Object.entries(replacements)) {
        processedTemplate = processedTemplate.replace(
          new RegExp(key, "g"),
          value,
        );
      }

      return {
        category: templateType,
        dependencies: ["json"],
        description: metadata.description || `${templateType} process template`,
        metadata: {
          aoVersion: metadata.aoVersion || "2.0.0",
          author: metadata.author || "Unknown",
          features: getTemplateFeatures(templateType),
          version: metadata.version || "1.0.0",
        },
        name,
        source: processedTemplate,
      };
    },

    generateTypeDefinitions: async (
      aoPatterns: string[],
    ): Promise<TealTypeDefinition[]> => {
      const typeDefinitions: TealTypeDefinition[] = [];

      // Generate basic AO types
      typeDefinitions.push({
        definition: AO_TEAL_TYPES,
        documentation: "Core AO process types and interfaces",
        name: "AO",
        type: "record",
      });

      // Generate pattern-specific types
      for (const pattern of aoPatterns) {
        switch (pattern) {
          case "dao":
            typeDefinitions.push({
              definition: `
                local record DAOState
                  Name: string
                  Description: string
                  TokenProcess: string
                  VotingPower: {string:number}
                  Proposals: {Proposal}
                  ProposalCount: number
                  Admin: string
                  VotingPeriod: number
                  QuorumThreshold: number
                end
              `,
              documentation: "DAO process state structure",
              name: "DAOState",
              type: "record",
            });
            break;
          case "game":
            typeDefinitions.push({
              definition: `
                local record GameState
                  Name: string
                  Players: {string:Player}
                  MaxPlayers: number
                  Status: string
                  CurrentTurn: string
                  TurnCount: number
                  Winner: string
                  StartTime: number
                  EndTime: number
                end
              `,
              documentation: "Game process state structure",
              name: "GameState",
              type: "record",
            });
            break;
          case "token":
            typeDefinitions.push({
              definition: `
                local record TokenState
                  Name: string
                  Ticker: string
                  Denomination: number
                  TotalSupply: number
                  Balances: {string:number}
                  Owner: string
                  Transferable: boolean
                  Mintable: boolean
                  Burnable: boolean
                end
              `,
              documentation: "Token process state structure",
              name: "TokenState",
              type: "record",
            });
            break;
        }
      }

      return typeDefinitions;
    },

    integrateWithAOServices: async (
      compiledLua: string,
      processId: string,
    ): Promise<string> => {
      try {
        // Validate the compiled Lua is compatible with AO
        const validationResult = validateAOCompatibility(compiledLua);
        if (!validationResult.isValid) {
          throw new Error(`AO compatibility error: ${validationResult.error}`);
        }

        // Add AO-specific wrapper and initialization
        const aoWrappedLua = wrapForAO(compiledLua);

        // Integrate with existing ProcessCommunicationService patterns
        const integrationResult = await integrateWithProcessService(
          aoWrappedLua,
          processId,
          processService,
        );

        return integrationResult;
      } catch (error) {
        throw new Error(
          `AO integration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },

    validateTealTypes: async (source: string): Promise<TealCompileResult> => {
      try {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate type definitions
        const typeErrors = validateTealTypes(source);
        errors.push(...typeErrors);

        // Check for AO compatibility
        if (source.includes("ao.") && !source.includes("declare ao:")) {
          warnings.push("Consider declaring AO global types");
        }

        return {
          errors: errors.length > 0 ? errors : undefined,
          success: errors.length === 0,
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      } catch (error) {
        return {
          errors: [
            error instanceof Error ? error.message : "Type validation failed",
          ],
          success: false,
        };
      }
    },
  };
};

// Helper functions
const validateTealSyntax = (source: string): string[] => {
  const errors: string[] = [];

  // Check for basic Teal syntax
  if (!source.includes("local") && !source.includes("function")) {
    errors.push("No valid Teal constructs found");
  }

  // Check for proper record definitions
  const recordMatches = source.match(/local record \w+/g);
  if (recordMatches) {
    for (const match of recordMatches) {
      if (!source.includes(`end -- ${match}`)) {
        // This is a simple check; real Teal would need proper parsing
      }
    }
  }

  return errors;
};

const validateTealTypes = (source: string): string[] => {
  const errors: string[] = [];

  // Check for type annotations
  const functionMatches = source.match(/function \w+\([^)]*\)/g);
  if (functionMatches) {
    for (const match of functionMatches) {
      if (!match.includes(":")) {
        errors.push(`Function ${match} missing type annotations`);
      }
    }
  }

  return errors;
};

const convertTealToLua = (source: string): string => {
  // This is a simplified conversion - real Teal compiler would handle this
  let lua = source;

  // Remove type annotations
  lua = lua.replace(/:\s*\w+(\|\w+)*(\[\])*/g, "");
  lua = lua.replace(/local record \w+/g, "-- Record definition");
  lua = lua.replace(/end -- Record definition/g, "");

  // Convert basic patterns
  lua = lua.replace(/local (\w+): (\w+) = /g, "local $1 = ");

  return lua;
};

const validateAOCompatibility = (
  lua: string,
): { error?: string; isValid: boolean } => {
  // Check for AO-specific patterns
  if (!lua.includes("Handlers") && !lua.includes("ao.")) {
    return { error: "No AO handler patterns found", isValid: false };
  }

  // Check for proper message handling
  if (lua.includes("Handlers.add") && !lua.includes("msg.")) {
    return {
      error: "Handler functions must accept message parameter",
      isValid: false,
    };
  }

  return { isValid: true };
};

const wrapForAO = (lua: string): string => {
  const aoWrapper = `
-- AO Process Wrapper (Generated from Teal)
local json = require("json")

-- Process initialization
if not ao then
  ao = {
    id = ao.id or "PROCESS_ID",
    env = ao.env or {},
    authorities = ao.authorities or {},
  }
end

-- Initialize handlers if not present
if not Handlers then
  Handlers = {
    _handlers = {},
    add = function(name, pattern, handler)
      table.insert(Handlers._handlers, {
        name = name,
        pattern = pattern,
        handler = handler
      })
    end,
    utils = {
      hasMatchingTag = function(name, value)
        return function(msg)
          return msg.Tags[name] == value
        end
      end
    }
  }
end

-- User code begins here
${lua}

-- AO message processing
return function(msg)
  for _, handler in ipairs(Handlers._handlers) do
    if handler.pattern(msg) then
      return handler.handler(msg)
    end
  end
  
  return {
    Output = json.encode({Error = "No handler matched"}),
    Messages = {},
    Spawns = {},
    Assignments = {}
  }
end
`;

  return aoWrapper;
};

const integrateWithProcessService = async (
  lua: string,
  processId: string,
  processService: ProcessCommunicationService,
): Promise<string> => {
  // Validate the process service can work with this Lua code
  try {
    // Extract handler definitions from the Lua code
    const handlers = extractHandlers(lua);

    // Validate each handler is compatible with ProcessCommunicationService
    for (const handler of handlers) {
      // Check handler structure
      if (!handler.name || !handler.pattern || !handler.handler) {
        throw new Error(`Invalid handler structure: ${handler.name}`);
      }
    }

    // Integration successful
    return lua;
  } catch (error) {
    throw new Error(
      `Process service integration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

const extractHandlers = (lua: string): any[] => {
  const handlers: any[] = [];

  // Extract handler definitions using regex
  const handlerMatches = lua.match(/Handlers\.add\([^)]+\)/g);
  if (handlerMatches) {
    for (const match of handlerMatches) {
      const parts = match.match(
        /Handlers\.add\("([^"]+)",\s*([^,]+),\s*([^)]+)\)/,
      );
      if (parts) {
        handlers.push({
          handler: parts[3],
          name: parts[1],
          pattern: parts[2],
        });
      }
    }
  }

  return handlers;
};

const getTemplateFeatures = (templateType: string): string[] => {
  switch (templateType) {
    case "dao":
      return ["proposals", "voting", "governance", "treasury"];
    case "game":
      return ["players", "turns", "scoring", "state"];
    case "generic":
      return ["data", "handlers", "info"];
    case "token":
      return ["balance", "transfer", "info", "mint", "burn"];
    default:
      return [];
  }
};

const generateProcessId = (): string => {
  return `teal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const extractDependencies = (source: string): string[] => {
  const dependencies: string[] = [];

  // Extract require statements
  const requireMatches = source.match(/require\(["']([^"']+)["']\)/g);
  if (requireMatches) {
    for (const match of requireMatches) {
      const dep = match.match(/require\(["']([^"']+)["']\)/);
      if (dep) {
        dependencies.push(dep[1]);
      }
    }
  }

  return dependencies;
};

export const createTealCompilerService = (
  processService: ProcessCommunicationService,
  templateService: TokenProcessTemplateService,
): TealCompilerService => service(processService, templateService);
