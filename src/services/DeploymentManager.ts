import { ConfigManager } from '../config/ConfigManager';
import { AssistantAPIConfig, LLMConfig, SystemConfig } from '../config/types';
import { DiagnosticService, DiagnosticResult } from './ErrorHandler';
import { createAssistantService, AssistantService } from './AssistantService';
import * as fs from 'fs';
import * as path from 'path';

export interface DeploymentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
  healthChecks: HealthCheckResult[];
}

export interface HealthCheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: Record<string, any>;
  duration?: number; // milliseconds
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  configPath: string;
  validatedAt: Date;
}

export interface MonitoringAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface AlertingConfig {
  enabled: boolean;
  errorThreshold: number;
  warningThreshold: number;
  costAlertThreshold: number;
  quotaWarningThreshold: number; // percentage
  emailNotifications?: {
    enabled: boolean;
    recipients: string[];
    smtpConfig?: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };
  webhookNotifications?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
  };
}

export class DeploymentManager {
  private static instance: DeploymentManager;
  private configManager: ConfigManager;
  private diagnosticService: DiagnosticService | null = null;
  private assistantService: AssistantService | null = null;
  private alerts: MonitoringAlert[] = [];
  private alertingConfig: AlertingConfig;

  private constructor() {
    this.configManager = ConfigManager.getInstance();
    this.alertingConfig = {
      enabled: true,
      errorThreshold: 5, // 5 errors in 10 minutes triggers alert
      warningThreshold: 10, // 10 warnings in 10 minutes triggers alert
      costAlertThreshold: 100, // $100 daily cost threshold
      quotaWarningThreshold: 80 // 80% quota usage triggers warning
    };
  }

  public static getInstance(): DeploymentManager {
    if (!DeploymentManager.instance) {
      DeploymentManager.instance = new DeploymentManager();
    }
    return DeploymentManager.instance;
  }

  /**
   * Validates the complete deployment configuration and readiness
   */
  public async validateDeployment(): Promise<DeploymentValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const healthChecks: HealthCheckResult[] = [];

