# Requirements Document

## Introduction

This specification defines three major improvements to the Novel RPG Game system: enhanced game state logging with character names, a test framework for validating book conclusion identification accuracy, and a test framework for comparing different ending variations. These improvements will enhance game readability, validate LLM accuracy, and enable comparative analysis of story generation quality.

## Glossary

- **Game_State**: The complete state of an active game session including players, story segments, and metadata
- **Story_Segment**: A piece of generated narrative content created during gameplay
- **Character**: A main character from the analyzed novel assigned to a player
- **Player**: A participant in the game (human or computer) who controls a character
- **Novel_Analysis**: The result of processing a novel to extract characters, plot points, and narrative structure
- **Conclusion**: The ending portion of a novel's narrative structure
- **Ending_Variation**: A generated story ending that may be original, opposite, or random relative to the book's actual ending
- **Cohesion_Score**: A numerical rating (1-10) measuring how well a generated story aligns with the source novel
- **Test_Framework**: An automated system for running games and analyzing results
- **LLM_Service**: The language model service used for novel analysis and story generation
- **Action_Choice**: A player's selection between talk, act, or do nothing after viewing generated options
- **Book_Quote**: Actual dialogue or narrative text extracted from the source novel
- **Quote_Percentage**: A configurable parameter determining how often book quotes are used versus generated content
- **Dialogue_Context**: The section of the book from which character dialogue is extracted for a given round

## Requirements

### Requirement 1: Character Name Display in Game State

**User Story:** As a game observer, I want to see character names alongside player numbers in game logs, so that I can easily understand who is performing each action.

#### Acceptance Criteria

1. WHEN a story segment is generated, THE Game_State SHALL include the character name associated with the acting player
2. WHEN game events are logged, THE System SHALL display both player ID and character name in the format "Player X (Character Name)"
3. WHEN a game state file is saved, THE System SHALL include character names in all player action records
4. WHEN console output is generated during gameplay, THE System SHALL display character names for all player actions
5. WHERE a player has no assigned character, THE System SHALL display only the player ID without parentheses

### Requirement 2: Book Conclusion Identification Test Framework

**User Story:** As a system validator, I want to test the LLM's ability to correctly identify book conclusions, so that I can ensure novel analysis accuracy and consistency.

#### Acceptance Criteria

1. WHEN a conclusion test is initiated, THE Test_Framework SHALL analyze the same novel multiple times (configurable iterations)
2. WHEN each analysis completes, THE System SHALL extract and store the identified conclusion text
3. WHEN all iterations complete, THE System SHALL compare conclusions for consistency across iterations
4. WHEN generating test results, THE System SHALL score each conclusion for accuracy, completeness, and coherence on a 1-10 scale
5. WHEN creating test reports, THE System SHALL generate output in CSV, JSON, and text table formats
6. WHEN calculating consistency, THE System SHALL measure similarity between conclusion texts across iterations
7. WHERE conclusions differ significantly, THE System SHALL flag inconsistencies in the report

### Requirement 3: Multiple Ending Variations Test Framework

**User Story:** As a game designer, I want to test how different ending types affect story cohesion, so that I can understand which ending strategies produce the best narrative quality.

#### Acceptance Criteria

1. WHEN an ending variation test is initiated, THE System SHALL generate three distinct ending types: original, opposite, and random
2. WHEN generating an original ending, THE System SHALL create an ending that matches the book's actual conclusion
3. WHEN generating an opposite ending, THE System SHALL create an ending that inverts the book's conclusion outcome
4. WHEN generating a random ending, THE System SHALL create a creative alternative ending unrelated to the book's conclusion
5. WHEN running variation tests, THE System SHALL execute three separate games with 5 rounds each, one for each ending type
6. WHEN each game completes, THE System SHALL analyze the cohesion score for the generated story
7. WHEN all games complete, THE System SHALL generate a comparative report showing cohesion scores across ending types
8. WHEN creating comparative reports, THE System SHALL include statistics on which ending type achieved highest cohesion
9. WHEN saving test results, THE System SHALL create individual game state files for each ending variation

### Requirement 4: Test Framework Configuration

**User Story:** As a test operator, I want to configure test parameters, so that I can customize test execution for different scenarios.

#### Acceptance Criteria

