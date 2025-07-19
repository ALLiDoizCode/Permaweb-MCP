import { readdir, readFile } from "fs/promises";
import path from "path";
import yaml from "yaml";
import { z } from "zod";

export interface BMADChecklist {
  description: string;
  id: string;
  items: BMADChecklistItem[];
  metadata: BMADChecklistMetadata;
  name: string;
}

export interface BMADChecklistItem {
  description: string;
  id: string;
  required: boolean;
  title: string;
  type: "check" | "input" | "validation";
}

export interface BMADChecklistMetadata {
  author: string;
  category: string;
  purpose: string;
  tags: string[];
  version: string;
}

export interface BMADConfig {
  bmad: {
    cacheEnabled: boolean;
    cacheTimeoutMinutes: number;
    commandPrefix: string;
    description: string;
    loadOnDemand: boolean;
    resourceTypes: BMADResourceType[];
    version: string;
  };
  version: string;
}

export interface BMADResource {
  content: BMADChecklist | BMADTask | BMADTemplate | BMADWorkflow | unknown;
  description: string;
  filePath: string;
  id: string;
  lastModified: Date;
  metadata:
    | BMADChecklistMetadata
    | BMADTaskMetadata
    | BMADTemplateMetadata
    | BMADWorkflowMetadata;
  name: string;
  type: BMADResourceType;
}

export type BMADResourceType =
  | "checklists"
  | "data"
  | "tasks"
  | "templates"
  | "workflows";

export interface BMADStep {
  description: string;
  id: string;
  required: boolean;
  title: string;
  type: "action" | "input" | "validation";
}

export interface BMADTask {
  description: string;
  id: string;
  metadata: BMADTaskMetadata;
  steps: BMADStep[];
  title: string;
}

export interface BMADTaskMetadata {
  author: string;
  category: string;
  difficulty: "easy" | "hard" | "medium";
  estimatedTime: string;
  tags: string[];
  version: string;
}

export interface BMADTemplate {
  description: string;
  id: string;
  metadata: BMADTemplateMetadata;
  name: string;
  template: string;
  variables: BMADVariable[];
}

export interface BMADTemplateMetadata {
  author: string;
  category: string;
  outputFormat: string;
  tags: string[];
  version: string;
}

export interface BMADVariable {
  defaultValue?: string;
  description: string;
  name: string;
  required: boolean;
  type: "boolean" | "date" | "number" | "string";
}

export interface BMADWorkflow {
  description: string;
  id: string;
  metadata: BMADWorkflowMetadata;
  name: string;
  steps: BMADWorkflowStep[];
}

export interface BMADWorkflowMetadata {
  author: string;
  category: string;
  complexity: "complex" | "moderate" | "simple";
  duration: string;
  tags: string[];
  version: string;
}

export interface BMADWorkflowStep {
  dependencies: string[];
  description: string;
  id: string;
  outputs: string[];
  title: string;
  type: "automation" | "decision" | "task";
}

export class BMADResourceService {
  private bmadCorePath: string;
  private cache: Map<string, BMADResource> = new Map();
  private cacheTimestamps: Map<string, Date> = new Map();
  private config: BMADConfig | null = null;

  constructor(bmadCorePath: string = ".bmad-core") {
    this.bmadCorePath = path.resolve(bmadCorePath);
  }

