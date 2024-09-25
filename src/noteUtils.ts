import { App, TFile } from "obsidian";
import { NoteSubtype, Answer } from "./types";
import { PlaceholderUtils } from "./placeholderUtils";
import { log } from "./debugUtils";

export class NoteUtils {
	private app: App;
	private placeholderUtils: PlaceholderUtils;

	constructor(app: App) {
		this.app = app;
		this.placeholderUtils = new PlaceholderUtils();
	}

	async createNoteFromTemplate(
		subtypeConfig: NoteSubtype,
		frontMatter: string,
		allAnswers: Record<string, Answer>,
	): Promise<string | null> {
		const newNotePath = this.getNewNotePath(subtypeConfig, allAnswers);
		log("generalDebug", "New note path:", newNotePath);

		// Extract the folder path from the newNotePath
		const folderPath = this.getFolderPath(newNotePath);
		log("generalDebug", "The folderPath is:", folderPath);

		// Create nested folders if they don't exist
		if (folderPath && !(await this.app.vault.adapter.exists(folderPath))) {
			await this.app.vault.createFolder(folderPath);
			log("generalDebug", "Created folder:", folderPath);
		}

		if (subtypeConfig.template) {
			const templateFile = this.app.vault.getAbstractFileByPath(
				subtypeConfig.template,
			);
			if (templateFile instanceof TFile) {
				const templateContent = await this.app.vault.read(templateFile);
				log("generalDebug", "Template content loaded");

				const combinedContent = frontMatter + "\n" + templateContent;
				const finalContent = this.placeholderUtils.replacePlaceholders(
					combinedContent,
					allAnswers,
				);
				log("generalDebug", "Placeholders replaced in content");

				await this.app.vault.create(newNotePath, finalContent);
				log("generalDebug", "New note created:", newNotePath);
				return newNotePath;
			} else {
				log(
					"errorDebug",
					"Template file not found:",
					subtypeConfig.template,
				);
				throw new Error(
					`Template file not found: ${subtypeConfig.template}`,
				);
			}
		} else {
			await this.app.vault.create(newNotePath, frontMatter);
			log("generalDebug", "New blank note created:", newNotePath);
			return newNotePath;
		}
	}

	private getNewNotePath(
		subtypeConfig: NoteSubtype,
		answers: Record<string, Answer>,
	): string {
		let folderPath = this.placeholderUtils.replacePlaceholders(
			subtypeConfig.folder,
			answers,
		);
		let fileName = this.placeholderUtils.replacePlaceholders(
			subtypeConfig.title,
			answers,
		);

		return `${folderPath}/${fileName}.md`;
	}

	private getFolderPath(notePath: string): string {
		const pathParts = notePath.split("/");
		pathParts.pop(); // Remove the file name
		return pathParts.join("/");
	}
}
