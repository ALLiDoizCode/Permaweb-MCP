# Story 9.6: Enhanced ADP Compliance Validation with Parameter Checking

## Problem Statement

The current ADP validation in `GenerateLuaProcessCommand.validateADPCompliance()` only checks for basic structural elements but **completely misses parameter definition validation**, which is critical for ADP compliance.

## Root Cause

**Location**: `src/tools/process/commands/GenerateLuaProcessCommand.ts:157-232`

### Current Validation (❌ INCOMPLETE):

```typescript
const checks = {
  hasInfoHandler: true, // ✅ Checked
  hasProtocolVersion: true, // ✅ Checked
  hasHandlerRegistry: true, // ✅ Checked
  hasCapabilities: true, // ✅ Checked
  hasPingHandler: true, // ✅ Checked
  // ❌ MISSING: parameter definition validation
};
```

### Required Enhanced Validation (✅ COMPLETE):

```typescript
const checks = {
  // Existing checks...
  hasParameterDefinitions: boolean, // NEW
  parameterTypesValid: boolean, // NEW
  requiredParametersMarked: boolean, // NEW
  parameterDescriptionsComplete: boolean, // NEW
  parameterValidationRules: boolean, // NEW
};
```

## User Story

As a **developer generating AO processes**, I want **comprehensive ADP compliance validation that includes parameter definitions** so that **I can ensure my processes are fully ADP-compliant and self-documenting**.

## Acceptance Criteria

### ✅ Parameter Definition Validation

- [ ] Check that all handlers with parameters have `parameters` array defined
- [ ] Validate parameter objects have required fields: `name`, `type`, `required`, `description`
- [ ] Ensure parameter types are valid ADP types: `string`, `number`, `boolean`, `address`, `json`
- [ ] Verify required parameters are marked with `required: true`

### ✅ Cross-Reference Validation

- [ ] Compare parameters used in Lua code vs declared in ADP metadata
- [ ] Warn when code uses parameters not declared in metadata
- [ ] Warn when metadata declares unused parameters
- [ ] Validate parameter type consistency (code usage matches declared type)

### ✅ Validation Rule Checking

- [ ] Validate parameter validation rules format (regex patterns, min/max, enums)
- [ ] Check that validation rules match parameter types
- [ ] Ensure address parameters have proper validation patterns
- [ ] Verify enum values are appropriate for parameter usage

### ✅ Enhanced Reporting

- [ ] Provide detailed validation reports with specific line references
- [ ] Include suggestions for fixing validation failures
- [ ] Show parameter definition examples for missing parameters
- [ ] Rate overall ADP compliance with scoring

## Implementation Tasks

### Task 1: Extend ADP Validation Checks

- [ ] Add parameter-specific validation methods to `validateADPCompliance()`
- [ ] Implement `validateParameterDefinitions()` method
- [ ] Add `validateParameterTypes()` validation
- [ ] Create `validateParameterCompleteness()` checker

### Task 2: Implement Cross-Reference Validation

- [ ] Create `ParameterCrossReferenceValidator` service
- [ ] Parse Lua code to extract actual parameter usage
- [ ] Compare with ADP metadata parameter declarations
- [ ] Generate warnings for mismatches

### Task 3: Add Parameter Type Validation

- [ ] Validate parameter types against ADP specification
- [ ] Check validation rule format and consistency
- [ ] Ensure type-specific validation rules are appropriate
- [ ] Validate address pattern formats

### Task 4: Enhance Validation Reporting

- [ ] Update validation response format to include parameter details
- [ ] Add specific error messages for parameter validation failures
- [ ] Include fix suggestions and examples
- [ ] Implement compliance scoring system

### Enhanced Validation Structure

```typescript
interface EnhancedADPValidation {
  checks: {
    // Existing checks...
    hasParameterDefinitions: boolean;
    parameterTypesValid: boolean;
    requiredParametersMarked: boolean;
    parameterDescriptionsComplete: boolean;
  };
  parameterScore: number; // 0-1 parameter compliance score
  crossReferenceWarnings: string[];
  suggestions: string[];
  detailedReport: {
    handlerName: string;
    parameterIssues: ParameterIssue[];
  }[];
}
```

## Impact

- **HIGH PRIORITY**: Blocks confidence in ADP compliance of generated processes
- Improves reliability of `executeAction` parameter resolution
- Enhances process quality and discoverability
- Supports better development debugging

## Dependencies

- **Story 9.5**: Parameter extraction must be implemented first for cross-reference validation
- **Story 9.4**: May benefit from integrated architecture analysis

## Related Stories

- Validates completeness of Story 9.5 parameter definition implementation
- Supports Story 9.1-9.3 parameter translation by ensuring proper metadata
- Aligns with Story 9.4 tool integration for consistent validation

## Definition of Done

- ADP validation includes comprehensive parameter definition checking
- Cross-reference validation compares Lua code with ADP metadata
- Enhanced reporting provides actionable feedback for compliance issues
- Parameter compliance scoring provides measurable quality metrics
- No regression in existing ADP validation capabilities
