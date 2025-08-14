import {
  WorkflowConfiguration,
  WorkflowExecutionReport,
  WorkflowStage,
  WorkflowStageResult,
} from "../types/workflow-orchestration.js";

/**
 * Comprehensive report with full details
 */
export interface ComprehensiveProcessReport {
  comparativeAnalysis?: {
    averageExecutionTime: number;
    qualityTrends: Record<string, number>;
    successRate: number;
  };
  insights: {
    bestPracticeViolations: string[];
    optimizationOpportunities: string[];
    performanceBottlenecks: string[];
    qualityIssues: string[];
  };
  recommendations: string[];
  report: ProcessCreationReport;
  summary: ReportSummary;
}

/**
 * Audit trail events
 */
export interface ProcessAuditEvent {
  action: string;
  actor: "service" | "system" | "user";
  context: Record<string, unknown>;
  details: {
    duration: number;
    operation: string;
    parameters: Record<string, unknown>;
    result: "failure" | "partial" | "success";
  };
  eventId: string;
  stage: WorkflowStage;
  timestamp: Date;
}

/**
 * Report metadata for process creation auditing
 */
export interface ProcessCreationReport {
  auditTrail: ProcessAuditEvent[];
  configuration: WorkflowConfiguration;
  endTime?: Date;
  metadata: Record<string, unknown>;
  qualityMetrics: ProcessQualityMetrics;
  reportId: string;
  resourceUsage: ProcessResourceUsage;
  sessionId: string;
  stages: ProcessCreationStageReport[];
  startTime: Date;
  userRequest: string;
  workflowId: string;
}

/**
 * Stage-specific reporting details
 */
export interface ProcessCreationStageReport {
  endTime?: Date;
  errors: Array<{
    error: string;
    recovered: boolean;
    severity: "error" | "info" | "warning";
    timestamp: Date;
  }>;
  executionTime: number;
  inputData: {
    size: number;
    sources: string[];
    version?: string;
  };
  outputData: {
    quality?: number;
    size: number;
    type: string;
  };
  performanceMetrics: {
    efficiency: number;
    latency: number;
    throughput?: number;
  };
  resourceConsumption: {
    apiCalls: number;
    documentationQueries: number;
    memoryUsage: number;
    processOperations: number;
  };
  stage: WorkflowStage;
  startTime: Date;
  success: boolean;
  toolsUsed: string[];
}

/**
 * Quality metrics for process creation
 */
export interface ProcessQualityMetrics {
  architecturalCompliance: number;
  bestPracticesAdherence: number;
  codeQuality: number;
  documentationCoverage: number;
  maintainabilityScore: number;
  overallScore: number;
  performanceScore: number;
  reliabilityScore: number;
  testCoverage: number;
  validationScore: number;
}

/**
 * Resource usage tracking
 */
export interface ProcessResourceUsage {
  codeEvaluations: {
    complexity: number;
    count: number;
    qualityScore: number;
    totalLines: number;
  };
  documentationQueries: {
    count: number;
    domains: string[];
    relevanceScore: number;
    totalDocuments: number;
  };
  memoryUsage: {
    average: number;
    final: number;
    peak: number;
  };
  processesCreated: {
    count: number;
    processIds: string[];
    success: number;
    types: string[];
  };
  totalApiCalls: number;
  totalExecutionTime: number;
}

/**
 * Summary report for quick overview
 */
export interface ReportSummary {
  criticalIssues: number;
  executionTime: number;
  keyMetrics: {
    documentationSources: number;
    generatedCodeLines: number;
    processesCreated: number;
    testsPassed: number;
  };
  overallScore: number;
  recommendations: number;
  sessionId: string;
  stageCount: number;
  status: "failure" | "partial" | "success";
  successfulStages: number;
}

/**
 * Service for comprehensive process creation reporting and audit trail.
 *
 * This service provides:
 * - Detailed workflow execution tracking with complete audit trail
 * - Documentation source tracking and citation throughout the workflow
 * - Code generation history with version tracking and change documentation
 * - Process creation metrics including performance benchmarks and success rates
 * - Test result aggregation and comprehensive validation reporting
 */
export class ProcessCreationReportService {
  private readonly activeReports: Map<string, ProcessCreationReport>;
  private readonly reportHistory: Map<string, ProcessCreationReport>;

  constructor() {
    this.activeReports = new Map();
    this.reportHistory = new Map();
  }

