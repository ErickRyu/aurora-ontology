/**
 * API types for communication with the Python server.
 */

export interface HealthResponse {
  status: string;
  chroma_connected: boolean;
  indexed_insights: number;
  vault_path: string | null;
  watching: boolean;
}

export interface NotePayload {
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  modified_at?: string;
}

export interface IndexResponse {
  success: boolean;
  insight_id: string;
  embedding_dimension: number;
}

export interface DeleteResponse {
  success: boolean;
  message: string;
}

export interface ReindexRequest {
  vault_path: string;
}

export interface ReindexResponse {
  success: boolean;
  indexed_count: number;
  errors: string[];
}

export interface QueryRequest {
  question_content: string;
  top_k?: number;
  min_similarity?: number;
}

export interface RetrievedInsight {
  path: string;
  content: string;
  similarity: number;
  frontmatter: Record<string, unknown>;
}

export interface QueryResponse {
  insights: RetrievedInsight[];
}

export type QuestionType = 'memory_invoke' | 'conflict_detect' | 'amplify';

export interface ComparisonQuestion {
  type: QuestionType;
  insight_reference?: string;
  quote?: string;
  question: string;
}

export interface GenerateQuestionsRequest {
  current_question: string;
  retrieved_insights: RetrievedInsight[];
}

export interface GenerateQuestionsResponse {
  questions: ComparisonQuestion[];
  token_usage: {
    prompt: number;
    completion: number;
  };
}

export interface ConfigResponse {
  vault_path: string | null;
  watching: boolean;
  openai_configured: boolean;
}
