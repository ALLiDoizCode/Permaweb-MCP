# CreateToken Minting Guide

## How It Works

The `createToken` command creates tokens in two steps:

1. **Deploy Contract**: Creates an AO process and deploys token smart contract
2. **Initial Mint**: If `initialSupply` is specified, mints tokens to creator

## Basic Flow

```
createToken → Create AO Process → Deploy Lua Contract → Mint Initial Supply
```

## Minting Strategies

### None (Default)

- Only token owner can mint
- Manual minting via "Mint" messages

### Basic

- Automatic minting when buy tokens are received
- Fixed exchange rate (e.g., 1 buy token = 100 new tokens)

```typescript
{
  mintingStrategy: "basic",
  buyToken: "token_process_id",
  multiplier: 100,
  maxMint: "1000000000"
}
```

### Cascade

- Minting limits increase over time based on block height
- Progressive tokenomics

```typescript
{
  mintingStrategy: "cascade",
  baseMintLimit: "100000",
  incrementBlocks: 1000
}
```

### Double Mint

- Multiple buy tokens with different rates
- Flexible multi-token economics

```typescript
{
  mintingStrategy: "double_mint",
  buyTokenConfigs: [
    { token: "token1", multiplier: 100 },
    { token: "token2", multiplier: 50 }
  ]
}
```

## Technical Details

### Implementation Files

- `CreateTokenCommand.ts` - Main command logic
- `TokenLuaService.ts` - Contract code generation
- `TokenService.ts` - Process creation
- `process.ts` - AO messaging

### Key Functions

- `generateTokenLua()` - Creates contract code
- `createProcess()` - Spawns AO process
- `evalProcess()` - Deploys contract
- `send()` - Sends mint messages

### Initial Supply Minting

```typescript
// Wait for process readiness
await new Promise((resolve) => setTimeout(resolve, 3000));

// Send mint message
await send(signer, processId, [
  { name: "Action", value: "Mint" },
  { name: "Recipient", value: publicKey },
  { name: "Quantity", value: initialSupply },
]);
```

## Error Handling

- Parameter validation with Zod schemas
- Supply limit enforcement
- Process readiness checks
- Comprehensive error messages