1. WHEN configuring conclusion tests, THE System SHALL accept parameters for novel file path, iteration count, and output directory
2. WHEN configuring ending variation tests, THE System SHALL accept parameters for novel file path, round count, and output directory
3. WHEN round count is specified for ending variation tests, THE System SHALL validate it is between 1 and 20
4. WHEN iteration count is specified for conclusion tests, THE System SHALL validate it is between 1 and 10
5. WHERE no output directory is specified, THE System SHALL use the default test_outputs directory

### Requirement 5: Test Report Generation

**User Story:** As a test analyst, I want comprehensive test reports in multiple formats, so that I can analyze results using different tools.

#### Acceptance Criteria

1. WHEN a conclusion test completes, THE System SHALL generate a CSV report with columns for iteration, conclusion text, accuracy score, completeness score, coherence score, and word count
2. WHEN a conclusion test completes, THE System SHALL generate a JSON report with complete test data including all conclusions and scores
3. WHEN a conclusion test completes, THE System SHALL generate a text table report with formatted results
4. WHEN an ending variation test completes, THE System SHALL generate a CSV report with columns for ending type, description, rounds, cohesion score, and segments count
5. WHEN an ending variation test completes, THE System SHALL generate a comparative analysis showing which ending type performed best
6. WHEN generating any report, THE System SHALL include a timestamp and test configuration details

### Requirement 6: Novel Analysis Reuse

**User Story:** As a test operator, I want to reuse novel analysis across multiple test runs, so that I can reduce API calls and test execution time.

#### Acceptance Criteria

1. WHEN running ending variation tests, THE System SHALL analyze the novel once and reuse the analysis for all three games
2. WHEN running conclusion tests, THE System SHALL perform separate analyses for each iteration to test consistency
3. WHEN reusing analysis data, THE System SHALL validate the cached data is complete before proceeding
4. WHERE cached analysis is invalid, THE System SHALL perform a fresh analysis

### Requirement 7: API Rate Limiting

**User Story:** As a system operator, I want the test frameworks to respect API rate limits, so that tests don't fail due to rate limiting errors.

#### Acceptance Criteria

1. WHEN running multiple test iterations, THE System SHALL add delays between API calls to respect rate limits
2. WHEN an API rate limit error occurs, THE System SHALL wait and retry the operation
3. WHEN running ending variation tests, THE System SHALL add delays between game executions
4. WHEN running conclusion tests, THE System SHALL add delays between analysis iterations

### Requirement 8: Backward Compatibility

**User Story:** As a system maintainer, I want character name enhancements to be backward compatible, so that existing game states remain valid.

#### Acceptance Criteria

1. WHEN loading existing game state files, THE System SHALL handle game states without character names in story segments
2. WHEN displaying legacy game states, THE System SHALL gracefully handle missing character information
3. WHEN validating game states, THE System SHALL accept both old and new formats

### Requirement 9: CLI Test Execution

**User Story:** As a test operator, I want command-line scripts to run tests, so that I can easily execute tests without writing code.

#### Acceptance Criteria

1. WHEN executing the conclusion test script, THE System SHALL accept command-line arguments for novel file and iteration count
2. WHEN executing the ending variation test script, THE System SHALL accept command-line arguments for novel file and round count
3. WHEN a test script is executed without required arguments, THE System SHALL display usage instructions
4. WHEN a test completes successfully, THE System SHALL exit with status code 0
5. WHERE a test fails, THE System SHALL exit with a non-zero status code and display error information

### Requirement 10: Error Handling and Logging

**User Story:** As a test operator, I want clear error messages and progress logging, so that I can monitor test execution and diagnose issues.

#### Acceptance Criteria

1. WHEN a test starts, THE System SHALL log the test configuration and parameters
2. WHEN each test iteration or game completes, THE System SHALL log progress information
3. WHEN an error occurs, THE System SHALL log detailed error information including context
4. WHEN a test completes, THE System SHALL log summary statistics and output file locations
5. WHERE API calls fail, THE System SHALL log the specific API error and retry attempts

### Requirement 11: Player Action Choice System

**User Story:** As a player, I want to choose between talk, act, or do nothing after seeing generated options, so that I have more control over my character's actions.

#### Acceptance Criteria

