/**
 * Configurable Token Lua Templates
 * Based on AOS_tools minting strategies with full configurability
 * Supports: Basic, Cascade, Double Mint, and Custom minting strategies
 */

export interface BasicMintConfig {
  buyToken: string; // Token used to mint (e.g., wAR address)
  maxMint: string; // Maximum mintable amount
  multiplier: number; // Conversion rate (e.g., 1000 tokens per 1 buyToken)
}

export interface CascadeMintConfig extends BasicMintConfig {
  baseMintLimit: string; // Starting mint limit (e.g., "100000")
  incrementBlocks: number; // Blocks between limit increases (e.g., 670 for ~24h)
  maxCascadeLimit: string; // Final maximum limit
}

export interface DoubleMintConfig {
  buyTokens: {
    [tokenAddress: string]: {
      enabled: boolean;
      multiplier: number;
    };
  };
  maxMint: string;
}

// Token Configuration Interfaces
export interface TokenConfig {
  adminAddress?: string;
  burnable?: boolean;
  denomination?: number;
  description?: string;
  // Initial Balance Allocations
  initialAllocations?: {
    [address: string]: string; // address -> balance amount
  };

  initialSupply?: string;

  logo?: string;
  // Economic Parameters
  maxMint?: string;

  // Minting-Specific Config
  mintingConfig?: BasicMintConfig | CascadeMintConfig | DoubleMintConfig;

  // Minting Strategy
  mintingStrategy: "basic" | "cascade" | "double_mint" | "none";

  // Basic Token Metadata
  name: string;
  ticker: string;
  // Advanced Options
  transferable?: boolean;
}

/**
 * Generate complete token Lua script with selected minting strategy
 */
export function generateTokenLua(config: TokenConfig): string {
  const baseTemplate = getBaseTokenTemplate(config);
  const mintingModule = getMintingModule(config);

  return combineTemplates(baseTemplate, mintingModule);
}

/**
 * Validate token configuration
 */
export function validateTokenConfig(config: TokenConfig): {
  errors: string[];
  valid: boolean;
} {
  const errors: string[] = [];

  // Basic validation
  if (!config.name || config.name.trim().length === 0) {
    errors.push("Token name is required");
  }

  if (!config.ticker || config.ticker.trim().length === 0) {
    errors.push("Token ticker is required");
  }

  if (config.ticker && config.ticker.length > 10) {
    errors.push("Token ticker must be 10 characters or less");
  }

  // Minting strategy validation
  if (config.mintingStrategy !== "none" && !config.mintingConfig) {
    errors.push("Minting configuration is required for selected strategy");
  }

  // Initial allocations validation
  if (config.initialAllocations) {
    let totalAllocated = 0;
    Object.entries(config.initialAllocations).forEach(([address, balance]) => {
      if (!address || address.trim().length === 0) {
        errors.push("Initial allocation address cannot be empty");
      }
      if (address.length < 20) {
        errors.push(
          `Initial allocation address "${address}" appears to be too short (should be 43 characters)`,
        );
      }

      const balanceNum = parseFloat(balance);
      if (isNaN(balanceNum) || balanceNum < 0) {
        errors.push(`Invalid balance "${balance}" for address "${address}"`);
      } else {
        totalAllocated += balanceNum;
      }
    });

    // Warn if initial allocations exceed initial supply
    if (config.initialSupply) {
      const initialSupplyNum = parseFloat(config.initialSupply);
      if (!isNaN(initialSupplyNum) && totalAllocated > initialSupplyNum) {
        errors.push(
          `Total initial allocations (${totalAllocated}) exceed initial supply (${initialSupplyNum}). Supply will be adjusted automatically.`,
        );
      }
    }
  }

  if (config.mintingConfig) {
    switch (config.mintingStrategy) {
      case "basic": {
        const basicConfig = config.mintingConfig as BasicMintConfig;
        if (!basicConfig.buyToken)
          errors.push("Buy token address is required for basic minting");
        if (!basicConfig.multiplier || basicConfig.multiplier <= 0)
          errors.push("Valid multiplier is required");
        if (!basicConfig.maxMint) errors.push("Max mint limit is required");
        break;
      }

      case "cascade": {
        const cascadeConfig = config.mintingConfig as CascadeMintConfig;
        if (!cascadeConfig.buyToken)
          errors.push("Buy token address is required for cascade minting");
        if (!cascadeConfig.multiplier || cascadeConfig.multiplier <= 0)
          errors.push("Valid multiplier is required");
        if (!cascadeConfig.baseMintLimit)
          errors.push("Base mint limit is required");
        if (
          !cascadeConfig.incrementBlocks ||
          cascadeConfig.incrementBlocks <= 0
        )
          errors.push("Valid increment blocks is required");
        if (!cascadeConfig.maxCascadeLimit)
          errors.push("Max cascade limit is required");
        break;
      }

      case "double_mint": {
        const doubleMintConfig = config.mintingConfig as DoubleMintConfig;
        if (
          !doubleMintConfig.buyTokens ||
          Object.keys(doubleMintConfig.buyTokens).length === 0
        ) {
          errors.push(
            "At least one buy token is required for double mint strategy",
          );
        }
        if (!doubleMintConfig.maxMint)
          errors.push("Max mint limit is required");

        // Validate each buy token
        Object.entries(doubleMintConfig.buyTokens).forEach(
          ([address, tokenConfig]) => {
            if (!address || address.trim().length === 0) {
              errors.push("Buy token address cannot be empty");
            }
            if (!tokenConfig.multiplier || tokenConfig.multiplier <= 0) {
              errors.push(`Invalid multiplier for buy token ${address}`);
            }
          },
        );
        break;
      }
    }
  }

  return {
    errors,
    valid: errors.length === 0,
  };
}

