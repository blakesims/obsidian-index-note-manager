# New Readme (AI-generated)

# Index and Note Manager (INM) for Obsidian

## Overview

The Index and Note Manager (INM) is a powerful Obsidian plugin designed to streamline the creation and management of structured notes and hierarchical indexes. It provides a flexible system for defining note types, subtypes, and associated questions, allowing for dynamic note creation with customized front matter.

## Core Features

1. **Index Management**: Create and manage nested indexes for organizing information hierarchically.
2. **Note Type Configuration**: Define custom note types and subtypes with specific templates and front matter structures.
3. **Dynamic Note Creation**: Generate notes based on index entries, automatically populating front matter and content.
4. **Flexible Question System**: Configure various question types to gather information for note creation and index population.

## Workflows

The INM plugin supports several workflows, ranging from simple to complex:

1. **Create a single new note with front matter from simple prompt answers**

    - User initiates note creation
    - System prompts for required information
    - Note is created with populated front matter

2. **Create a single new note with front matter from nested tpsuggester questions**

    - User initiates note creation
    - System presents nested selection options
    - User navigates through hierarchical choices
    - Note is created with populated front matter based on selections

3. **Create multiple notes with non-nested answers/questions**

    - User initiates primary note creation (e.g., student homepage)
    - System prompts for information, including related entities (e.g., tutor)
    - If a new related entity is specified, a separate note is created for it
    - Primary note is created with references to the new related notes

4. **Create multiple notes with child-nested answers**

    - User initiates primary note creation (e.g., student homepage)
    - System prompts for hierarchical information (e.g., university and course)
    - If a new child entity is specified (e.g., new course for existing university), a separate note is created for it
    - Primary note is created with references to the new and existing related notes

5. **Create multiple notes with new parent and child nested index entries**
    - User initiates primary note creation
    - System prompts for hierarchical information
    - If new parent and child entities are specified, separate notes are created for each
    - Index is updated with new hierarchical entries
    - Primary note is created with references to all new related notes

## Configuration

The INM plugin is configured using a JSON structure that defines note types, subtypes, questions, and index structures. Here's a basic example configuration:

```json
{
	"noteConfig": {
		"noteTypes": [
			{
				"id": "Student",
				"subtypes": [
					{
						"id": "UndergraduateStudent",
						"folder": "Students/Undergraduate",
						"template": "Templates/UndergraduateStudent.md",
						"frontMatter": [
							{
								"id": "type",
								"value": "student/undergraduate",
								"type": "string"
							},
							{
								"id": "name",
								"value": "{{student_name}}",
								"type": "string"
							},
							{
								"id": "university",
								"value": "{{university}}",
								"type": "link"
							},
							{
								"id": "course",
								"value": "{{course}}",
								"type": "link"
							}
						],
						"questions": [
							"student_name_question",
							"university_course_question"
						],
						"title": "{{student_name}} - Undergraduate"
					}
				]
			}
		],
		"questions": [
			{
				"questionId": "student_name_question",
				"answerId": "student_name",
				"type": "inputPrompt",
				"prompt": "Enter the student's name:"
			},
			{
				"questionId": "university_course_question",
				"type": "nestedTpsuggester",
				"indexName": "university",
				"nest": [
					{
						"questionId": "university_name_question",
						"answerId": "university",
						"prompt": "Select the university:",
						"allowManualEntry": true,
						"createNewEntry": true
					},
					{
						"questionId": "course_name_question",
						"answerId": "course",
						"prompt": "Select the course:",
						"allowManualEntry": true,
						"createNewEntry": true
					}
				]
			}
		]
	},
	"indexConfig": {
		"indices": {
			"university": {
				"nested": true,
				"level": 0,
				"children": ["course"],
				"entries": {}
			},
			"course": {
				"nested": true,
				"level": 1,
				"parents": ["university"],
				"entries": {}
			}
		}
	}
}
```