1. WHEN a player's turn begins, THE LLM_Service SHALL generate both a talk option and an act option for that player
2. WHEN both options are generated, THE System SHALL display them to the player
3. WHEN options are displayed, THE System SHALL prompt the player to choose between talk, act, or do nothing
4. WHEN a player selects an option, THE System SHALL record the choice and apply the corresponding action
5. WHEN running automated tests, THE Test_Framework SHALL randomly select between talk, act, or do nothing for computer players
6. WHEN a player chooses "do nothing", THE System SHALL increment the total rounds as per existing game rules

### Requirement 12: Book Quote Integration

**User Story:** As a game designer, I want character dialogue and actions to use actual quotes from the book a configurable percentage of the time, so that the game feels more authentic to the source material.

#### Acceptance Criteria

1. WHEN the game is initialized, THE Game_State SHALL include a configurable Quote_Percentage parameter (0-100)
2. WHEN generating a talk action, THE System SHALL use an actual Book_Quote from the character's dialogue X% of the time, where X is the Quote_Percentage
3. WHEN generating an act action, THE System SHALL use an actual Book_Quote describing the character's actions X% of the time, where X is the Quote_Percentage
4. WHEN a Book_Quote is used, THE System SHALL extract dialogue or narrative text that matches the character from the source novel
5. WHERE the Quote_Percentage is 0, THE System SHALL always generate new content via the LLM
6. WHERE the Quote_Percentage is 100, THE System SHALL always use Book_Quotes when available
7. WHERE no suitable Book_Quote is found for a character, THE System SHALL fall back to LLM-generated content

### Requirement 13: Contextual Dialogue Grouping

**User Story:** As a game designer, I want all character dialogue in a given round to preferably come from the same section of the book, so that conversations feel more natural and contextually related.

#### Acceptance Criteria

1. WHEN a round begins, THE System SHALL identify a Dialogue_Context section from the source novel
2. WHEN extracting Book_Quotes for multiple characters in the same round, THE System SHALL prefer quotes from the same Dialogue_Context
3. WHEN multiple characters speak in a round, THE System SHALL attempt to extract their dialogue from the same scene or chapter
4. WHERE the selected Dialogue_Context does not contain dialogue for all characters, THE System SHALL expand the context or use LLM-generated content
5. WHEN a Dialogue_Context is selected, THE System SHALL log which section of the book is being used for that round

### Requirement 14: Enhanced Turn Display

**User Story:** As a game observer, I want to see both the character name and player number when a turn selection is made, so that I can clearly understand who made what choice.

#### Acceptance Criteria

1. WHEN a player makes a turn selection, THE System SHALL display the format "Character_Name (Player X) chose: [action]"
2. WHEN logging turn selections to game state files, THE System SHALL include both character name and player number
3. WHEN displaying turn history, THE System SHALL show character names and player numbers for all past turns
4. WHERE a player has no assigned character, THE System SHALL display only "Player X chose: [action]"

### Requirement 15: Code Cleanup and Refactoring

**User Story:** As a developer, I want to remove obsolete code and tests after implementing new features, so that the codebase remains maintainable and clean.

#### Acceptance Criteria

1. WHEN new action choice system is implemented, THE System SHALL remove old dice-roll-based action determination code
2. WHEN new test frameworks are implemented, THE System SHALL identify and remove obsolete test code
3. WHEN cleanup is performed, THE System SHALL update all documentation to reflect new behavior
4. WHEN cleanup is complete, THE System SHALL verify all remaining tests pass
5. WHERE code is removed, THE System SHALL ensure no breaking changes are introduced to public APIs

### Requirement 16: Comprehensive Testing with Pride and Prejudice

**User Story:** As a quality assurance engineer, I want to run the complete ending variation test suite on Pride and Prejudice, so that I can validate all new features work together correctly.

#### Acceptance Criteria

1. WHEN the ending variation test is run on Pride and Prejudice, THE System SHALL successfully generate original, opposite, and random endings
2. WHEN running Pride and Prejudice tests, THE System SHALL use the new action choice system for all player turns
3. WHEN running Pride and Prejudice tests, THE System SHALL apply the configured Quote_Percentage for book quote integration
4. WHEN running Pride and Prejudice tests, THE System SHALL group dialogue from the same book sections within rounds
5. WHEN Pride and Prejudice tests complete, THE System SHALL generate comprehensive reports comparing all three ending variations
6. WHEN test results are generated, THE System SHALL include metrics on book quote usage and dialogue context grouping effectiveness
