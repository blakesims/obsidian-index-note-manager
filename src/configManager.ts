import { Plugin } from "obsidian";
import { IndexEntry, NoteConfig, GlobalIndex } from "./types";
import { log } from "./debugUtils";

interface PluginData {
	noteConfig: NoteConfig;
	indexConfig: GlobalIndex; // Updated to match the structure of data.json
}

export class ConfigManager {
	private plugin: Plugin;
	private data: PluginData;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		this.data = {
			noteConfig: { noteTypes: [], questions: [] },
			indexConfig: { indices: {} }, // Updated to match the structure of data.json
		};
	}

	async loadData(): Promise<void> {
		const loadedData = (await this.plugin.loadData()) as PluginData;
		if (loadedData) {
			this.data = loadedData;
			log(
				"generalDebug",
				"Loaded data:",
				JSON.stringify(this.data, null, 2),
			);
		}
	}

	async saveData(): Promise<void> {
		await this.plugin.saveData(this.data);
		log("generalDebug", "Saved data:", JSON.stringify(this.data, null, 2));
	}

	getNoteConfig(): NoteConfig {
		return this.data.noteConfig;
	}

	setNoteConfig(noteConfig: NoteConfig): void {
		this.data.noteConfig = noteConfig;
		log(
			"generalDebug",
			"Set note config:",
			JSON.stringify(noteConfig, null, 2),
		);
	}

	async getIndexEntries(
		indexName: string,
		parentEntry: string | null = null,
	): Promise<Record<string, any>> {
		const entries = this.data.indexConfig.indices[indexName]?.entries || {};
		log(
			"generalDebug",
			`Getting index entries for ${indexName}, parent: ${parentEntry}`,
		);
		log("generalDebug", "All entries:", JSON.stringify(entries, null, 2));

		if (parentEntry) {
			const filteredEntries = Object.fromEntries(
				Object.entries(entries).filter(([_, entry]) =>
					(entry as any).metadata.parents?.includes(parentEntry),
				),
			);
			log(
				"generalDebug",
				"Filtered entries:",
				JSON.stringify(filteredEntries, null, 2),
			);
			return filteredEntries;
		}

		return entries;
	}

	async updateIndexEntries(
		indexName: string,
		newEntries: Record<string, IndexEntry>,
	): Promise<void> {
		if (!this.data.indexConfig.indices[indexName]) {
			this.data.indexConfig.indices[indexName] = {
				nested: false,
				level: 0,
				entries: {},
			};
		}

		const indexConfig = this.data.indexConfig.indices[indexName];

		for (const [entryName, entryData] of Object.entries(newEntries)) {
			// Set the correct level based on the index configuration
			entryData.metadata.level = indexConfig.level;

			this.data.indexConfig.indices[indexName].entries[entryName] =
				entryData;

			// Update parent entries if this is a nested entry
			if (
				entryData.metadata.parents &&
				entryData.metadata.parents.length > 0
			) {
				for (const parentName of entryData.metadata.parents) {
					// Find the correct parent index
					const parentIndexName =
						indexConfig.parents?.[0] || indexName;
					const parentEntry =
						this.data.indexConfig.indices[parentIndexName]?.entries[
							parentName
						];
					if (parentEntry) {
						if (!parentEntry.metadata.children) {
							parentEntry.metadata.children = [];
						}
						if (
							!parentEntry.metadata.children.includes(entryName)
						) {
							parentEntry.metadata.children.push(entryName);
						}
					}
				}
			}
		}

		await this.saveData();
		log(
			"generalDebug",
			"Updated index entries for",
			indexName,
			JSON.stringify(newEntries, null, 2),
		);
	}
}
