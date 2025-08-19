# Story 9.5: Fix Missing ADP Parameter Definitions in Generated Code

## Problem Statement

The `generateLuaProcess` tool generates ADP-compliant Info handlers but **completely omits parameter definitions** in the handler metadata, breaking the core ADP promise of self-documenting processes.

## Root Cause

**Location**: `src/services/LuaCodeGeneratorService.ts`

The code generation process:

1. ✅ Generates working Lua handler code with parameter usage
2. ✅ Creates ADP Info handler template
3. ❌ **FAILS** to extract parameter information from generated handlers
4. ❌ **FAILS** to populate parameter definitions in ADP metadata

### Current Generated Output (❌ BROKEN):

```lua
handlers = [
    {
        "action": "Add",
        "category": "custom",
        "description": "Calculator addition handler with numeric validation",
        "examples": ["Calculator addition handler with numeric validation"],
        "pattern": ["Action"]
        -- ❌ MISSING: "parameters" field completely absent!
    }
]
```

### Expected ADP-Compliant Output (✅ CORRECT):

```lua
{
    "action": "Add",
    "pattern": ["Action"],
    "parameters": [
        {
            "name": "A",
            "type": "number",
            "required": true,
            "description": "First number to add"
        },
        {
            "name": "B",
            "type": "number",
            "required": true,
            "description": "Second number to add"
        }
    ],
    "description": "Add two numbers together",
    "category": "custom"
}
```

## User Story

As a **developer using AO processes**, I want **generated Lua code to include complete ADP parameter definitions** so that **processes are truly self-documenting and ADP-compliant**.

## Acceptance Criteria

### ✅ Parameter Extraction

- [ ] Extract parameter usage from generated Lua handler code
- [ ] Identify parameter types (string, number, boolean, address, json)
- [ ] Determine required vs optional parameters
- [ ] Generate human-readable parameter descriptions

### ✅ ADP Metadata Population

- [ ] Include `parameters` array in all handler definitions
- [ ] Follow ADP v1.0 parameter specification format
- [ ] Include validation rules where applicable (min/max, patterns, enum values)
- [ ] Add parameter examples

### ✅ Code Generation Enhancement

- [ ] Modify Lua code templates to include parameter extraction logic
- [ ] Update Info handler generation to populate parameter metadata
- [ ] Ensure consistency between handler implementation and ADP metadata

### ✅ Validation Updates

- [ ] ADP compliance validation checks for parameter definitions
- [ ] Warn when parameters used in code but missing from metadata
- [ ] Validate parameter definition completeness

## Implementation Tasks

### Task 1: Implement Parameter Extraction Service

- [ ] Create `ParameterExtractionService` in `src/services/`
- [ ] Parse generated Lua code to identify parameter usage patterns
- [ ] Extract parameter names from `msg.Tags.A`, `msg.Tags.B`, etc.
- [ ] Infer parameter types from usage (`tonumber()` = number, etc.)

### Task 2: Enhance Code Generator Service

- [ ] Update `LuaCodeGeneratorService.generateLuaCode()`
- [ ] Integrate parameter extraction after code generation
- [ ] Populate ADP handler metadata with extracted parameters
- [ ] Include parameter descriptions and validation rules

### Task 3: Update ADP Info Handler Template

- [ ] Modify `src/templates/adp-info-handler.lua`
- [ ] Add dynamic parameter definition population
- [ ] Ensure template supports all parameter types
- [ ] Include parameter validation examples

### Task 4: Enhance ADP Validation

- [ ] Update `GenerateLuaProcessCommand.validateADPCompliance()`
- [ ] Check for parameter definitions in handler metadata
- [ ] Warn when parameters missing from ADP metadata
- [ ] Validate parameter definition completeness

## Impact

- **CRITICAL**: Breaks ADP protocol compliance and affects process discoverability
- Blocks proper `executeAction` parameter resolution
- Prevents self-documenting process capabilities
- Affects integration with process discovery tools

## Related Stories

- Enables Story 9.1-9.3 (parameter translation) by providing complete metadata
- Supports Story 9.6 (ADP validation) with proper parameter definitions
- Aligns with Story 9.4 (tool integration) for consistent parameter handling

## Definition of Done

- Generated processes include complete ADP parameter definitions
- Parameter extraction accurately identifies types and requirements
- ADP metadata matches actual handler implementation
- ADP compliance validation includes parameter checking
- No regression in code generation capabilities
