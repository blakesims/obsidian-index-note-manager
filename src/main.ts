import { Plugin } from 'obsidian';
import { ConfigManager } from './configManager';
import { IndexNoteManagerSettingTab } from './settings';
import { IndexNoteManagerPlugin as IIndexNoteManagerPlugin } from './pluginTypes';

export class IndexNoteManagerPlugin extends Plugin implements IIndexNoteManagerPlugin {
	configManager: ConfigManager;

	async onload() {
		this.configManager = new ConfigManager(this);
		await this.configManager.loadData();

		// Add settings tab
		this.addSettingTab(new IndexNoteManagerSettingTab(this.app, this));

		// ... rest of your onload code ...
	}

	async onunload() {
		// ... your existing onunload code ...
	}
} 