    try {
      // 1. Validate configuration
      const configValidation = this.validateConfiguration();
      if (!configValidation.isValid) {
        errors.push(...configValidation.errors);
        warnings.push(...configValidation.warnings);
      }

      // 2. Run health checks
      const healthCheckResults = await this.runHealthChecks();
      healthChecks.push(...healthCheckResults);

      // Add errors from failed health checks
      healthCheckResults.forEach(check => {
        if (check.status === 'fail') {
          errors.push(`Health check failed: ${check.name} - ${check.message}`);
        } else if (check.status === 'warning') {
          warnings.push(`Health check warning: ${check.name} - ${check.message}`);
        }
      });

      // 3. Generate recommendations
      recommendations.push(...this.generateDeploymentRecommendations());

      // 4. Validate environment-specific requirements
      const envValidation = this.validateEnvironment();
      if (!envValidation.isValid) {
        errors.push(...envValidation.errors);
        warnings.push(...envValidation.warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        recommendations,
        healthChecks
      };
    } catch (error) {
      errors.push(`Deployment validation failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        isValid: false,
        errors,
        warnings,
        recommendations,
        healthChecks
      };
    }
  }

  /**
   * Validates the system configuration for Assistant API deployment
   */
  public validateConfiguration(): ConfigurationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const configPath = path.join(process.cwd(), 'config.json');

    try {
      // Get current configuration
      const config = this.configManager.getConfig();
      const assistantConfig = this.configManager.getAssistantAPIConfig();
      const llmConfig = this.configManager.getLLMConfig();

      // Validate Assistant API configuration
      if (assistantConfig.enabled) {
        // Required fields validation
        if (!llmConfig.apiKey) {
          errors.push('OpenAI API key is required when Assistant API is enabled');
        }

        if (!assistantConfig.model || assistantConfig.model.trim() === '') {
          errors.push('Assistant API model must be specified');
        }

        // Validate numeric configurations
        if (assistantConfig.maxFileSize <= 0 || assistantConfig.maxFileSize > 100) {
          warnings.push(`Assistant API maxFileSize (${assistantConfig.maxFileSize}MB) should be between 1-100MB`);
        }

        if (assistantConfig.vectorStoreExpiration <= 0) {
          errors.push('Assistant API vectorStoreExpiration must be greater than 0');
        }

        if (assistantConfig.usageThreshold <= 0) {
          errors.push('Assistant API usageThreshold must be greater than 0');
        }

        // Validate model compatibility
        const supportedModels = ['gpt-4', 'gpt-4-turbo', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'];
        if (!supportedModels.includes(assistantConfig.model)) {
          warnings.push(`Model '${assistantConfig.model}' may not be supported. Recommended: ${supportedModels.join(', ')}`);
        }

        // Validate resource management settings
        const resourceConfig = this.configManager.getResourceManagementConfig();
        if (!resourceConfig.monitoringEnabled) {
          warnings.push('Resource monitoring is disabled - consider enabling for production deployments');
        }

        if (resourceConfig.costAlertThreshold <= 0) {
          warnings.push('Cost alert threshold is not set - consider setting a reasonable limit');
        }

        // Validate fallback configuration
        const fallbackConfig = this.configManager.getFallbackConfig();
        if (!fallbackConfig.enableFallback) {
          warnings.push('Fallback is disabled - this may cause failures when Assistant API is unavailable');
        }
      } else {
        warnings.push('Assistant API is disabled - enable it to use RAG capabilities');
      }

      // Validate environment variables
      if (llmConfig.apiKey && llmConfig.apiKey.startsWith('${') && llmConfig.apiKey.endsWith('}')) {
        const envVar = llmConfig.apiKey.slice(2, -1);
        if (!process.env[envVar]) {
          errors.push(`Environment variable ${envVar} is not set`);
        }
      }

      // Check configuration file existence and permissions
      if (!fs.existsSync(configPath)) {
        warnings.push('Configuration file does not exist - using defaults');
      } else {
        try {
          fs.accessSync(configPath, fs.constants.R_OK);
        } catch {
          errors.push('Configuration file is not readable');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        configPath,
        validatedAt: new Date()
      };
    } catch (error) {
      errors.push(`Configuration validation failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        isValid: false,
        errors,
        warnings,
        configPath,
        validatedAt: new Date()
      };
    }
  }

  /**
   * Runs comprehensive health checks for Assistant API deployment
   */
  public async runHealthChecks(): Promise<HealthCheckResult[]> {
    const healthChecks: HealthCheckResult[] = [];

    // 1. Configuration health check
    healthChecks.push(await this.checkConfiguration());

    // 2. API connectivity health check
    healthChecks.push(await this.checkAPIConnectivity());

    // 3. Model availability health check
    healthChecks.push(await this.checkModelAvailability());

    // 4. File upload capability health check
    healthChecks.push(await this.checkFileUploadCapability());

    // 5. Assistant creation health check
    healthChecks.push(await this.checkAssistantCreationCapability());

    // 6. Resource cleanup health check
    healthChecks.push(await this.checkResourceCleanupCapability());

    // 7. Performance health check
    healthChecks.push(await this.checkPerformanceMetrics());

    // 8. Cost monitoring health check
    healthChecks.push(await this.checkCostMonitoring());

    return healthChecks;
  }

  /**
   * Generates deployment recommendations based on current configuration and environment
   */
  private generateDeploymentRecommendations(): string[] {
    const recommendations: string[] = [];
    const config = this.configManager.getConfig();
    const assistantConfig = this.configManager.getAssistantAPIConfig();

    // Environment-based recommendations
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      recommendations.push('Enable monitoring and alerting for production deployment');
      recommendations.push('Set up automated backup for configuration files');
      recommendations.push('Configure log rotation and retention policies');
      
      if (!assistantConfig.autoCleanup) {
        recommendations.push('Enable auto-cleanup to prevent resource accumulation in production');
      }
    } else {
      recommendations.push('Consider enabling debug logging for development environment');
      recommendations.push('Use lower cost thresholds for development testing');
    }

