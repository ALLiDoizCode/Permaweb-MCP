import type { ProcessDefinition } from "../services/ProcessCommunicationService.js";

/**
 * Default AO Token Process Template
 * Based on AO Cookbook token.lua standards
 * Provides natural language integration for standard token operations
 */
export const DEFAULT_TOKEN_PROCESS: ProcessDefinition = {
  handlers: [
    {
      action: "Transfer",
      description: "Transfer tokens from your account to another user",
      examples: [
        "Transfer 100 tokens to alice with memo 'payment for services'",
        "Transfer 50 tokens to xyz789", 
        "Send tokens to bob via transfer",
      ],
      isWrite: true,
      parameters: [
        {
          description: "wallet address to send tokens to (required)",
          name: "recipient",
          required: true,
          type: "string",
        },
        {
          description: "number of tokens to transfer (required)",
          name: "quantity",
          required: true,
          type: "number",
        },
        {
          description: "optional message to include with transfer (optional)",
          name: "memo",
          required: false,
          type: "string",
        },
      ],
    },
    {
      action: "Balance",
      description: "Get the current token balance for an account",
      examples: [
        "Check balance for xyz789",
        "What's my current balance?",
        "Get balance",
        "Show token balance for alice",
      ],
      isWrite: false,
      parameters: [
        {
          description: "wallet address to check balance (optional, defaults to caller)",
          name: "target",
          required: false,
          type: "string",
        },
      ],
    },
    {
      action: "Info",
      description: "Get comprehensive token information including name, symbol, and metadata",
      examples: [
        "Get token info",
        "Show token info",
        "Token info details",
        "Info about this token",
      ],
      isWrite: false,
      parameters: [],
    },
    {
      action: "Balances",
      description: "Get all token balances for all accounts",
      examples: [
        "Show all balances",
        "Get all token balances",
        "List all balances",
        "All account balances",
      ],
      isWrite: false,
      parameters: [],
    },
    {
      action: "Mint",
      description: "Create new tokens (admin only)",
      examples: [
        "Mint 1000 tokens for alice",
        "Mint 500 new tokens for bob",
        "Mint 100 tokens to xyz789",
      ],
      isWrite: true,
      parameters: [
        {
          description: "address to receive new tokens (required)",
          name: "recipient",
          required: true,
          type: "string",
        },
        {
          description: "number of tokens to create (required)",
          name: "quantity",
          required: true,
          type: "number",
        },
      ],
    },
    {
      action: "Burn",
      description: "Destroy tokens from your account",
      examples: [
        "Burn 100 tokens",
        "Burn 50 tokens from my account",
        "Burn 25 tokens to remove them",
      ],
      isWrite: true,
      parameters: [
        {
          description: "number of tokens to destroy (required)",
          name: "quantity",
          required: true,
          type: "number",
        },
      ],
    },
    {
      action: "TotalSupply",
      description: "Get the total supply of tokens",
      examples: [
        "Get totalsupply",
        "What's the totalsupply?",
        "Show totalsupply",
        "Check totalsupply",
      ],
      isWrite: false,
      parameters: [],
    },
    {
      action: "Name",
      description: "Get the token name",
      examples: [
        "What's the token name?",
        "Get token name",
        "Show name",
      ],
      isWrite: false,
      parameters: [],
    },
    {
      action: "Symbol",
      description: "Get the token symbol/ticker",
      examples: [
        "What's the token symbol?",
        "Get token symbol",
        "Show symbol",
      ],
      isWrite: false,
      parameters: [],
    },
    {
      action: "Decimals",
      description: "Get the number of decimal places",
      examples: [
        "How many decimals?",
        "Get decimals",
        "Show decimals",
      ],
      isWrite: false,
      parameters: [],
    },
    {
      action: "Owner",
      description: "Get the contract owner/admin address",
      examples: [
        "Who is the owner?",
        "Get contract owner",
        "Show owner address",
      ],
      isWrite: false,
      parameters: [],
    },
    {
      action: "Transfer-Ownership",
      description: "Transfer ownership of the contract to another address (owner only)",
      examples: [
        "Transfer-ownership to alice",
        "Transfer-ownership to bob",
        "Transfer-ownership to xyz789",
      ],
      isWrite: true,
      parameters: [
        {
          description: "address of the new owner (required)",
          name: "newOwner",
          required: true,
          type: "string",
        },
      ],
    },
    {
      action: "Approve",
      description: "Approve another address to spend tokens on your behalf",
      examples: [
        "Approve alice to spend 100 tokens",
        "Approve bob to use 50 tokens",
        "Approve xyz789 for 25 tokens",
      ],
      isWrite: true,
      parameters: [
        {
          description: "address to approve for spending (required)",
          name: "spender",
          required: true,
          type: "string",
        },
        {
          description: "amount of tokens to approve (required)",
          name: "quantity",
          required: true,
          type: "number",
        },
      ],
    },
    {
      action: "Allowance",
      description: "Check how many tokens an address is approved to spend",
      examples: [
        "Check allowance from alice to bob",
        "Get spending allowance from xyz789",
        "Show allowance details",
      ],
      isWrite: false,
      parameters: [
        {
          description: "address of the token owner (required)",
          name: "owner",
          required: true,
          type: "string",
        },
        {
          description: "address of the approved spender (required)",
          name: "spender",
          required: true,
          type: "string",
        },
      ],
    },
    {
      action: "TransferFrom",
      description: "Transfer tokens from one address to another using allowance",
      examples: [
        "TransferFrom 100 tokens from alice to bob",
        "TransferFrom 50 tokens from xyz789 to charlie",
        "TransferFrom alice to bob amount 25",
      ],
      isWrite: true,
      parameters: [
        {
          description: "address to transfer tokens from (required)",
          name: "from",
          required: true,
          type: "string",
        },
        {
          description: "address to transfer tokens to (required)",
          name: "to",
          required: true,
          type: "string",
        },
        {
          description: "number of tokens to transfer (required)",
          name: "quantity",
          required: true,
          type: "number",
        },
      ],
    },
  ],
  name: "AO Token Contract",
  processId: "", // Will be populated dynamically
};

