# Future Considerations for Index Note Manager

## Schema and Data Structure Improvements

### Note Configuration
1. Consider moving `questions` out of `noteConfig` into its own top-level key for better organization
2. Evaluate the necessity of `indexName` in note subtypes - may be redundant or unused
3. Consider making `template` optional in subtypes (currently required)

### Question Types

#### TPSuggester Questions
1. Review redundancy of `answerId` being equal to `indexName`
2. Consider making `answerId` optional since it's derived from `indexName`
3. Add validation to ensure `indexName` references an existing index

#### Nested TPSuggester Questions
1. Enhance `indexName` validation:
   - Support for specifying complete index paths as arrays: `[level0, level1, ...]`
   - Validate that specified path represents a valid subgraph of existing nested indices
   - Add strict enforcement of parent-child relationships

2. Improve nested question flexibility:
   - Allow partial traversal of nested indices (e.g., only 3 levels of a 5-level deep index)
   - Add validation for maximum nest depth based on referenced index's depth
   - Consider making `questionId` optional in nested elements if not used

3. Parent References:
   - Add validation for `parents` array in nested elements
   - Ensure parent references form a valid chain in the index hierarchy
   - Consider adding validation for the order of parent references

### General Improvements
1. Add cross-reference validation:
   - Validate `newEntryNoteType` and `newEntryNoteSubtype` against existing types
   - Ensure all referenced indices exist in `indexConfig`
   - Validate question IDs referenced in note subtypes

2. Consider adding:
   - Version field for schema versioning
   - Documentation fields for complex structures
   - Metadata for tracking creation and modification dates

3. Performance Considerations:
   - Evaluate impact of validation on large configurations
   - Consider adding pagination or lazy loading for large index hierarchies
   - Optimize validation for frequently accessed patterns 