/**
 * Combine templates into final Lua script
 */
function combineTemplates(baseTemplate: string, mintingModule: string): string {
  return baseTemplate + mintingModule;
}

/**
 * Base token template with standard ERC-20-like functionality
 */
function getBaseTokenTemplate(config: TokenConfig): string {
  const {
    adminAddress = "",
    burnable = true,
    denomination = 12,
    description = "",
    initialAllocations = {},
    initialSupply = "0",
    logo = "",
    name,
    ticker,
    transferable = true,
  } = config;

  return `
-- Token: ${name} (${ticker})
-- Generated by Permamind Configurable Token System

local json = require('json')
local bint = require('.bint')(256)

-- Token Configuration
Name = Name or "${name}"
Ticker = Ticker or "${ticker}"
Logo = Logo or "${logo}"
Description = Description or "${description}"
Denomination = Denomination or ${denomination}

-- Token State
Balances = Balances or {}
TotalSupply = TotalSupply or "${initialSupply}"
Minted = Minted or "0"

${
  initialAllocations && Object.entries(initialAllocations).length > 0
    ? `-- Initial Balance Allocations (Explicit)
${Object.entries(initialAllocations)
  .map(([address, balance]) => `Balances["${address}"] = "${balance}"`)
  .join("")}

-- Update total supply to match initial allocations
local function updateSupplyForAllocations()
    local totalAllocated = bint("0")
    for address, balance in pairs(Balances) do
        if balance and balance ~= "0" then
            totalAllocated = bint.__add(totalAllocated, bint(balance))
        end
    end
    
    local currentSupply = bint(TotalSupply or "0")
    if bint.__gt(totalAllocated, currentSupply) then
        TotalSupply = tostring(totalAllocated)
    end
end

-- Call the function to update supply
updateSupplyForAllocations()`
    : config.mintingStrategy === "none" &&
        initialSupply &&
        parseInt(initialSupply) > 0
      ? `-- Auto-allocate initial supply to owner for 'none' strategy
Balances[ao.id] = "${initialSupply}"
-- Initial supply of ${initialSupply} allocated to owner: process ID`
      : "-- No initial allocations"
}

-- Admin Configuration
Owner = Owner or ao.id
${adminAddress ? `AdminAddress = AdminAddress or "${adminAddress}"` : ""}

-- Features Configuration
Transferable = ${transferable}
Burnable = ${burnable}

-- Utility Functions
local function isOwner(address)
    return address == Owner${adminAddress ? ` or address == AdminAddress` : ""}
end

local function hasBalance(address, amount)
    local balance = bint(Balances[address] or "0")
    return bint.__lt(bint(amount), balance) or bint.__eq(bint(amount), balance)
end

local function addBalance(address, amount)
    local currentBalance = bint(Balances[address] or "0")
    Balances[address] = tostring(bint.__add(currentBalance, bint(amount)))
end

local function subtractBalance(address, amount)
    local currentBalance = bint(Balances[address] or "0")
    Balances[address] = tostring(bint.__sub(currentBalance, bint(amount)))
end

-- Core Token Handlers

-- Get token information
Handlers.add('Info', Handlers.utils.hasMatchingTag('Action', 'Info'), function(msg)
    ao.send({
        Target = msg.From,
        Data = json.encode({
            Name = Name,
            Ticker = Ticker,
            Logo = Logo,
            Description = Description,
            Denomination = tostring(Denomination),
            TotalSupply = TotalSupply,
            Owner = Owner,
            Transferable = Transferable,
            Burnable = Burnable,
            MintingStrategy = "${config.mintingStrategy}",
            ProcessId = ao.id
        })
    })
end)

-- Get balance for an address
Handlers.add('Balance', Handlers.utils.hasMatchingTag('Action', 'Balance'), function(msg)
    local target = msg.Tags.Target or msg.From
    local balance = Balances[target] or "0"
    
    ao.send({
        Target = msg.From,
        Data = json.encode({
            Account = target,
            Balance = balance,
            Ticker = Ticker,
            Data = balance
        })
    })
end)

-- Get all balances
Handlers.add('Balances', Handlers.utils.hasMatchingTag('Action', 'Balances'), function(msg)
    ao.send({
        Target = msg.From,
        Data = json.encode(Balances)
    })
end)

${
  transferable
    ? `
-- Transfer tokens
Handlers.add('Transfer', Handlers.utils.hasMatchingTag('Action', 'Transfer'), function(msg)
    local recipient = msg.Tags.Recipient
    local amount = msg.Tags.Quantity or msg.Tags.Amount
    
    assert(recipient, 'Recipient is required')
    assert(amount, 'Quantity is required')
    assert(hasBalance(msg.From, amount), 'Insufficient balance')
    
    subtractBalance(msg.From, amount)
    addBalance(recipient, amount)
    
    -- Send debit notice to sender
    ao.send({
        Target = msg.From,
        Action = 'Debit-Notice',
        Recipient = recipient,
        Quantity = amount,
        Data = "Transfer successful"
    })
    
    -- Send credit notice to recipient
    ao.send({
        Target = recipient,
        Action = 'Credit-Notice',
        Sender = msg.From,
        Quantity = amount,
        Data = "Transfer received"
    })
end)
`
    : ""
}

${
  burnable
    ? `
-- Burn tokens
Handlers.add('Burn', Handlers.utils.hasMatchingTag('Action', 'Burn'), function(msg)
    local amount = msg.Tags.Quantity or msg.Tags.Amount
    
    assert(amount, 'Quantity is required')
    assert(hasBalance(msg.From, amount), 'Insufficient balance')
    
    subtractBalance(msg.From, amount)
    TotalSupply = tostring(bint.__sub(bint(TotalSupply), bint(amount)))
    
    ao.send({
        Target = msg.From,
        Action = 'Burn-Notice',
        Quantity = amount,
        Data = "Tokens burned successfully"
    })
end)
`
    : ""
}

-- Mint tokens (owner only, if no specific minting strategy)
${
  config.mintingStrategy === "none"
    ? `
Handlers.add('Mint', Handlers.utils.hasMatchingTag('Action', 'Mint'), function(msg)
    assert(isOwner(msg.From), 'Only owner can mint tokens')
    
    local recipient = msg.Tags.Recipient or msg.From
    local amount = msg.Tags.Quantity or msg.Tags.Amount
    
    assert(amount, 'Quantity is required')
    
    addBalance(recipient, amount)
    TotalSupply = tostring(bint.__add(bint(TotalSupply), bint(amount)))
    Minted = tostring(bint.__add(bint(Minted), bint(amount)))
    
    ao.send({
        Target = recipient,
        Action = 'Credit-Notice',
        Quantity = amount,
        Data = "Tokens minted"
    })
end)
`
    : ""
}

-- Transfer ownership (current owner only)
Handlers.add('Transfer-Ownership', Handlers.utils.hasMatchingTag('Action', 'Transfer-Ownership'), function(msg)
    assert(isOwner(msg.From), 'Only owner can transfer ownership')
    
    local newOwner = msg.Tags.NewOwner
    assert(newOwner, 'NewOwner is required')
    
    Owner = newOwner
    
    ao.send({
        Target = msg.From,
        Data = "Ownership transferred to " .. newOwner
    })
end)`;
}

