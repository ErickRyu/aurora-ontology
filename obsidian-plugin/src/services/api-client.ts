/**
 * HTTP client for communicating with the Python backend server.
 */

import {
  HealthResponse,
  NotePayload,
  IndexResponse,
  DeleteResponse,
  ReindexRequest,
  ReindexResponse,
  QueryRequest,
  QueryResponse,
  GenerateQuestionsRequest,
  GenerateQuestionsResponse,
  ConfigResponse,
} from '../types/api';

export class ApiClient {
  private baseUrl: string;

  constructor(serverUrl: string) {
    this.baseUrl = serverUrl.replace(/\/$/, '') + '/api/v1';
  }

  updateServerUrl(serverUrl: string): void {
    this.baseUrl = serverUrl.replace(/\/$/, '') + '/api/v1';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error (${response.status}): ${error}`);
    }

    return response.json();
  }

  async healthCheck(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  async indexInsight(payload: NotePayload): Promise<IndexResponse> {
    return this.request<IndexResponse>('/insights/index', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteInsight(path: string): Promise<DeleteResponse> {
    const encodedPath = encodeURIComponent(path);
    return this.request<DeleteResponse>(`/insights/${encodedPath}`, {
      method: 'DELETE',
    });
  }

  async reindexInsights(request: ReindexRequest): Promise<ReindexResponse> {
    return this.request<ReindexResponse>('/insights/reindex', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async queryInsights(request: QueryRequest): Promise<QueryResponse> {
    return this.request<QueryResponse>('/query/insights', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async generateQuestions(
    request: GenerateQuestionsRequest
  ): Promise<GenerateQuestionsResponse> {
    return this.request<GenerateQuestionsResponse>(
      '/generate/comparison-questions',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  async getConfig(): Promise<ConfigResponse> {
    return this.request<ConfigResponse>('/config');
  }

  async updateConfig(vaultPath: string): Promise<ConfigResponse> {
    return this.request<ConfigResponse>('/config', {
      method: 'PUT',
      body: JSON.stringify({ vault_path: vaultPath }),
    });
  }
}
