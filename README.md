# Overview

    1.	Project Goal: You're aiming to create an Obsidian plugin that allows users to create and maintain nested indexes and front matter for notes. This is a powerful idea that can greatly enhance note organization and metadata management in Obsidian.
    2.	Core Functionality:
    ▪	Users can define note types and subtypes
    ▪	Users can define front matter keys for each note type and subtype
    ▪	Questions can be of different types: raw text input, TPSuggester, or Nested TPSuggester
    ▪	Answers to questions can be index entries, sometimes nested (e.g., university/courses or subject/topic)
    3.	Script Structure: Your createNote.js script serves as the main orchestrator for the note creation process. It handles:
    ▪	Loading configurations
    ▪	User prompts for note type and subtype selection
    ▪	Question processing based on the selected subtype
    ▪	Front matter generation
    ▪	Note creation using templates
    4.	Index and Question Management: The system supports nested indexes and various question types, allowing for complex hierarchical structures in note organization.
    5.	Flexibility and Customization: Users can define their own note types, subtypes, and questions, making the system highly adaptable to different note-taking needs.
    6.	Integration with Obsidian: The script integrates well with Obsidian's API and plugins like Templater, enhancing the native functionality of Obsidian.

## Releasing new releases

-   Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
-   Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
-   Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
-   Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
-   Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`