    // Performance recommendations
    if (assistantConfig.usageThreshold > 1000) {
      recommendations.push('Consider lowering usage threshold for better cost control');
    }

    if (assistantConfig.vectorStoreExpiration > 7) {
      recommendations.push('Consider shorter vector store expiration to reduce storage costs');
    }

    // Security recommendations
    recommendations.push('Regularly rotate OpenAI API keys');
    recommendations.push('Monitor API usage for unusual patterns');
    recommendations.push('Implement rate limiting at application level');

    return recommendations;
  }

  /**
   * Validates environment-specific requirements
   */
  private validateEnvironment(): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 16) {
      errors.push(`Node.js version ${nodeVersion} is not supported. Minimum required: 16.x`);
    } else if (majorVersion < 18) {
      warnings.push(`Node.js version ${nodeVersion} is supported but consider upgrading to 18.x or later`);
    }

    // Check available memory
    const totalMemory = process.memoryUsage();
    const availableMemoryMB = (totalMemory.heapTotal + totalMemory.external) / (1024 * 1024);
    if (availableMemoryMB < 512) {
      warnings.push(`Available memory (${availableMemoryMB.toFixed(0)}MB) may be insufficient for large file processing`);
    }

    // Check disk space for temporary files
    try {
      const stats = fs.statSync(process.cwd());
      // This is a simplified check - in production, you'd check actual disk space
      if (!stats.isDirectory()) {
        warnings.push('Working directory access may be limited');
      }
    } catch (error) {
      warnings.push('Unable to verify disk space availability');
    }

    // Check network connectivity (simplified)
    const hasInternetAccess = process.env.OFFLINE !== 'true';
    if (!hasInternetAccess) {
      errors.push('Internet access is required for OpenAI API connectivity');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  // Health check implementations
  private async checkConfiguration(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const validation = this.validateConfiguration();
      const duration = Date.now() - startTime;

      if (!validation.isValid) {
        return {
          name: 'Configuration',
          status: 'fail',
          message: `Configuration validation failed: ${validation.errors.join(', ')}`,
          duration,
          details: { errors: validation.errors, warnings: validation.warnings }
        };
      }

      if (validation.warnings.length > 0) {
        return {
          name: 'Configuration',
          status: 'warning',
          message: `Configuration has warnings: ${validation.warnings.join(', ')}`,
          duration,
          details: { warnings: validation.warnings }
        };
      }

      return {
        name: 'Configuration',
        status: 'pass',
        message: 'Configuration is valid',
        duration
      };
    } catch (error) {
      return {
        name: 'Configuration',
        status: 'fail',
        message: `Configuration check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkAPIConnectivity(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const llmConfig = this.configManager.getLLMConfig();
      
      if (!llmConfig.apiKey) {
        return {
          name: 'API Connectivity',
          status: 'fail',
          message: 'No API key configured',
          duration: Date.now() - startTime
        };
      }

      // Initialize diagnostic service if not already done
      if (!this.diagnosticService) {
        this.diagnosticService = new DiagnosticService(llmConfig);
      }

      const diagnostics = await this.diagnosticService.runDiagnostics();
      const connectivityTest = diagnostics.find(d => d.test === 'API Connectivity');
      const duration = Date.now() - startTime;

      if (!connectivityTest) {
        return {
          name: 'API Connectivity',
          status: 'fail',
          message: 'Unable to run connectivity test',
          duration
        };
      }

      return {
        name: 'API Connectivity',
        status: connectivityTest.status,
        message: connectivityTest.message,
        duration,
        details: connectivityTest.details
      };
    } catch (error) {
      return {
        name: 'API Connectivity',
        status: 'fail',
        message: `API connectivity check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkModelAvailability(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      if (!this.diagnosticService) {
        const llmConfig = this.configManager.getLLMConfig();
        this.diagnosticService = new DiagnosticService(llmConfig);
      }

      const diagnostics = await this.diagnosticService.runDiagnostics();
      const modelTest = diagnostics.find(d => d.test === 'Model Availability');
      const duration = Date.now() - startTime;

      if (!modelTest) {
        return {
          name: 'Model Availability',
          status: 'fail',
          message: 'Unable to run model availability test',
          duration
        };
      }

      return {
        name: 'Model Availability',
        status: modelTest.status,
        message: modelTest.message,
        duration,
        details: modelTest.details
      };
    } catch (error) {
      return {
        name: 'Model Availability',
        status: 'fail',
        message: `Model availability check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkFileUploadCapability(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      if (!this.diagnosticService) {
        const llmConfig = this.configManager.getLLMConfig();
        this.diagnosticService = new DiagnosticService(llmConfig);
      }

      const diagnostics = await this.diagnosticService.runDiagnostics();
      const uploadTest = diagnostics.find(d => d.test === 'File Upload Capability');
      const duration = Date.now() - startTime;

      if (!uploadTest) {
        return {
          name: 'File Upload Capability',
          status: 'fail',
          message: 'Unable to run file upload test',
          duration
        };
      }

      return {
        name: 'File Upload Capability',
        status: uploadTest.status,
        message: uploadTest.message,
        duration,
        details: uploadTest.details
      };
    } catch (error) {
      return {
        name: 'File Upload Capability',
        status: 'fail',
        message: `File upload capability check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkAssistantCreationCapability(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const assistantConfig = this.configManager.getAssistantAPIConfig();
      
      if (!assistantConfig.enabled) {
        return {
          name: 'Assistant Creation Capability',
          status: 'warning',
          message: 'Assistant API is disabled',
          duration: Date.now() - startTime
        };
      }

      // Initialize assistant service if not already done
      if (!this.assistantService) {
        this.assistantService = createAssistantService();
        const llmConfig = this.configManager.getLLMConfig();
        await this.assistantService.initialize(llmConfig);
      }

      // Run a lightweight test to verify assistant creation capability
      // This would typically involve creating a minimal test assistant
      const diagnostics = await this.assistantService.runDiagnostics();
      const duration = Date.now() - startTime;

      // Check if any diagnostics failed
      const failedTests = diagnostics.filter((d: DiagnosticResult) => d.status === 'fail');
      if (failedTests.length > 0) {
        return {
          name: 'Assistant Creation Capability',
          status: 'fail',
          message: `Assistant creation tests failed: ${failedTests.map(t => t.message).join(', ')}`,
          duration,
          details: { failedTests }
        };
      }

      const warningTests = diagnostics.filter((d: DiagnosticResult) => d.status === 'warning');
      if (warningTests.length > 0) {
        return {
          name: 'Assistant Creation Capability',
          status: 'warning',
          message: `Assistant creation has warnings: ${warningTests.map(t => t.message).join(', ')}`,
          duration,
          details: { warningTests }
        };
      }

      return {
        name: 'Assistant Creation Capability',
        status: 'pass',
        message: 'Assistant creation capability verified',
        duration
      };
    } catch (error) {
      return {
        name: 'Assistant Creation Capability',
        status: 'fail',
        message: `Assistant creation capability check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkResourceCleanupCapability(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const resourceConfig = this.configManager.getResourceManagementConfig();
      
      if (!resourceConfig.monitoringEnabled) {
        return {
          name: 'Resource Cleanup Capability',
          status: 'warning',
          message: 'Resource monitoring is disabled',
          duration: Date.now() - startTime
        };
      }

      // Verify cleanup configuration
      if (resourceConfig.cleanupInterval <= 0) {
        return {
          name: 'Resource Cleanup Capability',
          status: 'fail',
          message: 'Invalid cleanup interval configuration',
          duration: Date.now() - startTime
        };
      }

      if (resourceConfig.maxOrphanedResources < 0) {
        return {
          name: 'Resource Cleanup Capability',
          status: 'fail',
          message: 'Invalid max orphaned resources configuration',
          duration: Date.now() - startTime
        };
      }

      return {
        name: 'Resource Cleanup Capability',
        status: 'pass',
        message: 'Resource cleanup capability verified',
        duration: Date.now() - startTime,
        details: {
          cleanupInterval: resourceConfig.cleanupInterval,
          maxOrphanedResources: resourceConfig.maxOrphanedResources,
          monitoringEnabled: resourceConfig.monitoringEnabled
        }
      };
    } catch (error) {
      return {
        name: 'Resource Cleanup Capability',
        status: 'fail',
        message: `Resource cleanup capability check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkPerformanceMetrics(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      if (!this.assistantService) {
        return {
          name: 'Performance Metrics',
          status: 'warning',
          message: 'Assistant service not initialized - cannot check performance metrics',
          duration: Date.now() - startTime
        };
      }

      const performanceReport = await this.assistantService.getPerformanceReport();
      const duration = Date.now() - startTime;

      // Analyze performance metrics
      if (performanceReport.successRate < 0.9) {
        return {
          name: 'Performance Metrics',
          status: 'warning',
          message: `Low success rate: ${(performanceReport.successRate * 100).toFixed(1)}%`,
          duration,
          details: performanceReport
        };
      }

      if (performanceReport.averageResponseTime > 30000) { // 30 seconds
        return {
          name: 'Performance Metrics',
          status: 'warning',
          message: `High average response time: ${(performanceReport.averageResponseTime / 1000).toFixed(1)}s`,
          duration,
          details: performanceReport
        };
      }

      return {
        name: 'Performance Metrics',
        status: 'pass',
        message: 'Performance metrics are within acceptable ranges',
        duration,
        details: {
          successRate: performanceReport.successRate,
          averageResponseTime: performanceReport.averageResponseTime,
          totalOperations: performanceReport.totalOperations
        }
      };
    } catch (error) {
      return {
        name: 'Performance Metrics',
        status: 'fail',
        message: `Performance metrics check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      };
    }
  }

  private async checkCostMonitoring(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const resourceConfig = this.configManager.getResourceManagementConfig();
      
      if (resourceConfig.costAlertThreshold <= 0) {
        return {
          name: 'Cost Monitoring',
          status: 'warning',
          message: 'Cost alert threshold not configured',
          duration: Date.now() - startTime
        };
      }

      if (!this.assistantService) {
        return {
          name: 'Cost Monitoring',
          status: 'warning',
          message: 'Assistant service not initialized - cannot check cost metrics',
          duration: Date.now() - startTime
        };
      }

      const costAnalysis = await this.assistantService.getCostAnalysis();
      const duration = Date.now() - startTime;

      // Check if costs are approaching threshold
      const dailyCost = costAnalysis.projectedMonthlyCost / 30;
      if (dailyCost > resourceConfig.costAlertThreshold) {
        return {
          name: 'Cost Monitoring',
          status: 'warning',
          message: `Daily cost ($${dailyCost.toFixed(2)}) exceeds threshold ($${resourceConfig.costAlertThreshold})`,
          duration,
          details: costAnalysis
        };
      }

      return {
        name: 'Cost Monitoring',
        status: 'pass',
        message: 'Cost monitoring is functioning correctly',
        duration,
        details: {
          dailyCost,
          threshold: resourceConfig.costAlertThreshold,
          totalCost: costAnalysis.totalCost
        }
      };
    } catch (error) {
      return {
        name: 'Cost Monitoring',
        status: 'fail',
        message: `Cost monitoring check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Creates or updates configuration files with validated settings
   */
  public createConfigurationTemplate(outputPath?: string): void {
    const configPath = outputPath || path.join(process.cwd(), 'config.template.json');
    
    const templateConfig: SystemConfig = {
      llm: {
        provider: 'openai',
        model: 'gpt-4',
        apiKey: '${OPENAI_API_KEY}',
        maxTokens: 2000,
        temperature: 0.7,
        timeout: 30000
      },
      game: {
        defaultRounds: 15,
        maxPlayers: 4,
        turnTimeoutSeconds: 60,
        gameStateDirectory: './game_states',
        maxNovelSizeMB: 50
      },
      testing: {
        outputDirectory: './test_outputs',
        cohesionAnalysisModel: 'gpt-4',
        testIterations: 6
      },
      assistantAPI: {
        enabled: true, // Enable by default in template
        model: 'gpt-4',
        maxFileSize: 100,
        vectorStoreExpiration: 7,
        autoCleanup: true,
        usageThreshold: 1000
      },
      fallback: {
        enableFallback: true,
        chunkSize: 4000,
        maxChunks: 10,
        truncationLimit: 40000,
        retryAttempts: 3
      },
      resourceManagement: {
        cleanupInterval: 60,
        maxOrphanedResources: 50,
        costAlertThreshold: 100,
        monitoringEnabled: true
      }
    };

    fs.writeFileSync(configPath, JSON.stringify(templateConfig, null, 2));
    console.log(`✅ Configuration template created at: ${configPath}`);
  }

  /**
   * Monitoring and alerting functionality
   */
  public addAlert(alert: Omit<MonitoringAlert, 'id' | 'timestamp'>): string {
    const alertWithId: MonitoringAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    this.alerts.push(alertWithId);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Trigger alert notifications if enabled
    if (this.alertingConfig.enabled) {
      this.processAlert(alertWithId);
    }

    return alertWithId.id;
  }

  public getAlerts(filter?: { type?: string; resolved?: boolean; since?: Date }): MonitoringAlert[] {
    let filteredAlerts = this.alerts;

    if (filter) {
      if (filter.type) {
        filteredAlerts = filteredAlerts.filter(alert => alert.type === filter.type);
      }
      if (filter.resolved !== undefined) {
        filteredAlerts = filteredAlerts.filter(alert => alert.resolved === filter.resolved);
      }
      if (filter.since) {
        filteredAlerts = filteredAlerts.filter(alert => alert.timestamp >= filter.since!);
      }
    }

    return filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  public configureAlerting(config: Partial<AlertingConfig>): void {
    this.alertingConfig = { ...this.alertingConfig, ...config };
  }

  private processAlert(alert: MonitoringAlert): void {
    // Log the alert
    const logLevel = alert.type === 'error' ? 'error' : alert.type === 'warning' ? 'warn' : 'info';
    console[logLevel](`🚨 [${alert.type.toUpperCase()}] ${alert.title}: ${alert.message}`);

    // Here you would implement actual notification logic
    // For now, we'll just log the alert processing
    if (this.alertingConfig.emailNotifications?.enabled) {
      console.log(`📧 Email notification would be sent for alert: ${alert.id}`);
    }

    if (this.alertingConfig.webhookNotifications?.enabled) {
      console.log(`🔗 Webhook notification would be sent for alert: ${alert.id}`);
    }
  }

  /**
   * Generate deployment report
   */
  public async generateDeploymentReport(): Promise<{
    timestamp: Date;
    validation: DeploymentValidationResult;
    configuration: ConfigurationValidationResult;
    environment: string;
    recommendations: string[];
  }> {
    const validation = await this.validateDeployment();
    const configuration = this.validateConfiguration();
    const environment = process.env.NODE_ENV || 'development';
    const recommendations = this.generateDeploymentRecommendations();

    return {
      timestamp: new Date(),
      validation,
      configuration,
      environment,
      recommendations
    };
  }
}

export function createDeploymentManager(): DeploymentManager {
  return DeploymentManager.getInstance();
}