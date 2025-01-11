export interface IndexEntry {
	metadata: {
		level: number;
		parents: string[];
	};
	children?: Record<string, string[]>;
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
	indices: { [key: string]: Index };
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

export type FrontMatterType = 
	| 'text'          // basic text
	| 'link'          // internal links
	| 'list'          // arrays
	| 'number'        // numeric values
	| 'checkbox'      // boolean
	| 'date'          // YYYY-MM-DD
	| 'datetime'      // YYYY-MM-DDTHH:mm
	| 'templater'     // for tp.file.* functions
	| 'tag';         // for tag fields

export interface FrontMatterField {
	id: string;
	value: string;
	type: FrontMatterType;
	templaterFunction?: string;
}

export interface Question {
	questionId: string;
	answerId: string;
	type: "inputPrompt" | "tpsuggester" | "nestedTpsuggester";
	prompt: string;
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
		indexName?: string;
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