  cacheResource(key: string, resource: BMADResource): void {
    if (this.config?.bmad.cacheEnabled) {
      this.cache.set(key, resource);
      this.cacheTimestamps.set(key, new Date());
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  getConfig(): BMADConfig | null {
    return this.config;
  }

  async initialize(): Promise<void> {
    try {
      const configPath = path.join(this.bmadCorePath, "core-config.yaml");
      const configContent = await readFile(configPath, "utf-8");
      this.config = yaml.parse(configContent) as BMADConfig;
    } catch (error) {
      throw new Error(
        `Failed to initialize BMAD resource service: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async listResources(resourceType: BMADResourceType): Promise<string[]> {
    try {
      const resourceDir = path.join(this.bmadCorePath, resourceType);
      const files = await readdir(resourceDir);
      return files
        .filter((file) => file.endsWith(".md"))
        .map((file) => path.basename(file, ".md"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return []; // Directory doesn't exist
      }
      throw new Error(
        `Failed to list resources of type ${resourceType}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async loadResource(
    resourceType: BMADResourceType,
    resourceId: string,
  ): Promise<BMADResource | null> {
    const cacheKey = `${resourceType}:${resourceId}`;

    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey) || null;
    }

    try {
      const resourcePath = path.join(
        this.bmadCorePath,
        resourceType,
        `${resourceId}.md`,
      );
      const resourceContent = await readFile(resourcePath, "utf-8");

      // Parse markdown content (simplified - real implementation would use a proper markdown parser)
      const resource = this.parseResourceContent(
        resourceType,
        resourceId,
        resourceContent,
        resourcePath,
      );

      // Cache the resource
      this.cacheResource(cacheKey, resource);

      return resource;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null; // Resource not found
      }
      throw new Error(
        `Failed to load resource ${resourceType}:${resourceId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async validateResource(resource: BMADResource): Promise<boolean> {
    try {
      // Basic validation - ensure required fields are present
      if (
        !resource.id ||
        !resource.type ||
        !resource.name ||
        !resource.content
      ) {
        return false;
      }

      // Type-specific validation
      switch (resource.type) {
        case "checklists":
          return this.validateChecklist(resource.content as BMADChecklist);
        case "tasks":
          return this.validateTask(resource.content as BMADTask);
        case "templates":
          return this.validateTemplate(resource.content as BMADTemplate);
        case "workflows":
          return this.validateWorkflow(resource.content as BMADWorkflow);
        default:
          return true; // Data resources have no specific validation
      }
    } catch (error) {
      return false;
    }
  }

  private createDefaultContent(
    resourceType: BMADResourceType,
    id: string,
    title: string,
    description: string,
  ): BMADChecklist | BMADTask | BMADTemplate | BMADWorkflow | unknown {
    switch (resourceType) {
      case "checklists":
        return {
          description,
          id,
          items: [],
          metadata: this.createDefaultMetadata(
            resourceType,
          ) as BMADChecklistMetadata,
          name: title,
        } as BMADChecklist;
      case "tasks":
        return {
          description,
          id,
          metadata: this.createDefaultMetadata(
            resourceType,
          ) as BMADTaskMetadata,
          steps: [],
          title,
        } as BMADTask;
      case "templates":
        return {
          description,
          id,
          metadata: this.createDefaultMetadata(
            resourceType,
          ) as BMADTemplateMetadata,
          name: title,
          template: "",
          variables: [],
        } as BMADTemplate;
      case "workflows":
        return {
          description,
          id,
          metadata: this.createDefaultMetadata(
            resourceType,
          ) as BMADWorkflowMetadata,
          name: title,
          steps: [],
        } as BMADWorkflow;
      default:
        return {};
    }
  }

  private createDefaultMetadata(
    resourceType: BMADResourceType,
  ):
    | BMADChecklistMetadata
    | BMADTaskMetadata
    | BMADTemplateMetadata
    | BMADWorkflowMetadata {
    const baseMetadata = {
      author: "BMAD System",
      category: "general",
      tags: [],
      version: "1.0.0",
    };

    switch (resourceType) {
      case "checklists":
        return {
          ...baseMetadata,
          purpose: "quality assurance",
        };
      case "tasks":
        return {
          ...baseMetadata,
          difficulty: "medium" as const,
          estimatedTime: "30 minutes",
        };
      case "templates":
        return {
          ...baseMetadata,
          outputFormat: "markdown",
        };
      case "workflows":
        return {
          ...baseMetadata,
          complexity: "moderate" as const,
          duration: "1 hour",
        };
      default:
        return {
          ...baseMetadata,
          difficulty: "medium" as const,
          estimatedTime: "30 minutes",
        } as BMADTaskMetadata;
    }
  }

  private isCacheValid(key: string): boolean {
    if (!this.config?.bmad.cacheEnabled) {
      return false;
    }

    const cachedResource = this.cache.get(key);
    const timestamp = this.cacheTimestamps.get(key);

    if (!cachedResource || !timestamp) {
      return false;
    }

    const now = new Date();
    const cacheAge = now.getTime() - timestamp.getTime();
    const maxAge = this.config.bmad.cacheTimeoutMinutes * 60 * 1000;

    return cacheAge < maxAge;
  }

  private parseResourceContent(
    resourceType: BMADResourceType,
    resourceId: string,
    content: string,
    filePath: string,
  ): BMADResource {
    // Simplified parsing - real implementation would use proper markdown parser
    const lines = content.split("\n");
    const title =
      lines.find((line) => line.startsWith("# "))?.substring(2) || resourceId;
    const description =
      lines
        .find((line) => line.startsWith("## ") && line.includes("Description"))
        ?.substring(2) || "";

    // Create a basic resource structure
    const resource: BMADResource = {
      content: this.createDefaultContent(
        resourceType,
        resourceId,
        title,
        description,
      ),
      description,
      filePath,
      id: resourceId,
      lastModified: new Date(),
      metadata: this.createDefaultMetadata(resourceType),
      name: title,
      type: resourceType,
    };

    return resource;
  }

  private validateChecklist(checklist: BMADChecklist): boolean {
    return !!(
      checklist.id &&
      checklist.name &&
      checklist.items &&
      Array.isArray(checklist.items)
    );
  }

  private validateTask(task: BMADTask): boolean {
    return !!(task.id && task.title && task.steps && Array.isArray(task.steps));
  }

  private validateTemplate(template: BMADTemplate): boolean {
    return !!(
      template.id &&
      template.name &&
      template.template &&
      Array.isArray(template.variables)
    );
  }

  private validateWorkflow(workflow: BMADWorkflow): boolean {
    return !!(
      workflow.id &&
      workflow.name &&
      workflow.steps &&
      Array.isArray(workflow.steps)
    );
  }
}

// Export a singleton instance
export const bmadResourceService = new BMADResourceService();
