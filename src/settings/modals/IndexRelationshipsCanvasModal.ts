import { App, Modal, Notice, Setting } from "obsidian";
import { IndexNoteManagerPlugin } from "../../pluginTypes";
import { CanvasData, CanvasNode, CanvasEdge } from "../interfaces/CanvasTypes";

export class IndexRelationshipsCanvasModal extends Modal {
    private plugin: IndexNoteManagerPlugin;
    private canvasName = "Index Relationships";

    constructor(app: App, plugin: IndexNoteManagerPlugin) {
        super(app);
        this.plugin = plugin;
    }

    private generateCanvasJson(): CanvasData {
        const indices = this.plugin.configManager.getAllIndices();
        const nodes: CanvasNode[] = [];
        const edges: CanvasEdge[] = [];

        // Constants for layout
        const BOX_WIDTH = 300;
        const BOX_HEIGHT = 150;
        const VERTICAL_GAP = BOX_HEIGHT * 5; // Distance between parent and child rows
        const HORIZONTAL_GAP = BOX_WIDTH * 2; // Gap between nodes in the same row

        // First, identify root nodes (level 0) and child nodes
        const rootIndices = Object.entries(indices).filter(
            ([_, index]) => index.level === 0,
        );
        const childIndices = Object.entries(indices).filter(
            ([_, index]) => index.level > 0,
        );

        // Position root nodes at y=0, spread horizontally
        let x = 100;
        rootIndices.forEach(([indexName, index]) => {
            nodes.push({
                id: indexName,
                type: "text",
                text: `${indexName}\nLevel: ${index.level}${index.nested ? "\nNested: Yes" : ""}`,
                x,
                y: 0,
                width: BOX_WIDTH,
                height: BOX_HEIGHT,
                color: "4", // green for root nodes
            });
            x += HORIZONTAL_GAP;
        });

        // Position child nodes above, spread horizontally
        x = 100;
        childIndices.forEach(([indexName, index]) => {
            nodes.push({
                id: indexName,
                type: "text",
                text: `${indexName}\nLevel: ${index.level}${index.nested ? "\nNested: Yes" : ""}`,
                x,
                y: VERTICAL_GAP,
                width: BOX_WIDTH,
                height: BOX_HEIGHT,
                color: "5", // cyan for child nodes
            });
            x += HORIZONTAL_GAP;
        });

        // Create edges for parent-child relationships
        Object.entries(indices).forEach(([indexName, index]) => {
            // Parent relationships
            if (index.parents) {
                index.parents.forEach((parentName) => {
                    edges.push({
                        id: `${parentName}-${indexName}`,
                        fromNode: parentName,
                        toNode: indexName,
                        fromEnd: "none",
                        toEnd: "arrow",
                        label: "parent of",
                        color: "6", // purple for edges
                    });
                });
            }

            // Child relationships
            if (index.children) {
                index.children.forEach((childName) => {
                    edges.push({
                        id: `${indexName}-${childName}`,
                        fromNode: indexName,
                        toNode: childName,
                        fromEnd: "none",
                        toEnd: "arrow",
                        label: "has child",
                        color: "6", // purple for edges
                    });
                });
            }
        });

        return { nodes, edges };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Create Index Relationships Canvas" });

        new Setting(contentEl)
            .setName("Canvas Name")
            .setDesc("Enter the name for the canvas file (without extension)")
            .addText((text) =>
                text
                    .setValue(this.canvasName)
                    .onChange((value) => (this.canvasName = value.trim())),
            );

        new Setting(contentEl).addButton((btn) =>
            btn
                .setButtonText("Create Canvas")
                .setCta()
                .onClick(async () => {
                    try {
                        const canvasJson = this.generateCanvasJson();
                        const fileName = `${this.canvasName}.canvas`;

                        // Use Obsidian's adapter to write the file
                        await this.app.vault.create(
                            fileName,
                            JSON.stringify(canvasJson, null, 2),
                        );

                        new Notice(`Created canvas file: ${fileName}`);
                        this.close();
                    } catch (error) {
                        if (error instanceof Error) {
                            new Notice(`Failed to create canvas: ${error.message}`);
                            console.error("Failed to create canvas:", error);
                        } else {
                            new Notice("Failed to create canvas: Unknown error");
                            console.error("Failed to create canvas:", error);
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