/**
 * Basic minting strategy - simple multiplier-based minting
 */
function getBasicMintTemplate(config: BasicMintConfig): string {
  const { buyToken, maxMint, multiplier } = config;

  return `

-- Basic Minting Strategy
-- Basic Minting Configuration
BuyToken = "${buyToken}"
Multiplier = ${multiplier}
MaxMint = "${maxMint}"
-- Basic Minting Handler
Handlers.prepend('BasicMint', 
  function(msg)
    return msg.From == BuyToken and msg.Action == "Credit-Notice"
  end,
  function(msg)
    local amountToMint = tostring(bint(msg.Quantity) * bint(Multiplier))
    local totalAfterMint = bint.__add(bint(Minted), bint(amountToMint))
    
    if bint.__le(totalAfterMint, bint(MaxMint)) then
      -- Mint full amount
      addBalance(msg.Sender, amountToMint)
      TotalSupply = tostring(bint.__add(bint(TotalSupply), bint(amountToMint)))
      Minted = tostring(totalAfterMint)
      
      ao.send({
        Target = msg.Sender,
        Action = 'Mint-Success',
        Quantity = amountToMint,
        Data = "Tokens minted successfully"
      })
    else
      -- Partial mint or refund
      local remainingMintable = bint.__sub(bint(MaxMint), bint(Minted))
      
      if bint.__gt(remainingMintable, bint("0")) then
        -- Partial mint
        addBalance(msg.Sender, tostring(remainingMintable))
        TotalSupply = tostring(bint.__add(bint(TotalSupply), remainingMintable))
        Minted = MaxMint
        
        -- Calculate refund
        local tokensUsedForMinting = bint.__div(remainingMintable, bint(Multiplier))
        local refundAmount = bint.__sub(bint(msg.Quantity), tokensUsedForMinting)
        
        ao.send({
          Target = msg.Sender,
          Action = 'Mint-Partial',
          Quantity = tostring(remainingMintable),
          Data = "Partial mint completed"
        })
        
        if bint.__gt(refundAmount, bint("0")) then
          ao.send({
            Target = BuyToken,
            Action = 'Transfer',
            Recipient = msg.Sender,
            Quantity = tostring(refundAmount)
          })
        end
      else
        -- Full refund
        ao.send({
          Target = BuyToken,
          Action = 'Transfer',
          Recipient = msg.Sender,
          Quantity = msg.Quantity
        })
        
        ao.send({
          Target = msg.Sender,
          Action = 'Mint-Failed',
          Data = "Minting limit reached. Full refund issued."
        })
      end
    end
  end
)`;
}