/**
 * Enhanced token process detection patterns
 * Used to identify if a process is likely a token contract
 */
export const TOKEN_DETECTION_PATTERNS = {
  // Core handlers that must be present
  coreHandlers: ["transfer", "balance"],
  
  // Common token handler names
  handlers: [
    "transfer",
    "balance",
    "mint",
    "burn",
    "totalSupply",
    "name",
    "symbol",
    "decimals",
    "owner",
    "approve",
    "allowance",
    "transferFrom",
  ],
  
  // Keywords that suggest token functionality
  keywords: [
    "token",
    "balance",
    "transfer",
    "mint",
    "burn",
    "supply",
    "allowance",
    "approve",
    "erc20",
    "fungible",
  ],
  
  // Minimum handlers needed to be considered a token
  minHandlers: 3,
};

/**
 * Common token operation patterns for natural language processing
 */
export const TOKEN_NLS_PATTERNS = {
  // Balance patterns
  balance: [
    /(?:check|get|show)\s+(?:my\s+)?(?:token\s+)?balance/i,
    /balance\s+(?:for\s+)?(\w+)?/i,
    /how\s+many\s+tokens?\s+(?:do\s+)?(?:i\s+)?(?:have|own)/i,
    /what(?:'s|\s+is)\s+(?:my\s+)?(?:token\s+)?balance/i,
  ],
  
  // Burn patterns
  burn: [
    /burn\s+(\d+(?:\.\d+)?)\s+tokens?/i,
    /destroy\s+(\d+(?:\.\d+)?)\s+tokens?/i,
    /remove\s+(\d+(?:\.\d+)?)\s+tokens?/i,
  ],
  
  // Info patterns
  info: [
    /(?:get|show|what(?:'s|\s+is))\s+(?:the\s+)?(?:token\s+)?(name|symbol|decimals|total\s+supply)/i,
    /who\s+(?:is\s+)?(?:the\s+)?owner/i,
    /contract\s+(?:owner|admin)/i,
  ],
  
  // Mint patterns
  mint: [
    /mint\s+(\d+(?:\.\d+)?)\s+(?:tokens?\s+)?(?:for|to)\s+(\w+)/i,
    /create\s+(\d+(?:\.\d+)?)\s+(?:new\s+)?tokens?\s+(?:for|to)\s+(\w+)/i,
    /issue\s+(\d+(?:\.\d+)?)\s+tokens?\s+(?:for|to)\s+(\w+)/i,
  ],
  
  // Transfer patterns
  transfer: [
    /send\s+(\d+(?:\.\d+)?)\s+(?:tokens?\s+)?to\s+(\w+)/i,
    /transfer\s+(\d+(?:\.\d+)?)\s+(?:tokens?\s+)?to\s+(\w+)/i,
    /give\s+(\w+)\s+(\d+(?:\.\d+)?)\s+tokens?/i,
    /pay\s+(\w+)\s+(\d+(?:\.\d+)?)\s+tokens?/i,
  ],
};

/**
 * Extract token operation from natural language using enhanced patterns
 */
export function extractTokenOperation(request: string): {
  confidence: number;
  operation: string;
  parameters: Record<string, unknown>;
} | null {
  // const requestLower = request.toLowerCase(); // Future: use for advanced matching
  
  // Check transfer patterns
  for (const pattern of TOKEN_NLS_PATTERNS.transfer) {
    const match = request.match(pattern);
    if (match) {
      // Handle different capture group orders for different patterns
      let recipient: string;
      let amount: number;
      
      if (pattern === TOKEN_NLS_PATTERNS.transfer[0] || pattern === TOKEN_NLS_PATTERNS.transfer[1]) {
        // send/transfer patterns: (amount) (recipient)
        amount = parseFloat(match[1]);
        recipient = match[2];
      } else {
        // give/pay patterns: (recipient) (amount)
        recipient = match[1];
        amount = parseFloat(match[2]);
      }
      
      return {
        confidence: 0.9,
        operation: "transfer",
        parameters: { amount, recipient },
      };
    }
  }
  
  // Check balance patterns
  for (const pattern of TOKEN_NLS_PATTERNS.balance) {
    const match = request.match(pattern);
    if (match) {
      return {
        confidence: 0.85,
        operation: "balance",
        parameters: match[1] ? { account: match[1] } : {},
      };
    }
  }
  
  // Check mint patterns
  for (const pattern of TOKEN_NLS_PATTERNS.mint) {
    const match = request.match(pattern);
    if (match) {
      return {
        confidence: 0.9,
        operation: "mint",
        parameters: {
          amount: parseFloat(match[1]),
          recipient: match[2],
        },
      };
    }
  }
  
  // Check burn patterns
  for (const pattern of TOKEN_NLS_PATTERNS.burn) {
    const match = request.match(pattern);
    if (match) {
      return {
        confidence: 0.9,
        operation: "burn",
        parameters: {
          amount: parseFloat(match[1]),
        },
      };
    }
  }
  
  // Check info patterns
  for (const pattern of TOKEN_NLS_PATTERNS.info) {
    const match = request.match(pattern);
    if (match) {
      const infoType = match[1]?.toLowerCase().replace(/\s+/g, '');
      const operationMap: Record<string, string> = {
        decimals: "decimals",
        name: "name", 
        owner: "owner",
        symbol: "symbol",
        totalsupply: "totalSupply",
      };
      
      const operation = operationMap[infoType] || "info";
      return {
        confidence: 0.8,
        operation,
        parameters: {},
      };
    }
  }
  
  return null;
}

/**
 * Get default token process with specified process ID
 */
export function getDefaultTokenProcess(processId: string): ProcessDefinition {
  return {
    ...DEFAULT_TOKEN_PROCESS,
    processId,
  };
}

/**
 * Check if a process definition matches token patterns
 */
export function isTokenProcess(handlers: string[]): boolean {
  const lowerHandlers = handlers.map(h => h.toLowerCase());
  
  // Check if it has core token handlers
  const hasCoreHandlers = TOKEN_DETECTION_PATTERNS.coreHandlers.every(
    core => lowerHandlers.includes(core)
  );
  
  if (hasCoreHandlers) return true;
  
  // Check if it has enough token-like handlers
  const tokenHandlerCount = TOKEN_DETECTION_PATTERNS.handlers.filter(
    handler => lowerHandlers.includes(handler)
  ).length;
  
  return tokenHandlerCount >= TOKEN_DETECTION_PATTERNS.minHandlers;
}
