export interface IndexEntry {
	metadata: {
		level: number;
		parents: string[];
		children?: string[];
	};
}

export interface Index {
	nested: boolean;
	level: number;
	parents?: string[];
	children?: string[];
	entries: { [key: string]: IndexEntry };
}

export interface GlobalIndex {
	indices: { [key: string]: Index };
}

export interface NoteConfig {
	noteTypes: NoteType[];
	questions: Question[];
}

export interface NoteType {
	id: string;
	subtypes: NoteSubtype[];
	baseFrontMatterPath?: string;
}

export interface NoteSubtype {
	id: string;
	folder: string;
	template: string;
	frontMatter: FrontMatterField[];
	questions: string[];
	title: string;
}

export interface FrontMatterField {
	id: string;
	value: string;
	type: string;
}

export interface Question {
	questionId: string;
	answerId: string;
	type: "inputPrompt" | "tpsuggester" | "nestedTpsuggester";
	prompt: string;
	frontMatterType?: string;
	indexName?: string;
	nest?: Question[];
	choices?: string[];
	allowManualEntry?: boolean;
	multipleSelections?: boolean;
	createNewEntry?: boolean;
	newEntryNoteType?: string;
	newEntryNoteSubtype?: string;
	parents?: string[];
}

export interface Answer {
	value: any;
	type: string;
	metadata: {
		questionType: string;
		indexed: boolean;
		level: number | null;
		parentAnswerId: string | null;
	};
}

// Extend the App type to include the plugins property
declare module "obsidian" {
	interface App {
		plugins: {
			plugins: {
				[key: string]: any;
			};
		};
	}
}
