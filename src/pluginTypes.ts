import { Plugin } from 'obsidian';
import { ConfigManager } from './configManager';
import { NoteCreator } from './noteCreator';

export interface IndexNoteManagerPlugin extends Plugin {
    configManager: ConfigManager;
    noteCreator: NoteCreator;
} 