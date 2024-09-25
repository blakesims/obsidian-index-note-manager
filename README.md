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
