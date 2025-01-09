# Technical Report: Index Note Manager Plugin Issues & Required Changes

## 1. Front Matter Array Formatting Issues

**Location**: `src/frontMatterGenerator.ts`

Current implementation:

```typescript
private formatAnswer(
    answerObj: { value: any; type: string },
    frontMatterType: string,
    multipleSelections: boolean,
): string {
    if (multipleSelections) {
        const arrayValue = Array.isArray(value) ? value : [value];
        return "\n" + arrayValue.map((item) => `  - "${item}"`).join("\n");
    }
}
```

Issues found:

1. Incorrect array handling in front matter:

```yaml
course: "[[["courseA","new-course-2nd-entry"]]]"  # Current
course:  # Should be
  - "[[courseA]]"
  - "[[new-course-2nd-entry]]"
```

Required changes:

```typescript:src/frontMatterGenerator.ts
private formatAnswer(
    answerObj: { value: any; type: string },
    frontMatterType: string,
    multipleSelections: boolean,
): string {
    const { value } = answerObj;

    if (multipleSelections || Array.isArray(value)) {
        const arrayValue = Array.isArray(value) ? value : [value];
        if (frontMatterType === "link") {
            return arrayValue.map(item => `\n  - "[[${item}]]"`).join("");
        }
        return arrayValue.map(item => `\n  - "${item}"`).join("");
    }
    // ... rest of the method
}
```

## 2. Placeholder Replacement in Questions

**Location**: `src/placeholderUtils.ts`

Current issue:

-   Student name not being replaced in course selection prompt
-   Example: "What course/s is {{student_name}} taking?"

Required changes:

```typescript:src/placeholderUtils.ts
replacePlaceholders(
    str: string,
    answers: Record<string, Answer>,
    allowArrays: boolean = false,
): string {
    // Add pre-processing for question text
    if (str.includes("{{") && answers) {
        const processedStr = str.replace(/{{([^}]+)}}/g, (match, key) => {
            const answer = answers[key.trim()];
            return answer ? answer.value : match;
        });
        return processedStr;
    }
    return str;
}
```

## 3. Special Characters in Filenames

**Location**: `src/noteUtils.ts`

Add validation for filenames:

```typescript:src/noteUtils.ts
private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9-_ ]/g, "-");
}

private getNewNotePath(
    subtypeConfig: NoteSubtype,
    answers: Record<string, Answer>,
): string {
    let folderPath = this.placeholderUtils.replacePlaceholders(
        subtypeConfig.folder,
        answers,
    );
    let fileName = this.sanitizeFileName(
        this.placeholderUtils.replacePlaceholders(
            subtypeConfig.title,
            answers,
        )
    );
    return `${folderPath}/${fileName}.md`;
}
```

## 4. Configuration Updates Required

In `data.json`:

1. Fix front matter templates for course entries:

```json
{
	"id": "course",
	"value": "{{course}}",
	"type": "link",
	"multipleSelections": true // Add this field
}
```

2. Update university link format:

```json
{
	"id": "university",
	"value": "{{university}} Homepage",
	"type": "link"
}
```

## Priority Order

1. Front matter array formatting (High Priority)

    - Affects note usability
    - Currently producing invalid YAML

2. Placeholder replacement (Medium Priority)

    - Affects user experience
    - Questions not showing correct context

3. Special characters in filenames (High Priority)
    - Could cause file system issues
    - Potential data corruption risk

## Testing Requirements

1. Create test cases for:

    - Multiple course selection
    - Special characters in names
    - Nested placeholder replacement
    - Array formatting in different front matter fields

2. Verify front matter generation for:
    - Single vs multiple selections
    - Link vs string types
    - Nested placeholders

## Additional Considerations

-   Add validation for index entry names
-   Implement error handling for invalid characters
-   Add logging for front matter generation steps
-   Consider adding a front matter preview option

## Future-Proofing and Edge Case Handling

### 1. Circular Dependency Prevention

**Location**: `src/configManager.ts`

```typescript:src/configManager.ts
private detectCycle(
    indexName: string,
    parentEntry: string,
    visited: Set<string> = new Set()
): boolean {
    const visitKey = `${indexName}:${parentEntry}`;
    if (visited.has(visitKey)) return true;
    visited.add(visitKey);

    const index = this.getIndexConfig(indexName);
    const entry = index.entries[parentEntry];

    for (const [childIndex, children] of Object.entries(entry.children || {})) {
        for (const child of children) {
            if (this.detectCycle(childIndex, child, new Set(visited))) {
                return true;
            }
        }
    }
    return false;
}
```

### 2. Multi-Parent Support Enhancement

Current data structure supports multiple parents but implementation needs updating:

```typescript:src/configManager.ts
async updateIndexEntries(
    indexName: string,
    newEntries: Record<string, IndexEntry>,
    parentEntries: string[] | null = null,  // Modified to array
): Promise<void> {
    const index = this.getIndexConfig(indexName);

    if (parentEntries?.length) {
        for (const parentEntry of parentEntries) {
            const parentIndex = this.getIndexConfig(index.parents[0]);
            const parentEntryData = parentIndex.entries[parentEntry];

            // Update each parent's children
            parentEntryData.children = parentEntryData.children || {};
            parentEntryData.children[indexName] =
                parentEntryData.children[indexName] || [];

            // ... rest of update logic
        }
    }
}
```

### 3. Depth Management

Add configurable depth limits:

```typescript:src/types.ts
interface PluginSettings {
    maxIndexDepth: number;
    allowMultipleParents: boolean;
    strictValidation: boolean;
}
```

```typescript:src/configManager.ts
private async validateDepth(
    indexName: string,
    parentEntry: string
): Promise<void> {
    const currentDepth = await this.calculateEntryDepth(indexName, parentEntry);
    if (currentDepth >= this.settings.maxIndexDepth) {
        throw new Error(
            `Maximum nesting depth (${this.settings.maxIndexDepth}) exceeded`
        );
    }
}
```

### 4. Index Integrity Checks

Implement periodic validation:

```typescript:src/configManager.ts
private validateIndexIntegrity(): void {
    // Check for orphaned entries
    this.validateOrphanedEntries();

    // Validate parent-child bidirectional references
    this.validateBidirectionalReferences();

    // Ensure level consistency
    this.validateLevelConsistency();
}

private validateOrphanedEntries(): void {
    for (const [indexName, index] of Object.entries(this.data.indexConfig.indices)) {
        for (const [entryName, entry] of Object.entries(index.entries)) {
            if (entry.metadata.parents?.length) {
                for (const parent of entry.metadata.parents) {
                    const parentIndex = this.getParentIndex(indexName);
                    if (!parentIndex.entries[parent]) {
                        throw new Error(`Orphaned entry detected: ${entryName} references non-existent parent ${parent}`);
                    }
                }
            }
        }
    }
}
```

### Implementation Priority

1. Circular dependency detection (Critical)
2. Multi-parent support completion (High)
3. Depth management implementation (Medium)
4. Index integrity validation (High)

### Testing Requirements

1. Circular reference scenarios
2. Multi-parent operations
    - Adding multiple parents
    - Removing single parent
    - Orphan prevention
3. Deep nesting cases
4. Index integrity edge cases
    - Deleted parents
    - Multiple parent updates
    - Cross-index references

These improvements will ensure the plugin can handle complex hierarchical relationships while maintaining data integrity and preventing common edge-case failures.
