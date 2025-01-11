import { App, Modal, Notice, Setting } from "obsidian";
import { IndexNoteManagerPlugin } from "../../pluginTypes";
import { Index } from "../../types";

export class NewIndexEntryModal extends Modal {
    private indexName: string;
    private index: Index;
    private plugin: IndexNoteManagerPlugin;
    private entryName = "";
    private parentEntry: string | null = null;

    constructor(
        app: App,
        plugin: IndexNoteManagerPlugin,
        indexName: string,
        index: Index,
    ) {
        super(app);
        this.plugin = plugin;
        this.indexName = indexName;
        this.index = index;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: `New Entry for ${this.indexName}` });

        // Entry name input
        new Setting(contentEl)
            .setName("Entry Name")
            .setDesc("Enter the name for the new entry")
            .addText((text) =>
                text
                    .setPlaceholder("Entry name")
                    .onChange((value) => (this.entryName = value.trim())),
            );

        // Parent selection if needed
        if (this.index.parents && this.index.parents.length > 0) {
            const parentIndex = this.plugin.configManager.getIndexConfig(
                this.index.parents[0],
            );
            const parentEntries = Object.keys(parentIndex?.entries || {});

            if (parentEntries.length === 0) {
                new Notice(
                    `No parent entries available in ${this.index.parents[0]}`,
                );
                this.close();
                return;
            }

            new Setting(contentEl)
                .setName("Parent Entry")
                .setDesc(`Select parent from ${this.index.parents[0]}`)
                .addDropdown((dropdown) => {
                    dropdown.addOption("", "Select a parent...");
                    parentEntries.forEach((entry) => {
                        dropdown.addOption(entry, entry);
                    });
                    dropdown.onChange(
                        (value) => (this.parentEntry = value || null),
                    );
                });
        }

        // Save button
        new Setting(contentEl).addButton((btn) =>
            btn
                .setButtonText("Save")
                .setCta()
                .onClick(async () => {
                    if (!this.entryName) {
                        new Notice("Entry name is required");
                        return;
                    }

                    if (
                        this.index.parents &&
                        this.index.parents.length > 0 &&
                        !this.parentEntry
                    ) {
                        new Notice("Parent entry is required");
                        return;
                    }

                    // Check if entry already exists
                    const existingEntries = Object.keys(this.index.entries);
                    if (existingEntries.includes(this.entryName)) {
                        new Notice(`Entry "${this.entryName}" already exists`);
                        return;
                    }

                    try {
                        const newEntry: Record<string, any> = {
                            [this.entryName]: {
                                metadata: {
                                    level: this.index.level,
                                    parents: this.parentEntry
                                        ? [this.parentEntry]
                                        : [],
                                },
                                children: {},
                            },
                        };

                        await this.plugin.configManager.updateIndexEntries(
                            this.indexName,
                            newEntry,
                            this.parentEntry,
                        );
                        new Notice(`Created new entry "${this.entryName}"`);
                        this.close();
                    } catch (error) {
                        if (error instanceof Error) {
                            new Notice(`Failed to create entry: ${error.message}`);
                            console.error("Failed to create entry:", error);
                        } else {
                            new Notice("Failed to create entry: Unknown error");
                            console.error("Failed to create entry:", error);
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