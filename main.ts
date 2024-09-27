import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { NoteCreator } from "./src/noteCreator";
import { ConfigManager } from "./src/configManager";
import { NoteConfig } from "./src/types";
import "./styles.css";

export default class NoteCreatorPlugin extends Plugin {
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

		// Add settings tab
		this.addSettingTab(new NoteCreatorSettingTab(this.app, this));
	}

	async onunload() {
		await this.configManager.saveData();
	}
}

class NoteCreatorSettingTab extends PluginSettingTab {
	plugin: NoteCreatorPlugin;

	constructor(app: App, plugin: NoteCreatorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Note Creator Settings" });

		new Setting(containerEl)
			.setName("Configuration")
			.setDesc("JSON configuration for note types and questions")
			.addTextArea((text) =>
				text
					.setPlaceholder("Paste your JSON configuration here")
					.setValue(
						JSON.stringify(
							this.plugin.configManager.getNoteConfig(),
							null,
							2,
						),
					)
					.onChange(async (value) => {
						try {
							const noteConfig: NoteConfig = JSON.parse(value);
							this.plugin.configManager.setNoteConfig(noteConfig);
							await this.plugin.configManager.saveData();
						} catch (e) {
							console.error("Invalid JSON:", e);
						}
					}),
			);
	}
}
