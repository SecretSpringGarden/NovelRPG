# Requirements Document

## Introduction

The OpenAI Assistants API with RAG (Retrieval Augmented Generation) enhancement addresses critical token limit issues in the Novel RPG Game system when processing large novels. The current system fails with novels like Pride & Prejudice (~387k characters) due to token constraints and rate limiting. This enhancement replaces direct LLM calls with OpenAI's Assistants API, which provides built-in file search capabilities and eliminates token limits through automatic chunking and retrieval.

## Glossary

- **Assistant_API**: OpenAI's Assistants API service that provides RAG capabilities
- **File_Search**: OpenAI's built-in RAG functionality for document retrieval
- **Assistant_Instance**: A created assistant with attached files for a specific novel
- **Novel_Upload**: Process of uploading novel text to OpenAI for RAG processing
- **RAG_Query**: A query to the assistant that retrieves relevant novel sections
- **Fallback_Service**: Original LLM service used when Assistant API is unavailable
- **Resource_Cleanup**: Process of removing assistants and files after use
- **Token_Limit**: Current constraint of ~4k tokens that causes failures with large novels

## Requirements

### Requirement 1: Assistant Service Implementation

**User Story:** As a system architect, I want to implement OpenAI Assistants API integration, so that the system can handle large novels without token limits.

#### Acceptance Criteria

1. WHEN the system needs to analyze a novel, THE Assistant_Service SHALL upload the novel file to OpenAI's file storage
2. WHEN a novel file is uploaded, THE Assistant_Service SHALL create an assistant instance with file search capabilities enabled
3. WHEN creating an assistant, THE Assistant_Service SHALL configure it with appropriate instructions for novel analysis
4. WHEN an assistant is created successfully, THE Assistant_Service SHALL return a unique assistant identifier
5. THE Assistant_Service SHALL support querying assistants with analysis prompts
6. WHEN querying an assistant, THE Assistant_Service SHALL return structured responses for character extraction, plot analysis, and story generation

### Requirement 2: Novel Analyzer Enhancement

**User Story:** As a novel analyzer, I want to use the Assistant API for large novel processing, so that token limits no longer cause analysis failures.

#### Acceptance Criteria

1. WHEN analyzing a novel larger than 100k characters, THE Novel_Analyzer SHALL use the Assistant API instead of direct LLM calls
2. WHEN using the Assistant API, THE Novel_Analyzer SHALL upload the novel once and reuse the assistant for multiple queries
3. WHEN extracting characters using Assistant API, THE Novel_Analyzer SHALL query the assistant with character extraction prompts
4. WHEN extracting plot points using Assistant API, THE Novel_Analyzer SHALL query the assistant with plot analysis prompts
5. WHEN identifying narrative structure using Assistant API, THE Novel_Analyzer SHALL query the assistant for introduction, climax, and conclusion
6. THE Novel_Analyzer SHALL maintain the same output format regardless of whether it uses Assistant API or direct LLM calls

### Requirement 3: Fallback Strategy Implementation

**User Story:** As a system administrator, I want fallback mechanisms when Assistant API fails, so that the system remains functional even when the new service is unavailable.

#### Acceptance Criteria

1. WHEN the Assistant API is unavailable or returns errors, THE System SHALL automatically fall back to the original LLM service
2. WHEN falling back to direct LLM calls, THE System SHALL use text truncation or chunking strategies for large novels
3. WHEN Assistant API quota is exceeded, THE System SHALL gracefully degrade to fallback methods
4. WHEN network connectivity issues prevent Assistant API access, THE System SHALL use cached results or fallback processing
5. THE System SHALL log all fallback events for monitoring and debugging purposes
6. WHEN fallback processing is used, THE System SHALL inform the user that reduced functionality is in effect

### Requirement 4: Resource Management and Cleanup

**User Story:** As a cost-conscious administrator, I want proper cleanup of OpenAI resources, so that we don't accumulate unnecessary storage costs and resource usage.

#### Acceptance Criteria

1. WHEN a novel analysis session completes, THE Assistant_Service SHALL delete the created assistant instance
2. WHEN an assistant is deleted, THE Assistant_Service SHALL also remove the uploaded novel file from OpenAI storage
3. WHEN the system encounters errors during processing, THE Assistant_Service SHALL still attempt to clean up created resources
4. WHEN multiple analysis sessions run concurrently, THE Assistant_Service SHALL track and clean up each session's resources independently
5. THE System SHALL provide manual cleanup commands for orphaned resources
6. WHEN cleanup fails, THE System SHALL log the failure and provide administrator guidance for manual cleanup

### Requirement 5: Performance and Rate Limiting Improvements

**User Story:** As a user running automated tests, I want improved performance and reduced rate limiting, so that cohesion analysis completes faster and more reliably.

#### Acceptance Criteria

1. WHEN using Assistant API, THE System SHALL experience reduced rate limiting compared to direct LLM calls
2. WHEN processing multiple novels concurrently, THE Assistant_Service SHALL manage API calls more efficiently than the current approach
3. WHEN running automated testing, THE System SHALL complete cohesion analysis faster than the current implementation
4. THE Assistant_Service SHALL implement appropriate retry logic with exponential backoff for API failures
5. WHEN API rate limits are encountered, THE Assistant_Service SHALL queue requests rather than failing immediately
6. THE System SHALL provide progress indicators for long-running Assistant API operations

### Requirement 6: Configuration and Integration

**User Story:** As a developer, I want seamless integration with existing configuration, so that the Assistant API enhancement requires minimal setup changes.

#### Acceptance Criteria

1. WHEN the system starts, THE Assistant_Service SHALL use the existing OpenAI API key from configuration
2. WHEN Assistant API is enabled, THE System SHALL use the same model configuration (GPT-4) as the existing LLM service
3. THE Configuration system SHALL support enabling/disabling Assistant API through a feature flag
4. WHEN Assistant API is disabled via configuration, THE System SHALL use only the fallback LLM service
5. THE System SHALL validate Assistant API configuration on startup and report any issues
6. WHEN configuration changes are made, THE System SHALL apply them without requiring code changes

### Requirement 7: Error Handling and Monitoring

**User Story:** As a system administrator, I want comprehensive error handling and monitoring, so that I can troubleshoot Assistant API issues effectively.

#### Acceptance Criteria

1. WHEN Assistant API calls fail, THE System SHALL log detailed error information including API response codes and messages
2. WHEN file upload operations fail, THE System SHALL provide specific guidance on file size limits and format requirements
3. WHEN assistant creation fails, THE System SHALL attempt cleanup of any partially created resources
4. THE System SHALL track and report Assistant API usage metrics including file uploads, queries, and costs
5. WHEN quota limits are approached, THE System SHALL warn administrators before hitting limits
6. THE System SHALL provide diagnostic commands to test Assistant API connectivity and configuration

### Requirement 8: Backward Compatibility

**User Story:** As an existing user, I want the system to continue working with my current workflows, so that the Assistant API enhancement doesn't break existing functionality.

#### Acceptance Criteria

1. WHEN processing small novels (under 100k characters), THE System SHALL continue using direct LLM calls by default for optimal performance
2. WHEN the Assistant API feature is disabled, THE System SHALL function identically to the previous version
3. THE System SHALL maintain the same command-line interface and user experience regardless of which processing method is used
4. WHEN switching between Assistant API and fallback methods, THE System SHALL produce equivalent analysis results
5. THE System SHALL support all existing novel formats and file types without modification
6. WHEN running existing automated tests, THE System SHALL pass all tests regardless of processing method used