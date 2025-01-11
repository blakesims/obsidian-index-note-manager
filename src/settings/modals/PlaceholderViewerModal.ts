import { App, Modal, Setting } from "obsidian";
import { Question } from "../../types";

export class PlaceholderViewerModal extends Modal {
    private questions: Question[];

    constructor(app: App, questions: Question[]) {
        super(app);
        this.questions = questions;
    }

    private getNestedQuestionPlaceholders(
        question: Question,
        container: HTMLElement,
    ) {
        if (!question.nest) return;

        // Create a section for this nested question group
        const nestedSection = container.createEl("details", {
            cls: "nested-placeholder-group",
        });
        nestedSection.createEl("summary", { text: question.questionId });

        // Add description of the nested structure
        const descEl = nestedSection.createEl("div", {
            cls: "nested-description",
            attr: { style: "margin-bottom: 10px; color: var(--text-muted);" },
        });
        descEl.createEl("small", {
            text: "This is a nested question group. Each nested question's answer will be available as a direct placeholder.",
        });

        // Process each nested question
        question.nest.forEach((nestedQ) => {
            if (nestedQ.answerId) {
                // Create placeholder display
                new Setting(nestedSection)
                    .setName(`{{${nestedQ.answerId}}}`)
                    .setDesc(`From nested question: ${nestedQ.prompt}`)
                    .setClass("placeholder-item");

                // If this nested question has its own nest, process recursively
                if (nestedQ.nest) {
                    this.getNestedQuestionPlaceholders(nestedQ, nestedSection);
                }
            }
        });
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "Available Placeholders" });

        // Add help text
        contentEl.createEl("p", {
            text: "These placeholders can be used in templates and front matter configurations:",
            attr: { style: "margin-bottom: 20px;" },
        });

        // Create container for placeholders
        const placeholdersContainer = contentEl.createEl("div", {
            cls: "placeholders-container",
        });

        // Process each question
        this.questions.forEach((question) => {
            if (question.type === "nestedTpsuggester") {
                // Handle nested questions
                this.getNestedQuestionPlaceholders(question, placeholdersContainer);
            } else {
                // Handle regular questions
                if (question.answerId) {
                    new Setting(placeholdersContainer)
                        .setName(`{{${question.answerId}}}`)
                        .setDesc(
                            `From question: ${question.prompt || "No prompt"}`,
                        )
                        .setClass("placeholder-item");
                }
            }
        });

        // Add usage instructions
        const usageSection = contentEl.createEl("div", {
            cls: "usage-instructions",
            attr: { style: "margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--background-modifier-border);" },
        });

        usageSection.createEl("h3", { text: "How to Use Placeholders" });
        const instructions = usageSection.createEl("ul");
        instructions.createEl("li", {
            text: "Use {{placeholder}} syntax in your templates and front matter configurations",
        });
        instructions.createEl("li", {
            text: "Placeholders will be replaced with the actual answers when creating notes",
        });
        instructions.createEl("li", {
            text: "Nested question placeholders can be used directly with their answer IDs",
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 