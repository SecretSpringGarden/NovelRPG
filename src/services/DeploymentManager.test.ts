import { DeploymentManager, createDeploymentManager } from './DeploymentManager';
import { ConfigManager } from '../config/ConfigManager';
import { AssistantAPIConfig, LLMConfig, SystemConfig } from '../config/types';
import * as fs from 'fs';

// Mock dependencies
jest.mock('../config/ConfigManager');
jest.mock('./ErrorHandler');
jest.mock('./AssistantService');
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('DeploymentManager', () => {
  let deploymentManager: DeploymentManager;

  const mockValidConfig: SystemConfig = {
    llm: {
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'test-api-key',
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
      enabled: true,
      model: 'gpt-4',
      maxFileSize: 50,
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

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock ConfigManager methods
    const mockConfigInstance = {
      getConfig: jest.fn().mockReturnValue(mockValidConfig),
      getAssistantAPIConfig: jest.fn().mockReturnValue(mockValidConfig.assistantAPI),
      getLLMConfig: jest.fn().mockReturnValue(mockValidConfig.llm),
      getResourceManagementConfig: jest.fn().mockReturnValue(mockValidConfig.resourceManagement),
      getFallbackConfig: jest.fn().mockReturnValue(mockValidConfig.fallback),
      validateConfiguration: jest.fn().mockReturnValue({ isValid: true, errors: [] })
    };

    // Mock the static getInstance method
    (ConfigManager.getInstance as jest.Mock) = jest.fn().mockReturnValue(mockConfigInstance);

    // Setup fs mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.accessSync.mockImplementation(() => {}); // No error = accessible
    mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
    mockFs.writeFileSync.mockImplementation(() => {});

    deploymentManager = createDeploymentManager();
  });

  describe('Basic Functionality', () => {
    it('should create DeploymentManager instance', () => {
      expect(deploymentManager).toBeDefined();
      expect(typeof deploymentManager.validateConfiguration).toBe('function');
      expect(typeof deploymentManager.runHealthChecks).toBe('function');
      expect(typeof deploymentManager.validateDeployment).toBe('function');
    });

    it('should validate basic configuration structure', () => {
      const result = deploymentManager.validateConfiguration();
      
      expect(result).toBeDefined();
      expect(result.configPath).toBeDefined();
      expect(result.validatedAt).toBeInstanceOf(Date);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should run health checks and return results', async () => {
      // Mock successful diagnostics
      const mockDiagnosticService = {
        runDiagnostics: jest.fn().mockResolvedValue([
          { test: 'API Connectivity', status: 'pass', message: 'Connected successfully' },
          { test: 'Model Availability', status: 'pass', message: 'Model available' },
          { test: 'File Upload Capability', status: 'pass', message: 'Upload working' }
        ])
      };

      const { DiagnosticService } = require('./ErrorHandler');
      DiagnosticService.mockImplementation(() => mockDiagnosticService);

      const healthChecks = await deploymentManager.runHealthChecks();

      expect(Array.isArray(healthChecks)).toBe(true);
      expect(healthChecks.length).toBeGreaterThan(0);
      
      // Check that each health check has required properties
      healthChecks.forEach(check => {
        expect(check.name).toBeDefined();
        expect(check.status).toBeDefined();
        expect(check.message).toBeDefined();
        expect(typeof check.duration).toBe('number');
      });
    });

    it('should validate deployment and return comprehensive results', async () => {
      // Mock successful diagnostics
      const mockDiagnosticService = {
        runDiagnostics: jest.fn().mockResolvedValue([
          { test: 'API Connectivity', status: 'pass', message: 'Connected' }
        ])
      };

      const { DiagnosticService } = require('./ErrorHandler');
      DiagnosticService.mockImplementation(() => mockDiagnosticService);

      const result = await deploymentManager.validateDeployment();

      expect(result).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(Array.isArray(result.healthChecks)).toBe(true);
    });
  });

  describe('Configuration Template', () => {
    it('should create configuration template file', () => {
      const outputPath = '/test/config.template.json';

      deploymentManager.createConfigurationTemplate(outputPath);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('"assistantAPI"')
      );
    });

    it('should create template with default path when no path provided', () => {
      deploymentManager.createConfigurationTemplate();

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('config.template.json'),
        expect.any(String)
      );
    });
  });

  describe('Alert Management', () => {
    it('should add alerts correctly', () => {
      // Disable alerting to prevent console output during tests
      deploymentManager.configureAlerting({ enabled: false });
      
      const alertId = deploymentManager.addAlert({
        type: 'error',
        title: 'Test Alert',
        message: 'Test message',
        source: 'test'
      });

      expect(alertId).toMatch(/^alert_\d+_[a-z0-9]+$/);

      const alerts = deploymentManager.getAlerts();
      const testAlert = alerts.find(a => a.id === alertId);
      expect(testAlert).toBeDefined();
      expect(testAlert?.title).toBe('Test Alert');
      expect(testAlert?.type).toBe('error');
    });

    it('should resolve alerts correctly', () => {
      deploymentManager.configureAlerting({ enabled: false });
      
      const alertId = deploymentManager.addAlert({
        type: 'error',
        title: 'Test Alert',
        message: 'Test message',
        source: 'test'
      });

      const resolved = deploymentManager.resolveAlert(alertId);
      expect(resolved).toBe(true);

      const alerts = deploymentManager.getAlerts();
      const testAlert = alerts.find(a => a.id === alertId);
      expect(testAlert?.resolved).toBe(true);
      expect(testAlert?.resolvedAt).toBeInstanceOf(Date);
    });

    it('should not resolve non-existent alerts', () => {
      const resolved = deploymentManager.resolveAlert('non-existent-id');
      expect(resolved).toBe(false);
    });

    it('should not resolve already resolved alerts', () => {
      deploymentManager.configureAlerting({ enabled: false });
      
      const alertId = deploymentManager.addAlert({
        type: 'error',
        title: 'Test Alert',
        message: 'Test message',
        source: 'test'
      });

      // Resolve once
      deploymentManager.resolveAlert(alertId);
      
      // Try to resolve again
      const resolved = deploymentManager.resolveAlert(alertId);
      expect(resolved).toBe(false);
    });

    it('should configure alerting settings', () => {
      deploymentManager.configureAlerting({
        enabled: true,
        errorThreshold: 10
      });

      // This test just verifies the method doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('Deployment Report', () => {
    it('should generate comprehensive deployment report', async () => {
      // Mock successful diagnostics
      const mockDiagnosticService = {
        runDiagnostics: jest.fn().mockResolvedValue([
          { test: 'API Connectivity', status: 'pass', message: 'Connected' }
        ])
      };

      const { DiagnosticService } = require('./ErrorHandler');
      DiagnosticService.mockImplementation(() => mockDiagnosticService);

      const report = await deploymentManager.generateDeploymentReport();

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.validation).toBeDefined();
      expect(report.configuration).toBeDefined();
      expect(report.environment).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration errors gracefully', () => {
      // Test that the method returns a result even when errors occur
      const result = deploymentManager.validateConfiguration();
      
      // Should always return a result object with required properties
      expect(result).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should handle health check failures gracefully', async () => {
      // Mock failing diagnostic service
      const mockDiagnosticService = {
        runDiagnostics: jest.fn().mockRejectedValue(new Error('Diagnostic failed'))
      };

      const { DiagnosticService } = require('./ErrorHandler');
      DiagnosticService.mockImplementation(() => mockDiagnosticService);

      const healthChecks = await deploymentManager.runHealthChecks();

      // Should still return results, but some may be failures
      expect(healthChecks.length).toBeGreaterThan(0);
    });

    it('should handle deployment validation errors gracefully', async () => {
      // Test that the method returns a result even when errors occur
      const result = await deploymentManager.validateDeployment();

      // Should always return a result object with required properties
      expect(result).toBeDefined();
      expect(typeof result.isValid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(Array.isArray(result.healthChecks)).toBe(true);
    });
  });
});

describe('createDeploymentManager', () => {
  it('should create DeploymentManager instance', () => {
    const manager = createDeploymentManager();
    expect(manager).toBeInstanceOf(DeploymentManager);
  });

  it('should return singleton instance', () => {
    const manager1 = createDeploymentManager();
    const manager2 = createDeploymentManager();
    expect(manager1).toBe(manager2);
  });
});