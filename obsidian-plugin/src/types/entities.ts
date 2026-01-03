/**
 * Entity types for the Personal Ontology System.
 */

export type NoteType = 'thought' | 'question' | 'insight';

export interface NoteFrontmatter {
  type?: NoteType;
  created?: string;
  status?: string;
  triggered_by?: string;
  related_insights?: string[];
  related_questions?: string[];
  source_questions?: string[];
  confidence?: 'low' | 'medium' | 'high';
  evolved_from?: string;
  tags?: string[];
}

export interface ParsedNote {
  path: string;
  content: string;
  frontmatter: NoteFrontmatter;
  type: NoteType;
}

export function determineNoteType(path: string): NoteType | null {
  if (path.startsWith('Thoughts/')) return 'thought';
  if (path.startsWith('Questions/')) return 'question';
  if (path.startsWith('Insights/')) return 'insight';
  return null;
}
