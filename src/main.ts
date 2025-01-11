import { App, Plugin } from "obsidian";
import { NoteCreator } from "./noteCreator";
import { ConfigManager } from "./configManager";
import { IndexNoteManagerSettingTab } from "./settings";
import { IndexNoteManagerPlugin as IIndexNoteManagerPlugin } from "./pluginTypes";
import "./styles.css";

export default class IndexNoteManagerPlugin extends Plugin implements IIndexNoteManagerPlugin {
	configManager: ConfigManager;
	noteCreator: NoteCreator;

	async onload() {
		this.configManager = new ConfigManager(this);
		await this.configManager.loadData();
		this.noteCreator = new NoteCreator(this.app, this.configManager);

		// Add a ribbon icon
		this.addRibbonIcon("create-new", "Create New Note", () => {
			this.noteCreator.createNote();
		});

		// Add a command
		this.addCommand({
			id: "create-new-note",
			name: "Create New Note",
			callback: () => {
				this.noteCreator.createNote();
			},
		});

		// Add settings tab with our new implementation
		this.addSettingTab(new IndexNoteManagerSettingTab(this.app, this));
	}

	async onunload() {
		await this.configManager.saveData();
	}
} 