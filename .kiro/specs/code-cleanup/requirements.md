# Requirements Document: Code Cleanup for RAG-Only Architecture

## Introduction

This specification defines the requirements for cleaning up legacy code from the transition from a direct LLM approach to a RAG-only approach using OpenAI's Assistants API. The system has evolved to use Assistant API exclusively, eliminating token limits through RAG capabilities. This cleanup will remove stale fallback logic, direct LLM processing code, and other legacy components while ensuring all tests continue to pass.

## Glossary

- **RAG**: Retrieval Augmented Generation - OpenAI's approach using file search with vector stores
- **Assistant API**: OpenAI's Assistants API with built-in RAG capabilities
- **Direct LLM**: Legacy approach of sending novel text directly to LLM (subject to token limits)
- **Fallback Handler**: Legacy system for falling back to direct LLM when Assistant API failed
- **Legacy Code**: Code that was used in the old direct LLM approach but is no longer needed
- **Stale Code**: Unused or obsolete code that should be removed
- **Test Coverage**: Ensuring all required tests continue to pass after cleanup

## Requirements

### Requirement 1: Remove Legacy Fallback System

**User Story:** As a developer, I want to remove the legacy fallback system, so that the codebase only contains RAG-based processing logic.

#### Acceptance Criteria

1. THE System SHALL remove the FallbackHandler class and all its implementations
2. THE System SHALL remove all imports and references to FallbackHandler from other modules
3. THE System SHALL remove FallbackHandler tests that are no longer relevant
4. THE System SHALL remove FallbackHandler exports from the services index
5. THE System SHALL verify that NovelAnalyzer no longer contains fallback logic
6. THE System SHALL ensure no code attempts to fall back to direct LLM processing

### Requirement 2: Clean Up Direct LLM Processing Code

**User Story:** As a developer, I want to remove direct LLM processing code, so that the system only uses Assistant API with RAG.

#### Acceptance Criteria

1. THE System SHALL identify and remove any direct LLM processing methods in NovelAnalyzer
2. THE System SHALL remove any token limit handling code that is no longer needed
3. THE System SHALL remove any text chunking or truncation logic used for direct LLM calls
4. THE System SHALL verify that all novel processing goes through Assistant API
5. THE System SHALL remove any configuration options related to direct LLM processing
6. THE System SHALL update documentation to reflect RAG-only architecture

### Requirement 3: Remove Obsolete Test Files

**User Story:** As a developer, I want to remove obsolete test files, so that the test suite only contains relevant tests.

#### Acceptance Criteria

1. THE System SHALL identify test files that test removed functionality
2. THE System SHALL remove test files for FallbackHandler if no longer needed
3. THE System SHALL remove test files for direct LLM processing if no longer needed
4. THE System SHALL verify that all remaining tests pass after cleanup
5. THE System SHALL ensure test coverage for Assistant API functionality remains intact
6. THE System SHALL update test documentation to reflect current architecture

### Requirement 4: Clean Up Unused Utility Files

**User Story:** As a developer, I want to remove unused utility files, so that the codebase is lean and maintainable.

#### Acceptance Criteria

1. THE System SHALL identify and remove any orphaned or unused utility files
2. THE System SHALL remove files like `ooxncnxxAxxXI.txt` and `Vxzxx.txt` that appear to be temporary
3. THE System SHALL verify that no code references the removed utility files
4. THE System SHALL ensure the services directory only contains active, used files
5. THE System SHALL document any files that are kept for future use
6. THE System SHALL verify the build succeeds after removing unused files

### Requirement 5: Update Service Exports

**User Story:** As a developer, I want clean service exports, so that only active services are exported from the services module.

#### Acceptance Criteria

1. THE System SHALL update `src/services/index.ts` to remove exports for deleted services
2. THE System SHALL verify that all exported services are actively used
3. THE System SHALL ensure no broken imports exist after export cleanup
4. THE System SHALL organize exports in a logical order
5. THE System SHALL add comments to clarify the purpose of each export group
6. THE System SHALL verify that the build succeeds with updated exports

### Requirement 6: Maintain Test Framework Compatibility

**User Story:** As a developer, I want to ensure all tests continue to pass, so that the cleanup doesn't break existing functionality.

#### Acceptance Criteria

1. THE System SHALL run the complete test suite before cleanup to establish baseline
2. THE System SHALL run the complete test suite after each cleanup step
3. THE System SHALL ensure all property-based tests continue to pass
4. THE System SHALL ensure all integration tests continue to pass
5. THE System SHALL ensure all unit tests continue to pass
6. THE System SHALL verify that test coverage remains at or above current levels

### Requirement 7: Update Documentation References

**User Story:** As a developer, I want updated documentation, so that it accurately reflects the current RAG-only architecture.

#### Acceptance Criteria

1. THE System SHALL update all code comments that reference fallback logic
2. THE System SHALL update all code comments that reference direct LLM processing
3. THE System SHALL verify that README and documentation files are accurate
4. THE System SHALL remove any documentation for removed features
5. THE System SHALL ensure API documentation reflects current architecture
6. THE System SHALL update inline comments to clarify RAG-only approach

### Requirement 8: Verify Build and Type Safety

**User Story:** As a developer, I want to ensure the build succeeds, so that the cleanup doesn't introduce compilation errors.

#### Acceptance Criteria

1. THE System SHALL run TypeScript compilation after each cleanup step
2. THE System SHALL fix any type errors introduced by cleanup
3. THE System SHALL ensure no unused imports remain
4. THE System SHALL verify that all type definitions are correct
5. THE System SHALL ensure no circular dependencies are introduced
6. THE System SHALL verify that the production build succeeds

### Requirement 9: Clean Up Configuration Options

**User Story:** As a developer, I want clean configuration, so that only relevant options are available.

#### Acceptance Criteria

1. THE System SHALL identify configuration options related to fallback logic
2. THE System SHALL remove or deprecate configuration options for direct LLM processing
3. THE System SHALL update configuration documentation
4. THE System SHALL ensure configuration validation still works correctly
5. THE System SHALL verify that default configurations are appropriate for RAG-only mode
6. THE System SHALL update example configuration files

### Requirement 10: Maintain Backward Compatibility Where Needed

**User Story:** As a developer, I want to maintain backward compatibility for public APIs, so that existing integrations don't break.

#### Acceptance Criteria

1. THE System SHALL identify public APIs that might be used externally
2. THE System SHALL deprecate rather than remove public APIs if needed
3. THE System SHALL provide migration guidance for any breaking changes
4. THE System SHALL ensure internal refactoring doesn't affect public interfaces
5. THE System SHALL document any breaking changes in a CHANGELOG
6. THE System SHALL verify that the main entry points remain stable