/**
 * Cascade minting strategy - progressive limit increases over time
 */
function getCascadeMintTemplate(config: CascadeMintConfig): string {
  const {
    baseMintLimit,
    buyToken,
    incrementBlocks,
    maxCascadeLimit,
    maxMint,
    multiplier,
  } = config;

  return `

-- Cascade Minting Strategy
-- Cascade Minting Configuration
BuyToken = "${buyToken}"
Multiplier = ${multiplier}
MaxMint = "${maxMint}"
BaseMintLimit = "${baseMintLimit}"
IncrementBlocks = ${incrementBlocks}
MaxCascadeLimit = "${maxCascadeLimit}"
-- Calculate current mint limit based on block height
local function getCurrentMintLimit()
    local currentHeight = bint(ao.block or "0")
    local increments = bint.__div(currentHeight, bint(IncrementBlocks))
    local additionalLimit = bint.__mul(increments, bint(BaseMintLimit))
    local currentLimit = bint.__add(bint(BaseMintLimit), additionalLimit)
    
    -- Cap at maximum cascade limit
    if bint.__gt(currentLimit, bint(MaxCascadeLimit)) then
        return MaxCascadeLimit
    end
    
    return tostring(currentLimit)
end

-- Cascade Minting Handler
Handlers.prepend('CascadeMint',
  function(msg)
    return msg.From == BuyToken and msg.Action == "Credit-Notice"
  end,
  function(msg)
    local amountToMint = tostring(bint(msg.Quantity) * bint(Multiplier))
    local currentMintLimit = getCurrentMintLimit()
    local totalAfterMint = bint.__add(bint(Minted), bint(amountToMint))
    
    if bint.__le(totalAfterMint, bint(currentMintLimit)) then
      -- Mint full amount
      addBalance(msg.Sender, amountToMint)
      TotalSupply = tostring(bint.__add(bint(TotalSupply), bint(amountToMint)))
      Minted = tostring(totalAfterMint)
      
      ao.send({
        Target = msg.Sender,
        Action = 'Cascade-Mint-Success',
        Quantity = amountToMint,
        CurrentLimit = currentMintLimit,
        Data = "Tokens minted successfully"
      })
    else
      -- Partial mint or refund
      local remainingMintable = bint.__sub(bint(currentMintLimit), bint(Minted))
      
      if bint.__gt(remainingMintable, bint("0")) then
        -- Partial mint
        addBalance(msg.Sender, tostring(remainingMintable))
        TotalSupply = tostring(bint.__add(bint(TotalSupply), remainingMintable))
        Minted = currentMintLimit
        
        -- Calculate refund
        local tokensUsedForMinting = bint.__div(remainingMintable, bint(Multiplier))
        local refundAmount = bint.__sub(bint(msg.Quantity), tokensUsedForMinting)
        
        ao.send({
          Target = msg.Sender,
          Action = 'Cascade-Mint-Partial',
          Quantity = tostring(remainingMintable),
          CurrentLimit = currentMintLimit,
          Data = "Partial mint completed"
        })
        
        if bint.__gt(refundAmount, bint("0")) then
          ao.send({
            Target = BuyToken,
            Action = 'Transfer',
            Recipient = msg.Sender,
            Quantity = tostring(refundAmount)
          })
        end
      else
        -- Full refund
        ao.send({
          Target = BuyToken,
          Action = 'Transfer',
          Recipient = msg.Sender,
          Quantity = msg.Quantity
        })
        
        ao.send({
          Target = msg.Sender,
          Action = 'Cascade-Mint-Failed',
          CurrentLimit = currentMintLimit,
          Data = "Current minting limit reached. Full refund issued."
        })
      end
    end
  end
)

-- Handler to check current mint limit
Handlers.add('MintLimit', Handlers.utils.hasMatchingTag('Action', 'MintLimit'), function(msg)
    ao.send({
        Target = msg.From,
        Data = json.encode({
            CurrentLimit = getCurrentMintLimit(),
            Minted = Minted,
            BaseMintLimit = BaseMintLimit,
            IncrementBlocks = IncrementBlocks,
            MaxCascadeLimit = MaxCascadeLimit,
            CurrentBlock = ao.block or "0"
        })
    })
end)`;
}

