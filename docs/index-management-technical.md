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
- Create new entries in an index
- Reference existing entries
- Create nested relationships

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
- Templates for note creation
- Question configurations
- Front matter structure

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