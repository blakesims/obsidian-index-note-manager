import { Setting } from "obsidian";
import { FrontMatterField, FrontMatterType } from "../../types";

export function createFrontMatterFieldComponent(
    container: HTMLElement,
    field: FrontMatterField,
    index: number,
    onUpdate: (field: FrontMatterField, index: number) => void,
    onRemove: (index: number) => void,
    onTemplaterInput?: (container: HTMLElement, field: FrontMatterField) => void
) {
    const fieldContainer = container.createEl("div", {
        cls: "front-matter-field",
        attr: {
            style: "margin-bottom: 10px; padding: 5px; border-left: 2px solid var(--interactive-accent);",
        },
    });

    new Setting(fieldContainer)
        .setName("Field ID")
        .addText((text) =>
            text
                .setPlaceholder("e.g., tags")
                .setValue(field.id)
                .onChange((value) => {
                    field.id = value;
                    onUpdate(field, index);
                }),
        );

    new Setting(fieldContainer)
        .setName("Type")
        .setDesc("Select the type of front matter field")
        .addDropdown((dropdown) =>
            dropdown
                .addOption("text", "Text")
                .addOption("link", "Internal Link")
                .addOption("list", "List")
                .addOption("number", "Number")
                .addOption("checkbox", "Checkbox")
                .addOption("date", "Date (YYYY-MM-DD)")
                .addOption("datetime", "Date & Time (YYYY-MM-DDTHH:mm)")
                .addOption("templater", "Templater Function")
                .setValue(field.type)
                .onChange((value) => {
                    field.type = value as FrontMatterType;
                    if (value === "templater" && onTemplaterInput) {
                        onTemplaterInput(fieldContainer, field);
                    }
                    onUpdate(field, index);
                }),
        );

    new Setting(fieldContainer)
        .setName("Value Template")
        .addText((text) =>
            text
                .setValue(field.value)
                .setPlaceholder("Value (can include {{placeholders}})")
                .onChange((value) => {
                    field.value = value;
                    onUpdate(field, index);
                }),
        );

    new Setting(fieldContainer)
        .addButton((btn) =>
            btn.setButtonText("Remove").onClick(() => onRemove(index)),
        );

    // Show placeholders
    const placeholders = field.value.match(/{{[^}]+}}/g) as string[] | null;
    if (placeholders) {
        const placeholderContainer = fieldContainer.createEl("div", {
            cls: "placeholder-list",
            attr: { style: "margin-left: 20px;" },
        });
        placeholderContainer.createEl("small", {
            text: "Uses placeholders: " + placeholders.join(", "),
            attr: { style: "color: var(--text-muted);" },
        });
    }

    return fieldContainer;
}

export function showTemplaterFunctionInput(
    container: HTMLElement,
    field: FrontMatterField,
    onUpdate: (field: FrontMatterField) => void
) {
    new Setting(container)
        .setName("Templater Function")
        .setDesc("Enter the templater function (e.g., tp.file.creation_date())")
        .addText((text) =>
            text
                .setPlaceholder("<% tp.file.creation_date() %>")
                .setValue(field.templaterFunction || "")
                .onChange((value) => {
                    field.templaterFunction = value;
                    field.value = value; // Set the value to the templater function
                    onUpdate(field);
                }),
        );
} 