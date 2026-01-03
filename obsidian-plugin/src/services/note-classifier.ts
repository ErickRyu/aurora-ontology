/**
 * Utility for classifying notes by their type based on folder structure.
 */

import { TFile } from 'obsidian';
import { NoteType, NoteFrontmatter } from '../types/entities';

export function classifyNote(file: TFile): NoteType | null {
  const path = file.path;

  if (path.startsWith('Thoughts/')) return 'thought';
  if (path.startsWith('Questions/')) return 'question';
  if (path.startsWith('Insights/')) return 'insight';

  return null;
}

export function isQuestionNote(file: TFile): boolean {
  return classifyNote(file) === 'question';
}

export function isInsightNote(file: TFile): boolean {
  return classifyNote(file) === 'insight';
}

export function isThoughtNote(file: TFile): boolean {
  return classifyNote(file) === 'thought';
}

export function parseFrontmatter(content: string): {
  frontmatter: NoteFrontmatter;
  body: string;
} {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      frontmatter: {},
      body: content,
    };
  }

  const [, frontmatterRaw, body] = match;
  const frontmatter: NoteFrontmatter = {};

  // Simple YAML parsing for common fields
  const lines = frontmatterRaw.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    switch (key) {
      case 'type':
        frontmatter.type = value as NoteType;
        break;
      case 'created':
        frontmatter.created = value;
        break;
      case 'status':
        frontmatter.status = value;
        break;
      case 'triggered_by':
        frontmatter.triggered_by = value;
        break;
      case 'confidence':
        frontmatter.confidence = value as 'low' | 'medium' | 'high';
        break;
      case 'evolved_from':
        frontmatter.evolved_from = value;
        break;
    }
  }

  return { frontmatter, body };
}