This configuration defines a "Student" note type with an "UndergraduateStudent" subtype. It includes two questions: a simple input prompt for the student's name and a nested tpsuggester for selecting the university and course.

## Creating New Index Entries

The `createNewEntry` process is a powerful feature of the INM plugin that allows for dynamic creation of new index entries and associated notes. Here's how it works:

1. When a question is configured with `allowManualEntry: true` and `createNewEntry: true`, users can input new values that don't exist in the current index.

2. If a user enters a new value, the system first updates the index with the new entry. For nested indexes, it maintains the hierarchical structure.

3. After updating the index, the system checks if a new note should be created for this entry (based on the configuration).

4. If a new note is to be created, the system uses the specified note type and subtype configuration to generate the note. It populates the front matter and content based on the available information and any templates specified.

5. The newly created note is then saved in the appropriate folder in the Obsidian vault.

6. Finally, the system returns to the original note creation process, now using the newly created index entry and note.

This process allows for seamless expansion of your knowledge base, creating new structured entries and notes on-the-fly as you work.

## Nested Indexes

The INM plugin supports nested indexes, allowing for hierarchical organization of information. In the example configuration above, "university" is a parent index, and "course" is its child. This structure allows for questions that navigate through this hierarchy, such as selecting a university first, then selecting (or creating) a course within that university.

## Under Development

The following features are currently under development:

1. **Plugin Settings Interface**: A user-friendly interface for configuring note types, subtypes, questions, and indexes is planned for future releases.
2. **Advanced Index Querying**: More sophisticated index querying and filtering capabilities are in the works.
3. **User-Defined Workflows**: Future versions will allow users to define custom workflows combining index operations and note creation.

Please note that while these features are not yet available, the core functionality of the plugin is operational.

## Error Handling

The INM plugin includes robust error handling to manage cases such as missing required information or attempts to create notes with non-existent answers. In such cases, the system will prompt the user for the required information rather than failing the note creation process.

---

# Index and Note Manager (INM) for Obsidian

## Overview

The Index and Note Manager (INM) is a powerful Obsidian plugin designed to streamline the creation and management of structured notes and hierarchical indexes. It provides a flexible system for defining note types, subtypes, and associated questions, allowing for dynamic note creation with customized front matter.

## Features

-   **Customizable Note Types and Subtypes**: Define various note structures to fit your workflow.
-   **Dynamic Question System**: Configure different types of questions (input prompts, suggesters, nested suggesters) for gathering information during note creation.
-   **Hierarchical Index Management**: Create and maintain nested indexes for organized information storage.
-   **Automated Front Matter Generation**: Generate front matter based on answers to configured questions.
-   **Template Support**: Use custom templates for different note types and subtypes.
-   **Nested Note Creation**: Automatically create related notes based on answers (e.g., creating a course note when adding a new course to a university).

## Configuration

The plugin is configured through a JSON structure that defines note types, subtypes, questions, and index structures. Access the configuration in the plugin settings:

1. Go to Settings > Plugin Options > Index and Note Manager.
2. Edit the JSON configuration to define your note types, subtypes, and questions.

Example configuration structure:

```json
{
	"noteConfig": {
		"noteTypes": [
			{
				"id": "ExampleType",
				"subtypes": [
					{
						"id": "ExampleSubtype",
						"folder": "Path/To/Folder",
						"template": "Path/To/Template.md",
						"questions": ["question1_id", "question2_id"],
						"frontMatter": [
							{
								"id": "title",
								"value": "{{title}}",
								"type": "string"
							}
						],
						"title": "{{title}}"
					}
				]
			}
		],
		"questions": [
			{
				"questionId": "question1_id",
				"answerId": "title",
				"type": "inputPrompt",
				"prompt": "Enter the title:"
			}
		]
	},
	"indexConfig": {
		"indices": {
			"exampleIndex": {
				"nested": false,
				"entries": {}
			}
		}
	}
}
```