/**
 * Double mint strategy - multiple buy tokens with different multipliers
 */
function getDoubleMintTemplate(config: DoubleMintConfig): string {
  const { buyTokens, maxMint } = config;

  const buyTokenConfigs = Object.entries(buyTokens)
    .filter(([, config]) => config.enabled)
    .map(([address, config]) => `  ["${address}"] = ${config.multiplier}`)
    .join(",");

  return `

-- Double Mint Strategy
-- Double Mint Configuration
MaxMint = "${maxMint}"
BuyTokenMultipliers = {
${buyTokenConfigs}
}
-- Double Minting Handler
Handlers.prepend('DoubleMint',
  function(msg)
    return BuyTokenMultipliers[msg.From] ~= nil and msg.Action == "Credit-Notice"
  end,
  function(msg)
    local multiplier = BuyTokenMultipliers[msg.From]
    local amountToMint = tostring(bint(msg.Quantity) * bint(multiplier))
    local totalAfterMint = bint.__add(bint(Minted), bint(amountToMint))
    
    if bint.__le(totalAfterMint, bint(MaxMint)) then
      -- Mint full amount
      addBalance(msg.Sender, amountToMint)
      TotalSupply = tostring(bint.__add(bint(TotalSupply), bint(amountToMint)))
      Minted = tostring(totalAfterMint)
      
      ao.send({
        Target = msg.Sender,
        Action = 'Double-Mint-Success',
        Quantity = amountToMint,
        BuyToken = msg.From,
        Multiplier = tostring(multiplier),
        Data = "Tokens minted successfully"
      })
    else
      -- Partial mint or refund
      local remainingMintable = bint.__sub(bint(MaxMint), bint(Minted))
      
      if bint.__gt(remainingMintable, bint("0")) then
        -- Partial mint
        addBalance(msg.Sender, tostring(remainingMintable))
        TotalSupply = tostring(bint.__add(bint(TotalSupply), remainingMintable))
        Minted = MaxMint
        
        -- Calculate refund
        local tokensUsedForMinting = bint.__div(remainingMintable, bint(multiplier))
        local refundAmount = bint.__sub(bint(msg.Quantity), tokensUsedForMinting)
        
        ao.send({
          Target = msg.Sender,
          Action = 'Double-Mint-Partial',
          Quantity = tostring(remainingMintable),
          BuyToken = msg.From,
          Data = "Partial mint completed"
        })
        
        if bint.__gt(refundAmount, bint("0")) then
          ao.send({
            Target = msg.From,
            Action = 'Transfer',
            Recipient = msg.Sender,
            Quantity = tostring(refundAmount)
          })
        end
      else
        -- Full refund
        ao.send({
          Target = msg.From,
          Action = 'Transfer',
          Recipient = msg.Sender,
          Quantity = msg.Quantity
        })
        
        ao.send({
          Target = msg.Sender,
          Action = 'Double-Mint-Failed',
          Data = "Minting limit reached. Full refund issued."
        })
      end
    end
  end
)

-- Handler to check buy token configurations
Handlers.add('BuyTokens', Handlers.utils.hasMatchingTag('Action', 'BuyTokens'), function(msg)
    ao.send({
        Target = msg.From,
        Data = json.encode(BuyTokenMultipliers)
    })
end)`;
}

