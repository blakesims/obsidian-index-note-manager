import { App, Modal, Notice, Setting } from "obsidian";
import { IndexNoteManagerPlugin } from "../../pluginTypes";

export class NewNoteTypeModal extends Modal {
    private plugin: IndexNoteManagerPlugin;
    private typeId = "";
    private baseFrontMatterPath = "";

    constructor(app: App, plugin: IndexNoteManagerPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "New Note Type" });

        // Type ID input
        new Setting(contentEl)
            .setName("Type ID")
            .setDesc("Enter the ID for the new note type")
            .addText((text) =>
                text
                    .setPlaceholder("Type ID")
                    .onChange((value) => (this.typeId = value.trim())),
            );

        // Base front matter path input
        new Setting(contentEl)
            .setName("Base Front Matter Path")
            .setDesc("(Optional) Path to base front matter template")
            .addText((text) =>
                text
                    .setPlaceholder("Path to base front matter")
                    .onChange(
                        (value) => (this.baseFrontMatterPath = value.trim()),
                    ),
            );

        // Save button
        new Setting(contentEl).addButton((btn) =>
            btn
                .setButtonText("Save")
                .setCta()
                .onClick(async () => {
                    if (!this.typeId) {
                        new Notice("Type ID is required");
                        return;
                    }

                    const noteConfig = this.plugin.configManager.getNoteConfig();

                    // Check if type already exists
                    if (
                        noteConfig.noteTypes.some(
                            (type) => type.id === this.typeId,
                        )
                    ) {
                        new Notice(`Note type "${this.typeId}" already exists`);
                        return;
                    }

                    try {
                        noteConfig.noteTypes.push({
                            id: this.typeId,
                            baseFrontMatterPath:
                                this.baseFrontMatterPath || undefined,
                            subtypes: [],
                        });

                        await this.plugin.configManager.setNoteConfig(noteConfig);
                        await this.plugin.configManager.saveData();
                        new Notice(`Created new note type "${this.typeId}"`);
                        this.close();
                    } catch (error) {
                        if (error instanceof Error) {
                            new Notice(`Failed to create note type: ${error.message}`);
                            console.error("Failed to create note type:", error);
                        } else {
                            new Notice("Failed to create note type: Unknown error");
                            console.error("Failed to create note type:", error);
                        }
                    }
                }),
        );
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 