  /**
   * Export report summary for quick overview
   */
  async exportReportSummary(
    report: ProcessCreationReport,
  ): Promise<ReportSummary> {
    const successfulStages = report.stages.filter((s) => s.success).length;
    const criticalIssues = report.stages
      .flatMap((s) => s.errors)
      .filter((e) => e.severity === "error").length;

    return {
      criticalIssues,
      executionTime: report.resourceUsage.totalExecutionTime,
      keyMetrics: {
        documentationSources:
          report.resourceUsage.documentationQueries.totalDocuments,
        generatedCodeLines: report.resourceUsage.codeEvaluations.totalLines,
        processesCreated: report.resourceUsage.processesCreated.count,
        testsPassed: 0, // Would be from actual test results
      },
      overallScore: report.qualityMetrics.overallScore,
      recommendations: 0, // Would be calculated
      sessionId: report.sessionId,
      stageCount: report.stages.length,
      status: this.determineOverallStatus(report),
      successfulStages,
    };
  }

  /**
   * Generate comprehensive report with analysis and insights
   */
  async generateComprehensiveReport(
    report: ProcessCreationReport,
  ): Promise<ComprehensiveProcessReport> {
    // Finalize report
    report.endTime = new Date();
    report.resourceUsage.totalExecutionTime = report.stages.reduce(
      (sum, s) => sum + s.executionTime,
      0,
    );

    // Calculate overall quality score
    const qualityMetrics = report.qualityMetrics;
    qualityMetrics.overallScore =
      (qualityMetrics.validationScore +
        qualityMetrics.codeQuality +
        qualityMetrics.performanceScore +
        qualityMetrics.reliabilityScore) /
      4;

    // Generate summary
    const summary: ReportSummary = {
      criticalIssues: report.stages
        .flatMap((s) => s.errors)
        .filter((e) => e.severity === "error").length,
      executionTime: report.resourceUsage.totalExecutionTime,
      keyMetrics: {
        documentationSources:
          report.resourceUsage.documentationQueries.totalDocuments,
        generatedCodeLines: report.resourceUsage.codeEvaluations.totalLines,
        processesCreated: report.resourceUsage.processesCreated.count,
        testsPassed: 0, // Would be calculated from actual test results
      },
      overallScore: qualityMetrics.overallScore,
      recommendations: 0, // Will be calculated below
      sessionId: report.sessionId,
      stageCount: report.stages.length,
      status: this.determineOverallStatus(report),
      successfulStages: report.stages.filter((s) => s.success).length,
    };

    // Generate insights and recommendations
    const insights = this.generateInsights(report);
    const recommendations = this.generateRecommendations(report, insights);
    summary.recommendations = recommendations.length;

    // Store in history
    this.reportHistory.set(report.reportId, report);
    this.activeReports.delete(report.reportId);

    return {
      comparativeAnalysis: await this.generateComparativeAnalysis(report),
      insights,
      recommendations,
      report,
      summary,
    };
  }

  /**
   * Get active report by ID
   */
  getActiveReport(reportId: string): ProcessCreationReport | undefined {
    return this.activeReports.get(reportId);
  }

  /**
   * Get report from history
   */
  getHistoricalReport(reportId: string): ProcessCreationReport | undefined {
    return this.reportHistory.get(reportId);
  }

