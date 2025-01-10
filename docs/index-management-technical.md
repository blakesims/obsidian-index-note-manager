# Index Management Technical Documentation

## Overview

The index management system in this plugin is designed to handle hierarchical relationships between different types of notes. The system is primarily driven by questions and their answers, rather than through direct note type relationships.

## Core Components

### 1. Index Configuration

The `indexConfig` in `data.json` defines the structure and relationships of indices:

```typescript
interface GlobalIndex {
	indices: {
		[key: string]: Index;
	};
}

interface Index {
	nested: boolean;
	level: number;
	parents?: string[];
	children?: string[];
	entries: { [key: string]: IndexEntry };
}

interface IndexEntry {
	metadata: {
		level: number;
		parents: string[];
	};
	children?: Record<string, string[]>;
}
```

### 2. Question-Driven Indexing

Indexing is managed through questions rather than note types. Questions can be configured to:

-   Create new entries in an index
-   Reference existing entries
-   Create nested relationships

#### Question Types

1. **Simple Questions** (`inputPrompt`)

    - Basic text input
    - Not indexed by default

2. **Indexed Questions** (`tpsuggester`)

    ```typescript
    {
        "questionId": "university_question",
        "type": "tpsuggester",
        "indexName": "university",  // Links to university index
        "createNewEntry": true,     // Can create new entries
        "allowManualEntry": true    // Allows manual entry of new values
    }
    ```

3. **Nested Questions** (`nestedTpsuggester`)
    - Handles parent-child relationships
    - Each nested question can create/reference entries in its respective index
    ```typescript
    {
        "type": "nestedTpsuggester",
        "indexName": "subject",     // Parent index
        "nest": [
            {
                "questionId": "subject_question",
                "answerId": "subject",
                "createNewEntry": true
            },
            {
                "questionId": "topic_question",
                "answerId": "topic",
                "parentAnswerId": "subject"  // Links to parent answer
            }
        ]
    }
    ```

### 3. Index Relationships

#### Single Parent-Child

```json
{
	"university": {
		"nested": true,
		"level": 0,
		"children": ["course"],
		"entries": {
			"University A": {
				"metadata": { "level": 0 },
				"children": {
					"course": ["Course 1", "Course 2"]
				}
			}
		}
	}
}
```

#### Multiple Children

An index can have multiple child indices:

```json
{
	"subject": {
		"nested": true,
		"children": ["topic", "resource"],
		"entries": {
			"Math": {
				"children": {
					"topic": ["Calculus", "Algebra"],
					"resource": ["Textbook A", "Video B"]
				}
			}
		}
	}
}
```

#### Multiple Parents

Entries can have multiple parents through the metadata:

```json
{
	"topic": {
		"entries": {
			"Machine Learning": {
				"metadata": {
					"parents": ["Computer Science", "Mathematics"]
				}
			}
		}
	}
}
```

## Implementation Details

### 1. Answer Storage

When a question with an `indexName` is answered:

```typescript
interface Answer {
	value: any;
	metadata: {
		indexed: boolean;
		level: number | null;
		parentAnswerId: string | null;
		indexName?: string;
	};
}
```

### 2. Index Updates

The system maintains relationships by:

1. Adding entries to the appropriate index
2. Updating parent-child relationships
3. Maintaining metadata about levels and relationships

### 3. Note Types and Indexing

Note types and subtypes are not directly involved in indexing. They provide:

-   Templates for note creation
-   Question configurations
-   Front matter structure

The actual indexing is handled through:

1. Question configurations (`indexName`, `createNewEntry`)
2. Answer metadata
3. Index structure in `indexConfig`

## Best Practices

1. **Index Naming**

    - Use simple, descriptive names
    - Avoid file extensions (e.g., .json)
    - Keep consistent with note types

2. **Question Configuration**

    - Set appropriate `indexName` for indexed questions
    - Configure `createNewEntry` for extensible indices
    - Use `nestedTpsuggester` for parent-child relationships

3. **Index Structure**
    - Define clear hierarchy levels
    - Maintain consistent parent-child relationships
    - Consider multiple parent scenarios

## Index Selection Constraints

### Child Index Selection in Questions

When configuring questions that use indices, there are important constraints to consider regarding child indices:

1. **Direct Child Index Selection**

    - A child index (e.g., 'course') should not be directly selectable in a single TPSuggester question
    - Child indices require context from their parent index to be meaningful
    - Example: Selecting a course requires knowing which university's courses we're choosing from

2. **Proper Usage Patterns**

    - Child indices should only be used in:
      a. Nested TPSuggester questions where the parent index is selected first
      b. Simple nested TPSuggester where parentAnswerId provides the context

3. **Implementation Requirements**

    - The question configuration modal should filter out child indices (level 1) from the index dropdown
    - Exception: When configuring nested questions where the parent-child relationship is explicit

4. **Data Structure Impact**
    ```json
    {
    	"indices": {
    		"university": {
    			"level": 0,
    			"children": ["course"]
    		},
    		"course": {
    			"level": 1,
    			"parents": ["university"]
    		}
    	}
    }
    ```
    - Child indices always require a parent context for entry selection
    - The parent-child relationship must be maintained in both directions

### Best Practices

1. Always use nested question types when dealing with child indices
2. Ensure parent context is established before child selection
3. Maintain clear documentation of index relationships
4. Consider the user experience flow when designing question sequences

## Investigation Points

### Configuration Redundancy

1. **Question IDs in Nested Questions**

    - The `questionId` field appears in both the outer nest configuration and inner nested questions
    - Investigation needed: Are the inner `questionId` fields necessary? They seem to be auto-generated and might be redundant
    - Current structure example:
        ```json
        {
          "questionId": "university_course_for_student_homepage",
          "nest": [
            {
              "questionId": "university_name_question",
              ...
            }
          ]
        }
        ```

2. **Front Matter Type Configuration**
    - The `frontMatterType` field appears at multiple levels in nested questions
    - Investigation needed: Is this redundant? Should it only be specified at one level?
    - Current structure example:
        ```json
        {
          "frontMatterType": "link",
          "nest": [
            {
              "frontMatterType": "link",
              ...
            }
          ]
        }
        ```

### Future Investigation Points

1. **Index Relationship Constraints**

    - Need to document and validate the constraints between parent and child indices
    - Consider whether current parent-child relationships are too restrictive
    - Investigate potential use cases for more flexible relationships

2. **Configuration Validation**

    - Need to implement comprehensive validation for the configuration structure
    - Ensure all required fields are present and correctly formatted
    - Validate relationships between different configuration elements

3. **Error Handling**
    - Review error handling for invalid configurations
    - Consider adding more detailed error messages and recovery options
    - Document common error scenarios and their resolutions

