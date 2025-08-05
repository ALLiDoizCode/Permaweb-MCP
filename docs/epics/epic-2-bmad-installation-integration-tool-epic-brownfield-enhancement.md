# Epic 2: BMAD Installation & Integration Tool Epic - Brownfield Enhancement

## Epic Goal

Create a tool that installs the complete BMAD methodology into any user's project AND integrates BMAD functionality with Claude Code slash commands, providing seamless access to the full methodology.

## Epic Description

**Existing System Context:**

- Current system: Permamind MCP server with existing tool infrastructure
- Technology stack: TypeScript, FastMCP, existing MCP tool patterns
- Integration points: UserToolFactory, command system, Claude Code slash command system

**Enhancement Details:**

- What's being added/changed: @init tool + Claude Code slash command integration
- Installation: Copies complete .bmad-core directory to user's project
- Slash commands: /analyst, /architect, /dev, /pm, /qa, /sm, /ux-expert, /create-doc, /execute-checklist, etc.
- Integration: Detects installed BMAD and provides clean slash command access
- How it integrates: New MCP tool + Claude Code slash command registration
- Success criteria: Users run @init once, then use clean slash commands in any Claude Code session

## Stories

### Story 2.1: Create @init MCP Tool

**User Story:** As a developer using Permamind, I want to install the complete BMAD methodology in my project with a single command so that I can access all BMAD resources locally.

**Acceptance Criteria:**

- Implement new MCP tool in Permamind UserToolFactory
- Tool copies entire .bmad-core directory structure to target project
- Include validation to check if BMAD already exists
- Provide option to update/overwrite existing installation
- Validate successful installation with basic health checks
- Provide clear feedback on installation status and next steps

### Story 2.2: Implement Claude Code Slash Command Integration

**User Story:** As a Claude Code user with BMAD installed, I want to use clean slash commands for all BMAD functionality so that I can access agents, tasks, templates, checklists, and workflows efficiently.

**Acceptance Criteria:**

- Create agent slash commands: /analyst, /architect, /dev, /pm, /qa, /sm, /ux-expert, /bmad-master
- Create task slash commands: /advanced-elicitation, /create-doc, /execute-checklist, /brownfield-create-epic, etc. (all 20 tasks)
- Create template slash commands: /architecture, /prd, /story, /front-end-spec, etc. (all 15 templates)
- Create checklist slash commands: /architect-checklist, /pm-checklist, /story-dod-checklist, etc. (all 7 checklists)
- Create workflow slash commands: /greenfield-fullstack, /brownfield-service, etc. (all 6 workflows)
- Ensure slash commands integrate with Claude Code's command system
- Maintain parameter passing and execution patterns from original BMAD tools

### Story 2.3: Auto-detect BMAD Installation for Slash Commands

**User Story:** As a Claude Code user, I want slash commands to automatically detect if BMAD is installed in my project so that I get helpful guidance when BMAD is not available.

**Acceptance Criteria:**

- Slash commands detect if .bmad-core exists in current project
- Provide helpful error messages if BMAD not installed
- Auto-suggest @init if user tries slash commands without installation
- Enable slash commands to work from any directory within BMAD-enabled project
- Support multi-project workflows where some projects have BMAD and others don't
- Graceful degradation when BMAD resources are unavailable

### Story 2.4: Add Installation Guidance and Slash Command Documentation

**User Story:** As a new BMAD user, I want comprehensive documentation and guidance so that I can understand how to install and use BMAD effectively in my projects.

**Acceptance Criteria:**

- Create help documentation for @init tool with usage examples
- Document all available slash commands with examples and parameter descriptions
- Provide post-installation usage guidance and getting started workflow
- Include troubleshooting for common installation and usage issues
- Create quick reference guide for all slash commands organized by category
- Integrate documentation with existing Permamind help system

## Definition of Done

- [ ] @init tool implemented in Permamind
- [ ] Complete .bmad-core directory installation working
- [ ] All agent slash commands implemented: /analyst, /architect, /dev, /pm, /qa, /sm, /ux-expert, /bmad-master
- [ ] All task slash commands implemented (20 commands)
- [ ] All template slash commands implemented (15 commands)
- [ ] All checklist slash commands implemented (7 commands)
- [ ] All workflow slash commands implemented (6 commands)
- [ ] Auto-detection of BMAD installation for slash commands
- [ ] Installation validation and conflict detection
- [ ] Comprehensive documentation for installation and slash commands
- [ ] Tool tested across different project types and Claude Code sessions
- [ ] No impact on existing Permamind or Claude Code functionality
- [ ] Build passes: npm run build && npm run lint && npm run type-check && npm run test

---
