# Code Analysis: Note Creation System with Hierarchical Indices

## Core Index Structure

The system uses a hierarchical index structure defined in `data.json` with two key types of relationships:

1. **Nested Indices** (Parent-Child):

```typescript
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

### Example Hierarchical Relationships:

1. **University → Course**

```json
"university": {
    "nested": true,
    "level": 0,
    "children": ["course"],
    "entries": {
        "universityA": {
            "metadata": { "level": 0 },
            "children": {
                "course": ["courseA"]
            }
        }
    }
}
```

2. **Subject → Topic**

```json
"subject": {
    "nested": true,
    "level": 0,
    "children": ["topic"],
    "entries": {
        "subjectA": {
            "metadata": { "level": 0 },
            "children": {
                "topic": ["topicA"]
            }
        }
    }
}
```

## Recent Changes

The recent commit improved index relations clarity with these key updates:

```typescript:src/configManager.ts
async getIndexEntries(
    indexName: string,
    parentEntry: string | null = null,
): Promise<Record<string, IndexEntry> | string[]> {
    // ... existing code ...
    return parentEntryData.children?.[indexName] || [];
}

async updateIndexEntries(
    indexName: string,
    newEntries: Record<string, IndexEntry>,
    parentEntry: string | null = null,
): Promise<void> {
    // ... existing code ...
    index.entries[entryName] = {
        ...entryData,
        metadata: {
            ...entryData.metadata,
            level: index.level,
            parents: [],
        },
        children: {},
    };
}
```

Key improvements:

-   Better type safety with explicit return types
-   Consistent handling of parent-child relationships
-   Proper metadata preservation during updates
-   Empty arrays as default for missing children

## Note Creation Flows

### Simple Flow: Creating a Tutor Note

1. User initiates note creation
2. System prompts for note type ("Homepage")
3. System prompts for subtype ("Tutor")
4. System asks single question: "tutor_name_question"
5. Creates note with appropriate front matter and index entry

### Complex Flow: Creating a Course Note with Parent University

```typescript
// 1. User selects Course creation
const noteType = "Homepage";
const noteSubtype = "Course";

// 2. System triggers nested questions
const universityQuestion = {
	questionId: "university_name_question",
	type: "tpsuggester",
	indexName: "university",
};

const courseQuestion = {
	questionId: "course_name_question",
	type: "nestedTpsuggester",
	indexName: "course",
	parents: ["university"],
};

// 3. System updates indices
await configManager.updateIndexEntries(
	"course",
	{
		newCourse: {
			metadata: {
				level: 1,
				parents: ["selectedUniversity"],
			},
		},
	},
	"selectedUniversity",
);
```

## Key Components Interaction

1. **ConfigManager**: Handles index operations and data persistence
2. **QuestionHandler**: Manages hierarchical question flow
3. **NoteCreator**: Orchestrates note creation process
4. **FrontMatterGenerator**: Generates metadata based on answers

The system maintains consistency through careful index updates and validation of parent-child relationships throughout the note creation process.
