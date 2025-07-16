# AR.IO Network Process

Decentralized gateway network management system for the AR.IO ecosystem on Arweave AO. Handles gateway operations, token economics, ArNS domain registry, and network governance.

## joinNetwork

Register as a new gateway operator in the AR.IO network with required stake

- qty: amount of IO tokens to stake as gateway operator (required)
- allowDelegatedStaking: enable others to delegate stake to this gateway (optional)
- note: description or details about the gateway (optional)
- properties: arweave transaction ID containing gateway configuration (optional)
- autoStake: automatically stake additional tokens if available (optional)
- observerWallet: wallet address for network observations (optional)

## leaveNetwork

Remove gateway from network and initiate stake withdrawal process

- immediately: bypass withdrawal delay and exit immediately (optional)

## updateGatewaySettings

Modify existing gateway configuration and settings

- allowDelegatedStaking: enable or disable delegation (optional)
- note: update gateway description (optional)
- properties: new arweave transaction ID for gateway config (optional)
- autoStake: modify auto-staking behavior (optional)
- observerWallet: change observer wallet address (optional)

## delegateStake

Delegate IO tokens to support an existing gateway operator

- target: gateway address to delegate stake to (required)
- qty: amount of IO tokens to delegate (required)

## decreaseDelegateStake

Reduce amount of tokens delegated to a gateway operator

- target: gateway address to decrease delegation (required)
- qty: amount of tokens to withdraw from delegation (required)

## increaseStake

Add more IO tokens to existing gateway stake

- qty: additional amount of IO tokens to stake (required)

## decreaseStake

Reduce gateway stake and initiate withdrawal

- qty: amount of IO tokens to withdraw from stake (required)

## transfer

Send IO tokens from your account to another address

- recipient: wallet address to receive tokens (required)
- qty: amount of IO tokens to transfer (required)

## createVault

Create time-locked token vault with scheduled release

- qty: amount of IO tokens to lock in vault (required)
- lockLength: duration in milliseconds to lock tokens (required)

## extendVault

Extend lock period for existing token vault

- vaultId: identifier of vault to extend (required)
- extendLength: additional milliseconds to extend lock (required)

## buyRecord

Purchase ArNS domain name registration

- name: domain name to register without .ar suffix (required)
- years: number of years for lease duration (optional)
- type: registration type either lease or permabuy (optional)
- auction: enable auction for premium names (optional)

## extendLease

Renew existing ArNS domain name lease

- name: domain name to extend (required)
- years: additional years to extend lease (required)

## increaseUndernameLimit

Expand subdomain capacity for owned ArNS record

- name: domain name to increase limit for (required)
- qty: number of additional subdomains to allow (required)

## setPrimaryName

Designate primary ArNS domain for your address

- name: domain name to set as primary (required)

## balance

Get IO token balance for any account

- target: wallet address to check balance for (optional)

## balances

Get all token balances across network accounts

- cursor: pagination cursor for large result sets (optional)
- limit: maximum number of results to return (optional)

## info

Get detailed information about the AR.IO network process

## totalSupply

Get total supply of IO tokens in circulation

## gateways

Get list of all registered gateway operators

- cursor: pagination cursor for large result sets (optional)
- limit: maximum number of results to return (optional)
- sortBy: field to sort results by (optional)
- sortOrder: asc or desc for sort direction (optional)

## gateway

Get detailed information about specific gateway

- address: gateway operator wallet address (required)

## arnsRecords

Get list of all ArNS domain registrations

- cursor: pagination cursor for large result sets (optional)
- limit: maximum number of results to return (optional)
- sortBy: field to sort results by (optional)
- sortOrder: asc or desc for sort direction (optional)

## arnsRecord

Get detailed information about specific ArNS domain

- name: domain name to lookup (required)

## epoch

Get information about current or specific epoch

- epochIndex: specific epoch number to query (optional)

## epochs

Get list of historical epochs

- cursor: pagination cursor for large result sets (optional)
- limit: maximum number of results to return (optional)

## observations

Get network observations for specific epoch

- epochIndex: epoch number to get observations for (required)

## distributionForEpoch

Get reward distribution details for specific epoch

- epochIndex: epoch number to get distribution for (required)

## prescribedObservers

Get list of prescribed observers for specific epoch

- epochIndex: epoch number to get observers for (required)

## tokenCost

Get current cost to purchase ArNS domain

- intent: domain registration intent (required)
- name: domain name to check cost for (required)
- years: number of years for cost calculation (optional)
- type: lease or permabuy for cost type (optional)

## demandFactor

Get current demand factor for ArNS pricing

## priceForInteraction

Get price for specific network interaction

- intent: type of interaction to price (required)
- name: domain name for ArNS interactions (optional)
- years: years for lease pricing (optional)
- quantity: amount for staking interactions (optional)