/**
 * Get minting module based on strategy
 */
function getMintingModule(config: TokenConfig): string {
  switch (config.mintingStrategy) {
    case "basic":
      return getBasicMintTemplate(config.mintingConfig as BasicMintConfig);
    case "cascade":
      return getCascadeMintTemplate(config.mintingConfig as CascadeMintConfig);
    case "double_mint":
      return getDoubleMintTemplate(config.mintingConfig as DoubleMintConfig);
    case "none":
      return "";
    default:
      throw new Error(`Unknown minting strategy: ${config.mintingStrategy}`);
  }
}

/**
 * Generate example configurations for different strategies
 */
export const exampleConfigs = {
  basic: {
    mintingConfig: {
      buyToken: "xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10", // wAR
      maxMint: "1000000000000000000",
      multiplier: 1000,
    },
    mintingStrategy: "basic" as const,
    name: "Basic Mint Token",
    ticker: "BMT",
  },

  cascade: {
    mintingConfig: {
      baseMintLimit: "100000000000000000",
      buyToken: "xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10", // wAR
      incrementBlocks: 670,
      maxCascadeLimit: "1000000000000000000000",
      maxMint: "1000000000000000000",
      multiplier: 1000,
    },
    mintingStrategy: "cascade" as const,
    name: "Cascade Mint Token",
    ticker: "CMT",
  },

  doubleMint: {
    mintingConfig: {
      buyTokens: {
        OT9qTE2467gcozb2g8R6D6N3nQS94ENcaAIJfUzHCww: {
          enabled: true,
          // TRUNK
          multiplier: 500,
        },
        xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10: {
          enabled: true,
          // wAR
          multiplier: 1000,
        },
      },
      maxMint: "1000000000000000000",
    },
    mintingStrategy: "double_mint" as const,
    name: "Double Mint Token",
    ticker: "DMT",
  },

  simple: {
    initialSupply: "1000000000000000000",
    mintingStrategy: "none" as const,
    name: "Simple Token",
    ticker: "SIMP",
  },

  withAllocations: {
    initialAllocations: {
      alice_address_example_123456789012345678901: "300000000000000000", // 30% to early investor
      bob_address_example_123456789012345678901234: "200000000000000000", // 20% to team
      Y3EMIurCZKqO8Dm_86dsbdHNdwM86Yswk7v4hsGp45I: "500000000000000000", // 50% to founder
    },
    initialSupply: "1000000000000000000",
    mintingStrategy: "none" as const,
    name: "Pre-allocated Token",
    ticker: "ALLOC",
  },
};

export const luaModule = generateTokenLua;
