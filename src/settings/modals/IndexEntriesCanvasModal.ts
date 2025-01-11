import { App, Modal, Notice, Setting } from "obsidian";
import { IndexNoteManagerPlugin } from "../../pluginTypes";
import { Index, IndexEntry } from "../../types";
import { CanvasData, CanvasNode, CanvasEdge } from "../interfaces/CanvasTypes";

export class IndexEntriesCanvasModal extends Modal {
    private plugin: IndexNoteManagerPlugin;
    private indexName: string;
    private index: Index;
    private canvasName: string;

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
        this.canvasName = `${indexName}-entries`;
    }

    private isIndexEntry(obj: unknown): obj is IndexEntry {
        return (
            typeof obj === 'object' &&
            obj !== null &&
            'metadata' in obj &&
            typeof (obj as any).metadata === 'object'
        );
    }

    private generateEntriesCanvasJson(): CanvasData {
        const nodes: CanvasNode[] = [];
        const edges: CanvasEdge[] = [];

        // Constants for layout
        const BOX_WIDTH = 300;
        const BOX_HEIGHT = 150;
        const VERTICAL_GAP = BOX_HEIGHT * 2;
        const HORIZONTAL_GAP = BOX_WIDTH * 2;

        // Helper function to add a node
        const addNode = (
            id: string,
            text: string,
            x: number,
            y: number,
            color: string,
        ) => {
            nodes.push({
                id,
                type: "text",
                text,
                x,
                y,
                width: BOX_WIDTH,
                height: BOX_HEIGHT,
                color,
            });
        };

        // Helper function to add an edge
        const addEdge = (
            fromNode: string,
            toNode: string,
            label: string,
            color: string,
        ) => {
            edges.push({
                id: `${fromNode}-${toNode}`,
                fromNode,
                toNode,
                fromEnd: "none",
                toEnd: "arrow",
                label,
                color,
            });
        };

        // Process entries
        let x = 100;
        let y = 0;
        let maxY = 0;

        Object.entries(this.index.entries).forEach(([entryName, entry]) => {
            // Add entry node
            const entryLevel = entry.metadata?.level ?? "unknown";
            addNode(
                entryName,
                `${entryName}\nLevel: ${entryLevel}`,
                x,
                y,
                "4", // green for entries
            );

            // Process children
            const children = entry.children;
            if (children && typeof children === 'object') {
                const childEntries = Object.entries(children);
                childEntries.forEach(([childName, childEntry], childIndex) => {
                    if (this.isIndexEntry(childEntry)) {
                        // Position child below parent
                        const childY = y + VERTICAL_GAP;
                        const childX =
                            x + (childIndex - childEntries.length / 2) * HORIZONTAL_GAP;

                        const childLevel = childEntry.metadata?.level ?? "unknown";
                        addNode(
                            childName,
                            `${childName}\nLevel: ${childLevel}`,
                            childX,
                            childY,
                            "5", // cyan for child entries
                        );

                        // Add edge from parent to child
                        addEdge(entryName, childName, "has child", "6"); // purple for edges

                        maxY = Math.max(maxY, childY);
                    }
                });
            }

            x += HORIZONTAL_GAP;
        });

        return { nodes, edges };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", {
            text: `Create Entry Relationships Canvas for ${this.indexName}`,
        });

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
                        const canvasJson = this.generateEntriesCanvasJson();
                        const fileName = `${this.canvasName}.canvas`;

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