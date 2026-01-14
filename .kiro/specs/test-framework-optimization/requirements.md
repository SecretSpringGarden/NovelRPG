# Requirements Document: TestFramework RAG Optimization

## Introduction

This specification defines the requirements for optimizing the TestFramework to efficiently reuse the RAG assistant across multiple game rounds. Currently, the TestFramework creates a new assistant and uploads the novel for each game (6 times), which is inefficient and costly. The optimization will analyze the novel once, reuse the assistant for all games, and cleanup resources at the end.

## Glossary

- **TestFramework**: Automated testing system that runs multiple games with different round counts
- **RAG Assistant**: OpenAI Assistant with file search capabilities for novel analysis
- **Novel Analysis**: Process of extracting characters, plot points, and narrative structure from a novel
- **Game Round**: A single game session with a specific number of rounds (10, 12, 14, 16, 18, or 20)
- **Resource Reuse**: Using the same assistant and uploaded file across multiple operations
- **Assistant Cleanup**: Deleting the assistant and uploaded file from OpenAI to avoid costs

## Requirements

### Requirement 1: Single Novel Analysis

**User Story:** As a test runner, I want the novel to be analyzed once before all games, so that I don't waste time and money re-analyzing the same novel.

#### Acceptance Criteria

1. THE TestFramework SHALL analyze the novel once before starting any games
2. THE TestFramework SHALL store the novel analysis results for reuse across all games
3. THE TestFramework SHALL NOT call novel analysis for each individual game
4. THE TestFramework SHALL pass the pre-analyzed novel data to each game
5. THE TestFramework SHALL verify the novel analysis is complete before starting games
6. THE TestFramework SHALL fail fast if novel analysis fails, before attempting any games

### Requirement 2: Assistant Resource Reuse

**User Story:** As a cost-conscious developer, I want to reuse the same RAG assistant for all games, so that I minimize OpenAI API costs.

#### Acceptance Criteria

1. THE TestFramework SHALL upload the novel file to OpenAI once
2. THE TestFramework SHALL create one assistant for the novel
3. THE TestFramework SHALL reuse the same assistant across all game rounds
4. THE TestFramework SHALL NOT create multiple assistants for the same novel
5. THE TestFramework SHALL NOT upload the novel multiple times
6. THE TestFramework SHALL track the assistant ID and file ID for cleanup

### Requirement 3: Resource Cleanup After All Games

**User Story:** As a cost-conscious developer, I want resources cleaned up after all games complete, so that I don't pay for unused assistants and files.

#### Acceptance Criteria

1. THE TestFramework SHALL cleanup the assistant after all games complete successfully
2. THE TestFramework SHALL cleanup the assistant if any game fails
3. THE TestFramework SHALL cleanup the assistant if testing is interrupted
4. THE TestFramework SHALL delete both the assistant and the uploaded file
5. THE TestFramework SHALL log cleanup operations for verification
6. THE TestFramework SHALL handle cleanup errors gracefully without failing the test run

### Requirement 4: GameManager API Modification

**User Story:** As a developer, I want GameManager to accept pre-analyzed novel data, so that it doesn't need to re-analyze the novel.

#### Acceptance Criteria

1. THE GameManager SHALL accept optional pre-analyzed novel data in startGame()
2. THE GameManager SHALL skip novel analysis if pre-analyzed data is provided
3. THE GameManager SHALL validate pre-analyzed data before using it
4. THE GameManager SHALL fall back to analyzing the novel if no pre-analyzed data is provided
5. THE GameManager SHALL maintain backward compatibility with existing callers
6. THE GameManager SHALL log whether it used pre-analyzed data or performed analysis

### Requirement 5: Cost and Performance Metrics

**User Story:** As a developer, I want to see cost and performance improvements, so that I can verify the optimization worked.

#### Acceptance Criteria

1. THE TestFramework SHALL log the number of novel uploads performed
2. THE TestFramework SHALL log the number of assistants created
3. THE TestFramework SHALL log the total time for novel analysis
4. THE TestFramework SHALL log when resources are reused vs created
5. THE TestFramework SHALL report estimated cost savings from reuse
6. THE TestFramework SHALL compare metrics before and after optimization

### Requirement 6: Error Handling and Recovery

**User Story:** As a test runner, I want robust error handling, so that one failed game doesn't prevent cleanup or other games from running.

#### Acceptance Criteria

1. THE TestFramework SHALL continue to other games if one game fails
2. THE TestFramework SHALL cleanup resources even if games fail
3. THE TestFramework SHALL cleanup resources even if interrupted (Ctrl+C)
4. THE TestFramework SHALL log all errors without stopping the test run
5. THE TestFramework SHALL provide a summary of successes and failures
6. THE TestFramework SHALL ensure cleanup happens in finally blocks

### Requirement 7: NovelAnalyzer Cleanup Method

**User Story:** As a developer, I want NovelAnalyzer to expose a cleanup method, so that I can explicitly cleanup resources when done.

#### Acceptance Criteria

1. THE NovelAnalyzer SHALL expose a public cleanup() method
2. THE NovelAnalyzer SHALL cleanup assistant and file resources when cleanup() is called
3. THE NovelAnalyzer SHALL track whether resources need cleanup
4. THE NovelAnalyzer SHALL be idempotent (safe to call cleanup multiple times)
5. THE NovelAnalyzer SHALL log cleanup operations
6. THE NovelAnalyzer SHALL clear internal state after cleanup

### Requirement 8: Testing and Validation

**User Story:** As a developer, I want tests to verify the optimization works, so that I can be confident in the changes.

#### Acceptance Criteria

1. THE System SHALL have tests verifying novel analysis happens once
2. THE System SHALL have tests verifying assistant reuse across games
3. THE System SHALL have tests verifying cleanup is called
4. THE System SHALL have tests verifying error handling during cleanup
5. THE System SHALL have tests verifying backward compatibility
6. THE System SHALL have integration tests for the full test framework flow

### Requirement 9: Documentation Updates

**User Story:** As a developer, I want updated documentation, so that I understand how the optimized TestFramework works.

#### Acceptance Criteria

1. THE System SHALL document the optimization in code comments
2. THE System SHALL update TestFramework documentation
3. THE System SHALL document the new GameManager API
4. THE System SHALL document cost savings from optimization
5. THE System SHALL provide examples of the optimized flow
6. THE System SHALL document cleanup behavior

### Requirement 10: Backward Compatibility

**User Story:** As a developer, I want existing code to continue working, so that the optimization doesn't break anything.

#### Acceptance Criteria

1. THE GameManager SHALL work with or without pre-analyzed data
2. THE GameManager SHALL maintain the same public API
3. THE NovelAnalyzer SHALL work as before for single-game scenarios
4. THE System SHALL not break existing tests
5. THE System SHALL not break existing game flows
6. THE System SHALL provide migration guidance if needed
