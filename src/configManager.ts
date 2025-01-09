import { Plugin } from "obsidian";
import { IndexEntry, NoteConfig, GlobalIndex, Index } from "./types";
import { log } from "./debugUtils";

interface PluginData {
	noteConfig: NoteConfig;
	indexConfig: GlobalIndex;
}

export class ConfigManager {
	private plugin: Plugin;
	private data: PluginData;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		this.data = {
			noteConfig: { noteTypes: [], questions: [] },
			indexConfig: { indices: {} },
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

	getIndexConfig(indexName: string): any {
		const index = this.data.indexConfig.indices[indexName];
		if (!index) {
			throw new Error(`Index ${indexName} not found`);
		}
		return index;
	}

	getAllIndices(): { [key: string]: Index } {
		return this.data.indexConfig.indices;
	}

	async addIndex(indexName: string, index: Index): Promise<void> {
		// Check if index already exists
		if (this.data.indexConfig.indices[indexName]) {
			throw new Error(`Index ${indexName} already exists`);
		}

		// Add the new index
		this.data.indexConfig.indices[indexName] = index;

		// Save the updated configuration
		await this.saveData();
		log(
			"generalDebug",
			"Added new index:",
			indexName,
			JSON.stringify(index, null, 2),
		);
	}

	async updateParentIndex(indexName: string, updatedIndex: Index): Promise<void> {
		// Check if index exists
		if (!this.data.indexConfig.indices[indexName]) {
			throw new Error(`Index ${indexName} not found`);
		}

		// Update the index
		this.data.indexConfig.indices[indexName] = updatedIndex;

		// Save the updated configuration
		await this.saveData();
		log(
			"generalDebug",
			"Updated parent index:",
			indexName,
			JSON.stringify(updatedIndex, null, 2),
		);
	}

	async getIndexEntries(
		indexName: string,
		parentEntry: string | null = null,
	): Promise<Record<string, IndexEntry> | string[]> {
		const index = this.getIndexConfig(indexName);
		if (parentEntry) {
			if (!index.parents || index.parents.length === 0) {
				throw new Error(`Index ${indexName} has no parent defined`);
			}
			const parentIndex = this.getIndexConfig(index.parents[0]);
			const parentEntryData = parentIndex.entries[parentEntry];
			if (!parentEntryData) {
				throw new Error(
					`Parent entry ${parentEntry} not found in index ${index.parents[0]}`,
				);
			}
			return parentEntryData.children?.[indexName] || [];
		}
		return index.entries;
	}

	async updateIndexEntries(
		indexName: string,
		newEntries: Record<string, IndexEntry>,
		parentEntry: string | null = null,
	): Promise<void> {
		const index = this.getIndexConfig(indexName);
		if (parentEntry) {
			if (!index.parents || index.parents.length === 0) {
				throw new Error(`Index ${indexName} has no parent defined`);
			}
			const parentIndex = this.getIndexConfig(index.parents[0]);
			const parentEntryData = parentIndex.entries[parentEntry];
			if (!parentEntryData) {
				throw new Error(
					`Parent entry ${parentEntry} not found in index ${index.parents[0]}`,
				);
			}
			parentEntryData.children = parentEntryData.children || {};
			parentEntryData.children[indexName] =
				parentEntryData.children[indexName] || [];
			for (const [entryName, entryData] of Object.entries(newEntries)) {
				if (!parentEntryData.children[indexName].includes(entryName)) {
					parentEntryData.children[indexName].push(entryName);
				}
				index.entries[entryName] = {
					...entryData,
					metadata: {
						...entryData.metadata,
						level: index.level,
						parents: [parentEntry],
					},
				};
			}
		} else {
			for (const [entryName, entryData] of Object.entries(newEntries)) {
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