  /**
   * Get all reports for a session
   */
  getReportsForSession(sessionId: string): ProcessCreationReport[] {
    const reports: ProcessCreationReport[] = [];

    // Check active reports
    for (const report of this.activeReports.values()) {
      if (report.sessionId === sessionId) {
        reports.push(report);
      }
    }

    // Check historical reports
    for (const report of this.reportHistory.values()) {
      if (report.sessionId === sessionId) {
        reports.push(report);
      }
    }

    return reports.sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );
  }

  /**
   * Initialize a new process creation report
   */
  async initializeReport(
    workflowId: string,
    sessionId: string,
    configuration: WorkflowConfiguration,
    userRequest: string,
  ): Promise<ProcessCreationReport> {
    const reportId = this.generateReportId();

    const report: ProcessCreationReport = {
      auditTrail: [
        {
          action: "report_initialized",
          actor: "system",
          context: {
            configuration,
            userRequest,
          },
          details: {
            duration: 0,
            operation: "initialize_report",
            parameters: { sessionId, workflowId },
            result: "success",
          },
          eventId: this.generateEventId(),
          stage: "initialization",
          timestamp: new Date(),
        },
      ],
      configuration,
      metadata: {
        created: new Date(),
        version: "1.0",
      },
      qualityMetrics: {
        architecturalCompliance: 0,
        bestPracticesAdherence: 0,
        codeQuality: 0,
        documentationCoverage: 0,
        maintainabilityScore: 0,
        overallScore: 0,
        performanceScore: 0,
        reliabilityScore: 0,
        testCoverage: 0,
        validationScore: 0,
      },
      reportId,
      resourceUsage: {
        codeEvaluations: {
          complexity: 0,
          count: 0,
          qualityScore: 0,
          totalLines: 0,
        },
        documentationQueries: {
          count: 0,
          domains: [],
          relevanceScore: 0,
          totalDocuments: 0,
        },
        memoryUsage: {
          average: 0,
          final: 0,
          peak: 0,
        },
        processesCreated: {
          count: 0,
          processIds: [],
          success: 0,
          types: [],
        },
        totalApiCalls: 0,
        totalExecutionTime: 0,
      },
      sessionId,
      stages: [],
      startTime: new Date(),
      userRequest,
      workflowId,
    };

    this.activeReports.set(reportId, report);

    return report;
  }

  /**
   * Record stage execution details
   */
  async recordStageExecution(
    report: ProcessCreationReport,
    stage: WorkflowStage,
    result: WorkflowStageResult,
    additionalMetrics?: Partial<ProcessCreationStageReport>,
  ): Promise<ProcessCreationReport> {
    const stageReport: ProcessCreationStageReport = {
      endTime: new Date(),
      errors: result.error
        ? [
            {
              error: result.error.message,
              recovered: false,
              severity: "error",
              timestamp: new Date(),
            },
          ]
        : [],
      executionTime: result.executionTime,
      inputData: {
        size: this.calculateDataSize(result.data),
        sources: this.extractDataSources(result.data),
        version: additionalMetrics?.inputData?.version,
      },
      outputData: {
        quality: this.calculateDataQuality(result.data),
        size: this.calculateDataSize(result.data),
        type: typeof result.data,
      },
      performanceMetrics: {
        efficiency: result.success ? 1.0 : 0.0,
        latency: result.executionTime,
        throughput: additionalMetrics?.performanceMetrics?.throughput,
      },
      resourceConsumption: {
        apiCalls: result.toolsUsed.length,
        documentationQueries: stage === "documentation-query" ? 1 : 0,
        memoryUsage: additionalMetrics?.resourceConsumption?.memoryUsage || 0,
        processOperations: stage === "process-creation" ? 1 : 0,
      },
      stage,
      startTime: new Date(Date.now() - result.executionTime),
      success: result.success,
      toolsUsed: result.toolsUsed,
    };

    // Add stage report
    report.stages.push(stageReport);

    // Update resource usage
    this.updateResourceUsage(report, stageReport, result);

    // Update quality metrics
    this.updateQualityMetrics(report, stageReport, result);

    // Add audit event
    report.auditTrail.push({
      action: result.success ? "stage_completed" : "stage_failed",
      actor: "system",
      context: {
        error: result.error,
        stageIndex: report.stages.length - 1,
      },
      details: {
        duration: result.executionTime,
        operation: `execute_${stage}`,
        parameters: { stage, toolsUsed: result.toolsUsed },
        result: result.success ? "success" : "failure",
      },
      eventId: this.generateEventId(),
      stage,
      timestamp: new Date(),
    });

    this.activeReports.set(report.reportId, report);

    return report;
  }

  private calculateDataQuality(data: unknown): number {
    // Simple quality calculation based on data structure
    if (!data) return 0;
    if (typeof data === "object" && Object.keys(data).length > 0) return 0.8;
    return 0.5;
  }

  /**
   * Helper methods for data extraction and calculation
   */
  private calculateDataSize(data: unknown): number {
    return JSON.stringify(data || {}).length;
  }

  private determineOverallStatus(
    report: ProcessCreationReport,
  ): "failure" | "partial" | "success" {
    const successfulStages = report.stages.filter((s) => s.success).length;
    const totalStages = report.stages.length;

    if (successfulStages === totalStages) return "success";
    if (successfulStages === 0) return "failure";
    return "partial";
  }

  private extractCodeLines(data: unknown): number {
    if (data && typeof data === "object" && "generatedCode" in data) {
      const code = (data as any).generatedCode;
      return typeof code === "string" ? code.split("\n").length : 0;
    }
    return 0;
  }

  private extractDataSources(data: unknown): string[] {
    // Extract sources from data structure
    if (data && typeof data === "object" && "sources" in data) {
      return Array.isArray((data as any).sources) ? (data as any).sources : [];
    }
    return [];
  }

  private extractDocumentCount(data: unknown): number {
    if (Array.isArray(data)) return data.length;
    return 0;
  }

  /**
   * Generate comparative analysis against historical data
   */
  private async generateComparativeAnalysis(
    report: ProcessCreationReport,
  ): Promise<ComprehensiveProcessReport["comparativeAnalysis"]> {
    const historicalReports = Array.from(this.reportHistory.values());

    if (historicalReports.length === 0) {
      return undefined;
    }

    const avgExecutionTime =
      historicalReports.reduce(
        (sum, r) => sum + r.resourceUsage.totalExecutionTime,
        0,
      ) / historicalReports.length;

    const successRate =
      historicalReports.filter(
        (r) => this.determineOverallStatus(r) === "success",
      ).length / historicalReports.length;

    return {
      averageExecutionTime: avgExecutionTime,
      qualityTrends: {
        overall:
          historicalReports.reduce(
            (sum, r) => sum + r.qualityMetrics.overallScore,
            0,
          ) / historicalReports.length,
      },
      successRate,
    };
  }

  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate insights from report data
   */
  private generateInsights(
    report: ProcessCreationReport,
  ): ComprehensiveProcessReport["insights"] {
    const insights = {
      bestPracticeViolations: [] as string[],
      optimizationOpportunities: [] as string[],
      performanceBottlenecks: [] as string[],
      qualityIssues: [] as string[],
    };

    // Analyze performance bottlenecks
    const slowStages = report.stages.filter((s) => s.executionTime > 10000); // 10 seconds
    insights.performanceBottlenecks = slowStages.map(
      (s) => `${s.stage} stage took ${s.executionTime}ms`,
    );

    // Analyze quality issues
    const failedStages = report.stages.filter((s) => !s.success);
    insights.qualityIssues = failedStages.map(
      (s) =>
        `${s.stage} stage failed: ${s.errors[0]?.error || "Unknown error"}`,
    );

    // Identify optimization opportunities
    if (report.resourceUsage.documentationQueries.count > 10) {
      insights.optimizationOpportunities.push(
        "Consider caching documentation queries",
      );
    }
    if (report.resourceUsage.totalApiCalls > 50) {
      insights.optimizationOpportunities.push(
        "High API usage - consider batch processing",
      );
    }

    return insights;
  }

  /**
   * Generate recommendations based on report analysis
   */
  private generateRecommendations(
    report: ProcessCreationReport,
    insights: ComprehensiveProcessReport["insights"],
  ): string[] {
    const recommendations: string[] = [];

    if (insights.performanceBottlenecks.length > 0) {
      recommendations.push("Optimize performance bottlenecks in slow stages");
    }

    if (insights.qualityIssues.length > 0) {
      recommendations.push("Address quality issues in failed stages");
    }

    if (report.qualityMetrics.overallScore < 0.7) {
      recommendations.push("Improve overall workflow quality");
    }

    if (
      report.stages.filter((s) => s.success).length / report.stages.length <
      0.8
    ) {
      recommendations.push("Improve stage success rate");
    }

    return recommendations;
  }

  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update quality metrics based on stage results
   */
  private updateQualityMetrics(
    report: ProcessCreationReport,
    stageReport: ProcessCreationStageReport,
    result: WorkflowStageResult,
  ): void {
    const metrics = report.qualityMetrics;

    // Update based on stage success and performance
    if (result.success) {
      metrics.validationScore += 0.1;
      metrics.reliabilityScore += 0.1;
    }

    // Performance score based on execution time
    const performanceThreshold = 5000; // 5 seconds
    if (stageReport.executionTime < performanceThreshold) {
      metrics.performanceScore += 0.1;
    }

    // Cap scores at 1.0
    Object.keys(metrics).forEach((key) => {
      const typedKey = key as keyof ProcessQualityMetrics;
      if (typeof metrics[typedKey] === "number") {
        (metrics[typedKey] as number) = Math.min(
          metrics[typedKey] as number,
          1.0,
        );
      }
    });
  }

  /**
   * Update resource usage based on stage execution
   */
  private updateResourceUsage(
    report: ProcessCreationReport,
    stageReport: ProcessCreationStageReport,
    result: WorkflowStageResult,
  ): void {
    const usage = report.resourceUsage;

    usage.totalApiCalls += stageReport.resourceConsumption.apiCalls;

    // Update stage-specific metrics
    switch (stageReport.stage) {
      case "code-generation":
        usage.codeEvaluations.count += 1;
        usage.codeEvaluations.totalLines += this.extractCodeLines(result.data);
        break;
      case "documentation-query":
        usage.documentationQueries.count += 1;
        usage.documentationQueries.totalDocuments += this.extractDocumentCount(
          result.data,
        );
        break;
      case "process-creation":
        usage.processesCreated.count += 1;
        if (result.success) {
          usage.processesCreated.success += 1;
        }
        break;
    }
  }
}
