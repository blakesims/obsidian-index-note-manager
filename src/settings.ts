import { App, PluginSettingTab, Setting, TextAreaComponent } from 'obsidian';
import { IndexNoteManagerPlugin } from './pluginTypes';
import { NoteType, NoteSubtype } from './types';

export class IndexNoteManagerSettingTab extends PluginSettingTab {
	plugin: IndexNoteManagerPlugin;
	jsonEditor: TextAreaComponent;
	
	constructor(app: App, plugin: IndexNoteManagerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		
		containerEl.createEl('h1', { text: 'Index Note Manager Settings' });
		
		// Add JSON Editor Section
		const jsonSection = containerEl.createEl('details', { cls: 'json-editor-section' });
		jsonSection.createEl('summary', { text: 'JSON Configuration' });
		
		new Setting(jsonSection)
			.setName('Configuration')
			.setDesc('Edit the raw JSON configuration')
			.addTextArea(text => {
				this.jsonEditor = text;
				text
					.setValue(JSON.stringify(this.plugin.configManager.getNoteConfig(), null, 2))
					.setPlaceholder('Enter your configuration here')
					.onChange(async (value) => {
						try {
							const config = JSON.parse(value);
							await this.plugin.configManager.setNoteConfig(config);
							await this.plugin.configManager.saveData();
							this.display(); // Refresh the display
						} catch (e) {
							console.error('Invalid JSON:', e);
						}
					});
				text.inputEl.rows = 20;
				text.inputEl.cols = 50;
			});
		
		// Note Types Section
		const noteTypesSection = containerEl.createEl('details', { cls: 'note-types-section' });
		noteTypesSection.createEl('summary', { text: 'Note Types' });
		
		// Get note types from the plugin's data
		const noteTypes = this.plugin.configManager.getNoteConfig().noteTypes;
		
		noteTypes.forEach((noteType: NoteType) => {
			const noteTypeContainer = noteTypesSection.createEl('details', { 
				cls: 'note-type-container'
			});
			
			noteTypeContainer.createEl('summary', { 
				text: `${noteType.id}`,
				cls: 'note-type-header'
			});
			
			// Display base front matter path if exists
			if (noteType.baseFrontMatterPath) {
				new Setting(noteTypeContainer)
					.setName('Base Front Matter Path')
					.setDesc(noteType.baseFrontMatterPath)
					.setClass('note-type-setting');
			}
			
			// Subtypes Section
			const subtypesContainer = noteTypeContainer.createEl('details', {
				cls: 'subtypes-container'
			});
			subtypesContainer.createEl('summary', { text: 'Subtypes' });
			
			noteType.subtypes.forEach((subtype: NoteSubtype) => {
				const subtypeDetails = subtypesContainer.createEl('details', {
					cls: 'subtype-details'
				});
				subtypeDetails.createEl('summary', { text: subtype.id });
				
				// Display subtype properties
				new Setting(subtypeDetails)
					.setName('Folder')
					.setDesc(subtype.folder)
					.setClass('subtype-setting');
					
				if (subtype.template) {
					new Setting(subtypeDetails)
						.setName('Template')
						.setDesc(subtype.template)
						.setClass('subtype-setting');
				}
				
				if (subtype.indexName) {
					new Setting(subtypeDetails)
						.setName('Index Name')
						.setDesc(subtype.indexName)
						.setClass('subtype-setting');
				}
				
				// Display questions if they exist
				if (subtype.questions && subtype.questions.length > 0) {
					const questionsDetails = subtypeDetails.createEl('details', {
						cls: 'questions-container'
					});
					questionsDetails.createEl('summary', { text: 'Questions' });
					
					subtype.questions.forEach((questionId: string) => {
						new Setting(questionsDetails)
							.setName('Question ID')
							.setDesc(questionId)
							.setClass('question-setting');
					});
				}
			});
		});
	}
} 