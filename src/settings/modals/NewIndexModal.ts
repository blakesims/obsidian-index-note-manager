import { App, Modal, Notice, Setting } from "obsidian";
import { IndexNoteManagerPlugin } from "../../pluginTypes";
import { Index } from "../../types";

export class NewIndexModal extends Modal {
    private plugin: IndexNoteManagerPlugin;
    private indexId = "";
    private isNested = false;
    private level = 0;
    private parentIndex: string | null = null;
    private dynamicFieldsContainer: HTMLElement;

    constructor(app: App, plugin: IndexNoteManagerPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Create New Index" });

        new Setting(contentEl)
            .setName("Index ID")
            .setDesc("Enter the ID for the new index")
            .addText((text) =>
                text
                    .setPlaceholder("Index ID")
                    .onChange((value) => (this.indexId = value.trim())),
            );

        new Setting(contentEl)
            .setName("Nested Index")
            .setDesc("Is this a nested index?")
            .addToggle((toggle) =>
                toggle.setValue(this.isNested).onChange((value) => {
                    this.isNested = value;
                    this.refreshDynamicFields();
                }),
            );

        this.dynamicFieldsContainer = contentEl.createEl("div");
        this.refreshDynamicFields();

        new Setting(contentEl).addButton((btn) =>
            btn
                .setButtonText("Create Index")
                .setCta()
                .onClick(() => {
                    if (!this.validateFields()) {
                        return;
                    }

                    try {
                        this.createIndex().catch((error) => {
                            new Notice(
                                `Failed to create index: ${error.message}`,
                            );
                            console.error("Failed to create index:", error);
                        });
                    } catch (error) {
                        if (error instanceof Error) {
                            new Notice(
                                `Failed to create index: ${error.message}`,
                            );
                            console.error("Failed to create index:", error);
                        } else {
                            new Notice("Failed to create index: Unknown error");
                            console.error("Failed to create index:", error);
                        }
                    }
                }),
        );
    }

    private async createIndex(): Promise<void> {
        const newIndex: Index = {
            nested: this.isNested,
            level: this.level,
            entries: {},
            parents:
                this.level === 1 && this.parentIndex
                    ? [this.parentIndex]
                    : undefined,
            children: this.level === 0 ? [] : undefined,
        };

        await this.plugin.configManager.addIndex(this.indexId, newIndex);

        if (this.level === 1 && this.parentIndex) {
            const parentIndex = this.plugin.configManager.getIndexConfig(
                this.parentIndex,
            );
            if (parentIndex) {
                if (!parentIndex.children) {
                    parentIndex.children = [];
                }
                if (!parentIndex.children.includes(this.indexId)) {
                    parentIndex.children.push(this.indexId);
                    await this.plugin.configManager.updateParentIndex(
                        this.parentIndex,
                        parentIndex,
                    );
                }
            }
        }

        new Notice(`Created new index "${this.indexId}"`);
        this.close();
    }

    private refreshDynamicFields(): void {
        this.dynamicFieldsContainer.empty();

        if (this.isNested) {
            new Setting(this.dynamicFieldsContainer)
                .setName("Level")
                .setDesc(
                    "Index level (0 for root indices, 1 for child indices)",
                )
                .addDropdown((dropdown) =>
                    dropdown
                        .addOption("0", "Level 0 (Root)")
                        .addOption("1", "Level 1 (Child)")
                        .onChange((value) => {
                            this.level = parseInt(value);
                            this.refreshParentSelection();
                        }),
                );

            const parentSelectionContainer =
                this.dynamicFieldsContainer.createEl("div");
            this.refreshParentSelection(parentSelectionContainer);
        } else {
            this.level = 0;
        }
    }

    private refreshParentSelection(
        container: HTMLElement = this.dynamicFieldsContainer,
    ) {
        container.empty();

        if (this.isNested && this.level === 1) {
            const availableParents = Object.entries(
                this.plugin.configManager.getAllIndices(),
            )
                .filter(
                    ([_, index]) =>
                        index.level === 0 &&
                        index.nested &&
                        (!index.children || index.children.length === 0),
                )
                .map(([name]) => name);

            if (availableParents.length === 0) {
                container.createEl("p", {
                    text: "No available parent indices. Create a level 0 nested index first.",
                    attr: { style: "color: var(--text-error);" },
                });
                return;
            }

            new Setting(container)
                .setName("Parent Index")
                .setDesc(
                    "Select the parent index (must be a level 0 nested index without children)",
                )
                .addDropdown((dropdown) => {
                    dropdown.addOption("", "Select parent...");
                    availableParents.forEach((name) =>
                        dropdown.addOption(name, name),
                    );
                    dropdown.onChange(
                        (value) => (this.parentIndex = value || null),
                    );
                });
        }
    }

    private validateFields(): boolean {
        if (!this.indexId) {
            new Notice("Index ID is required");
            return false;
        }

        const existingIndices = Object.keys(
            this.plugin.configManager.getAllIndices(),
        );
        if (existingIndices.includes(this.indexId)) {
            new Notice(`Index "${this.indexId}" already exists`);
            return false;
        }

        if (this.isNested && this.level === 1 && !this.parentIndex) {
            new Notice("Parent index is required for level 1 indices");
            return false;
        }

        return true;
    }
} 