import { App, PluginSettingTab, Setting, TextAreaComponent, Modal, ButtonComponent, Notice } from 'obsidian';
import { IndexNoteManagerPlugin } from './pluginTypes';
import { NoteType, NoteSubtype, Question, Index, IndexEntry } from './types';

class NewIndexEntryModal extends Modal {
	private indexName: string;
	private index: Index;
	private plugin: IndexNoteManagerPlugin;
	private entryName: string = '';
	private parentEntry: string | null = null;

	constructor(app: App, plugin: IndexNoteManagerPlugin, indexName: string, index: Index) {
		super(app);
		this.plugin = plugin;
		this.indexName = indexName;
		this.index = index;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: `New Entry for ${this.indexName}` });

		// Entry name input
		new Setting(contentEl)
			.setName('Entry Name')
			.setDesc('Enter the name for the new entry')
			.addText(text => text
				.setPlaceholder('Entry name')
				.onChange(value => this.entryName = value.trim()));

		// Parent selection if needed
		if (this.index.parents && this.index.parents.length > 0) {
			const parentIndex = this.plugin.configManager.getIndexConfig(this.index.parents[0]);
			const parentEntries = Object.keys(parentIndex?.entries || {});

			if (parentEntries.length === 0) {
				new Notice(`No parent entries available in ${this.index.parents[0]}`);
				this.close();
				return;
			}

			new Setting(contentEl)
				.setName('Parent Entry')
				.setDesc(`Select parent from ${this.index.parents[0]}`)
				.addDropdown(dropdown => {
					dropdown.addOption('', 'Select a parent...');
					parentEntries.forEach(entry => {
						dropdown.addOption(entry, entry);
					});
					dropdown.onChange(value => this.parentEntry = value || null);
				});
		}

		// Save button
		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Save')
				.setCta()
				.onClick(async () => {
					if (!this.entryName) {
						new Notice('Entry name is required');
						return;
					}

					if (this.index.parents?.length > 0 && !this.parentEntry) {
						new Notice('Parent entry is required');
						return;
					}

					// Check if entry already exists
					const existingEntries = Object.keys(this.index.entries);
					if (existingEntries.includes(this.entryName)) {
						new Notice(`Entry "${this.entryName}" already exists`);
						return;
					}

					try {
						const newEntry: Record<string, IndexEntry> = {
							[this.entryName]: {
								metadata: {
									level: this.index.level,
									parents: this.parentEntry ? [this.parentEntry] : [],
								},
								children: {}
							}
						};

						await this.plugin.configManager.updateIndexEntries(
							this.indexName,
							newEntry,
							this.parentEntry
						);
						new Notice(`Created new entry "${this.entryName}"`);
						this.close();
					} catch (error) {
						new Notice(`Failed to create entry: ${error.message}`);
						console.error('Failed to create entry:', error);
					}
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

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

		// Questions Section
		const questionsSection = containerEl.createEl('details', { cls: 'questions-section' });
		questionsSection.createEl('summary', { text: 'Questions Configuration' });
		
		const questions = this.plugin.configManager.getNoteConfig().questions;
		questions.forEach((question: Question) => {
			const questionDetails = questionsSection.createEl('details', {
				cls: 'question-details'
			});
			questionDetails.createEl('summary', { text: question.questionId });
			
			// Basic question info
			new Setting(questionDetails)
				.setName('Question ID')
				.setDesc(question.questionId)
				.setClass('question-setting');
				
			new Setting(questionDetails)
				.setName('Answer ID')
				.setDesc(question.answerId || 'N/A')
				.setClass('question-setting');
				
			new Setting(questionDetails)
				.setName('Type')
				.setDesc(question.type)
				.setClass('question-setting');
				
			new Setting(questionDetails)
				.setName('Prompt')
				.setDesc(question.prompt)
				.setClass('question-setting');
			
			// Index-related settings
			if (question.indexName) {
				new Setting(questionDetails)
					.setName('Index Name')
					.setDesc(question.indexName)
					.setClass('question-setting');
			}
			
			if (question.createNewEntry !== undefined) {
				new Setting(questionDetails)
					.setName('Can Create New Entry')
					.setDesc(question.createNewEntry ? 'Yes' : 'No')
					.setClass('question-setting');
			}
			
			if (question.allowManualEntry !== undefined) {
				new Setting(questionDetails)
					.setName('Allow Manual Entry')
					.setDesc(question.allowManualEntry ? 'Yes' : 'No')
					.setClass('question-setting');
			}
			
			if (question.multipleSelections !== undefined) {
				new Setting(questionDetails)
					.setName('Multiple Selections')
					.setDesc(question.multipleSelections ? 'Yes' : 'No')
					.setClass('question-setting');
			}
			
			// Nested questions
			if (question.type === 'nestedTpsuggester' && question.nest) {
				const nestedSection = questionDetails.createEl('details', {
					cls: 'nested-questions-section'
				});
				nestedSection.createEl('summary', { text: 'Nested Questions' });
				
				question.nest.forEach((nestedQ: Question) => {
					const nestedDetails = nestedSection.createEl('details', {
						cls: 'nested-question-details'
					});
					nestedDetails.createEl('summary', { text: nestedQ.questionId });
					
					new Setting(nestedDetails)
						.setName('Question ID')
						.setDesc(nestedQ.questionId)
						.setClass('nested-question-setting');
						
					new Setting(nestedDetails)
						.setName('Answer ID')
						.setDesc(nestedQ.answerId || 'N/A')
						.setClass('nested-question-setting');
						
					if (nestedQ.parents && nestedQ.parents.length > 0) {
						new Setting(nestedDetails)
							.setName('Parent Answer IDs')
							.setDesc(nestedQ.parents.join(', '))
							.setClass('nested-question-setting');
					}
					
					if (nestedQ.frontMatterType) {
						new Setting(nestedDetails)
							.setName('Front Matter Type')
							.setDesc(nestedQ.frontMatterType)
							.setClass('nested-question-setting');
					}
				});
			}
		});
		
		// Indices Section
		const indicesSection = containerEl.createEl('details', { cls: 'indices-section' });
		indicesSection.createEl('summary', { text: 'Index Relationships' });
		
		const indices = this.plugin.configManager.getAllIndices();
		Object.entries(indices).forEach(([indexName, index]: [string, Index]) => {
			const indexDetails = indicesSection.createEl('details', {
					cls: 'index-details'
			});
			indexDetails.createEl('summary', { text: indexName });
			
			// Add New Entry button
			new Setting(indexDetails)
				.setName('Add New Entry')
				.setDesc('Create a new entry in this index')
				.addButton(btn => btn
					.setButtonText('New Entry')
					.setCta()
					.onClick(() => {
						new NewIndexEntryModal(
							this.app,
							this.plugin,
							indexName,
							index
						).open();
					}));

			new Setting(indexDetails)
				.setName('Nested')
				.setDesc(index.nested ? 'Yes' : 'No')
				.setClass('index-setting');
				
			new Setting(indexDetails)
				.setName('Level')
				.setDesc(index.level.toString())
				.setClass('index-setting');
			
			if (index.parents && index.parents.length > 0) {
				new Setting(indexDetails)
					.setName('Parents')
					.setDesc(index.parents.join(', '))
					.setClass('index-setting');
			}
			
			if (index.children && index.children.length > 0) {
				new Setting(indexDetails)
					.setName('Children')
					.setDesc(index.children.join(', '))
					.setClass('index-setting');
			}
			
			// Show entries count
			const entriesCount = Object.keys(index.entries).length;
			new Setting(indexDetails)
				.setName('Entries Count')
				.setDesc(entriesCount.toString())
				.setClass('index-setting');
		});
		
		// Note Types Section
		const noteTypesSection = containerEl.createEl('details', { cls: 'note-types-section' });
		noteTypesSection.createEl('summary', { text: 'Note Types' });
		
		const noteTypes = this.plugin.configManager.getNoteConfig().noteTypes;
		
		noteTypes.forEach((noteType: NoteType) => {
			const noteTypeContainer = noteTypesSection.createEl('details', { 
				cls: 'note-type-container'
			});
			
			noteTypeContainer.createEl('summary', { 
				text: `${noteType.id}`,
				cls: 'note-type-header'
			});
			
			if (noteType.baseFrontMatterPath) {
				new Setting(noteTypeContainer)
					.setName('Base Front Matter Path')
					.setDesc(noteType.baseFrontMatterPath)
					.setClass('note-type-setting');
			}
			
			const subtypesContainer = noteTypeContainer.createEl('details', {
				cls: 'subtypes-container'
			});
			subtypesContainer.createEl('summary', { text: 'Subtypes' });
			
			noteType.subtypes.forEach((subtype: NoteSubtype) => {
				const subtypeDetails = subtypesContainer.createEl('details', {
					cls: 'subtype-details'
				});
				subtypeDetails.createEl('summary', { text: subtype.id });
				
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
				
				if (subtype.frontMatter && subtype.frontMatter.length > 0) {
					const frontMatterDetails = subtypeDetails.createEl('details', {
						cls: 'frontmatter-container'
					});
					frontMatterDetails.createEl('summary', { text: 'Front Matter' });
					
					subtype.frontMatter.forEach(field => {
						const fieldSetting = new Setting(frontMatterDetails)
							.setName(field.id)
							.setDesc(`${field.type}: ${field.value}`)
							.setClass('frontmatter-setting');
					});
				}
				
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