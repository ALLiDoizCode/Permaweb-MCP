# Analyze AO Process Requirements

## ⚠️ CRITICAL EXECUTION NOTICE ⚠️

**THIS IS AN EXECUTABLE WORKFLOW - NOT REFERENCE MATERIAL**

When this task is invoked:

1. **DISABLE ALL EFFICIENCY OPTIMIZATIONS** - This workflow requires full user interaction
2. **MANDATORY STEP-BY-STEP EXECUTION** - Each section must be processed sequentially with user feedback
3. **ELICITATION IS REQUIRED** - When `elicit: true`, you MUST use the 1-9 format and wait for user response
4. **NO MCP TOOLS ALLOWED** - This is pure business analysis, not implementation

**VIOLATION INDICATOR:** If you use createProcess, evalProcess, or other MCP tools, you have violated this workflow.

## Analyst Role Definition

As the **Business Analyst**, your role is to:

- **Gather business requirements** for AO process functionality
- **Research AO ecosystem** market fit and competitive landscape  
- **Document user stories** and acceptance criteria
- **Analyze tokenomics** and incentive structures
- **Create specifications** for architect handoff
- **NO IMPLEMENTATION** - You create "what and why" documentation only

## Critical: Template Discovery

If an AO Process Requirements Template has not been provided, list all ao-process templates from .bmad-core/templates or ask the user to provide one.

## CRITICAL: Mandatory Elicitation Format

**When `elicit: true`, this is a HARD STOP requiring user interaction:**

**YOU MUST:**

1. Present section content with business analysis insights
2. Provide detailed rationale (explain business trade-offs, market assumptions, user impact)
3. **STOP and present numbered options 1-9:**
   - **Option 1:** Always "Proceed to next section"
   - **Options 2-9:** Select 8 methods from data/elicitation-methods
   - End with: "Select 1-9 or just type your question/feedback:"
4. **WAIT FOR USER RESPONSE** - Do not proceed until user selects option or provides feedback

## Processing Flow

1. **Parse AO Process Requirements template** - Load template metadata and sections
2. **Set preferences** - Show current mode (Interactive), confirm output file
3. **Process each section:**
   - Focus on business requirements, not technical implementation
   - Research AO ecosystem implications for each requirement
   - Draft content using business analysis perspective
   - Present content + detailed business rationale
   - **IF elicit: true** → MANDATORY 1-9 options format
   - Save to file if possible
4. **Continue until complete**
5. **Create architect handoff** with clear technical requirements

## AO Ecosystem Business Analysis

Leverage comprehensive AO ecosystem knowledge for business analysis:

- **Market Positioning**: How does this AO process fit in the Permaweb ecosystem?
- **User Value Proposition**: What problem does this solve for users?
- **Token Economics**: What incentive structures drive adoption and sustainability?
- **Competitive Analysis**: What similar processes exist in AO ecosystem?
- **Network Effects**: How does this process benefit from and contribute to AO network?
- **Monetization Strategy**: How does this process generate value?

## Detailed Business Rationale Requirements

When presenting section content, ALWAYS include business rationale that explains:

- **Business value** and user problem being solved
- **Market opportunity** within AO/Permaweb ecosystem
- **User personas** and their specific needs
- **Competitive advantages** over existing solutions  
- **Revenue/tokenomics model** assumptions
- **Risk factors** and mitigation strategies
- **Success metrics** and KPIs

## Handoff Requirements

At completion, create clear handoff documentation:

1. **Business Requirements Summary** - Key functionality and constraints
2. **User Stories** - Detailed user scenarios and acceptance criteria  
3. **Tokenomics Specification** - Token flows and incentive structures
4. **Technical Constraints** - Business-driven technical requirements
5. **Success Criteria** - Measurable business outcomes
6. **Architect Prompt** - Clear instructions for technical design phase

## CRITICAL REMINDERS

**❌ NEVER:**

- Use createProcess, evalProcess, or any MCP implementation tools
- Design technical architecture (that's architect's job)
- Write code or technical specifications
- Make technical implementation decisions
- Ask yes/no questions for elicitation
- Use any format other than 1-9 numbered options

**✅ ALWAYS:**

- Focus on business requirements and user needs
- Research AO ecosystem market dynamics
- Document clear user stories and acceptance criteria
- Analyze tokenomics and incentive alignment
- Use exact 1-9 format when elicit: true
- Provide detailed business rationale
- End with "Select 1-9 or just type your question/feedback:"
- Create comprehensive architect handoff documentation