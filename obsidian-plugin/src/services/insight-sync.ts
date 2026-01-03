/**
 * Service for syncing Insight notes to the backend server.
 * This replaces the need for VAULT_PATH on the server side.
 */

import { TFile, TAbstractFile, Vault, Notice, debounce } from 'obsidian';
import { ApiClient } from './api-client';
import { isInsightNote, parseFrontmatter } from './note-classifier';

export interface SyncStats {
  indexed: number;
  deleted: number;
  errors: string[];
}

export class InsightSyncService {
  private vault: Vault;
  private apiClient: ApiClient;
  private syncQueue: Set<string> = new Set();
  private isSyncing: boolean = false;

  constructor(vault: Vault, apiClient: ApiClient) {
    this.vault = vault;
    this.apiClient = apiClient;
  }

  /**
   * Sync a single Insight file to the server.
   */
  async syncInsight(file: TFile): Promise<boolean> {
    if (!isInsightNote(file)) {
      return false;
    }

    try {
      const content = await this.vault.read(file);
      const { frontmatter, body } = parseFrontmatter(content);

      await this.apiClient.indexInsight({
        path: file.path,
        content: body,
        frontmatter: frontmatter as Record<string, unknown>,
      });

      console.log(`[InsightSync] Synced: ${file.path}`);
      return true;
    } catch (error) {
      console.error(`[InsightSync] Failed to sync ${file.path}:`, error);
      throw error;
    }
  }

  /**
   * Delete an Insight from the server index.
   */
  async deleteInsight(path: string): Promise<boolean> {
    try {
      await this.apiClient.deleteInsight(path);
      console.log(`[InsightSync] Deleted: ${path}`);
      return true;
    } catch (error) {
      console.error(`[InsightSync] Failed to delete ${path}:`, error);
      throw error;
    }
  }

  /**
   * Handle file creation event.
   */
  async onFileCreate(file: TAbstractFile): Promise<void> {
    if (!(file instanceof TFile) || !isInsightNote(file)) {
      return;
    }

    this.queueSync(file.path);
  }

  /**
   * Handle file modification event.
   */
  async onFileModify(file: TAbstractFile): Promise<void> {
    if (!(file instanceof TFile) || !isInsightNote(file)) {
      return;
    }

    this.queueSync(file.path);
  }

  /**
   * Handle file deletion event.
   */
  async onFileDelete(file: TAbstractFile): Promise<void> {
    if (!file.path.startsWith('Insights/')) {
      return;
    }

    try {
      await this.deleteInsight(file.path);
    } catch (error) {
      console.error(`[InsightSync] Failed to delete on server: ${file.path}`);
    }
  }

  /**
   * Handle file rename event.
   */
  async onFileRename(file: TAbstractFile, oldPath: string): Promise<void> {
    // Handle moving out of Insights folder
    if (oldPath.startsWith('Insights/') && !file.path.startsWith('Insights/')) {
      try {
        await this.deleteInsight(oldPath);
      } catch (error) {
        console.error(`[InsightSync] Failed to delete old path: ${oldPath}`);
      }
      return;
    }

    // Handle moving into Insights folder
    if (!oldPath.startsWith('Insights/') && file.path.startsWith('Insights/')) {
      if (file instanceof TFile) {
        this.queueSync(file.path);
      }
      return;
    }

    // Handle rename within Insights folder
    if (oldPath.startsWith('Insights/') && file.path.startsWith('Insights/')) {
      try {
        await this.deleteInsight(oldPath);
      } catch (error) {
        console.error(`[InsightSync] Failed to delete old path: ${oldPath}`);
      }

      if (file instanceof TFile) {
        this.queueSync(file.path);
      }
    }
  }

  /**
   * Queue a file for sync (debounced).
   */
  private queueSync(path: string): void {
    this.syncQueue.add(path);
    this.processSyncQueueDebounced();
  }

  private processSyncQueueDebounced = debounce(
    async () => {
      await this.processSyncQueue();
    },
    500,
    true
  );

  private async processSyncQueue(): Promise<void> {
    if (this.isSyncing || this.syncQueue.size === 0) {
      return;
    }

    this.isSyncing = true;

    const paths = Array.from(this.syncQueue);
    this.syncQueue.clear();

    for (const path of paths) {
      const file = this.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        try {
          await this.syncInsight(file);
        } catch (error) {
          // Re-queue failed syncs
          this.syncQueue.add(path);
        }
      }
    }

    this.isSyncing = false;

    // Process any items added during sync
    if (this.syncQueue.size > 0) {
      this.processSyncQueueDebounced();
    }
  }

  /**
   * Sync all Insights in the vault to the server.
   * Used for initial sync or full re-sync.
   */
  async syncAllInsights(showNotice: boolean = true): Promise<SyncStats> {
    const stats: SyncStats = {
      indexed: 0,
      deleted: 0,
      errors: [],
    };

    if (showNotice) {
      new Notice('Syncing Insights to server...');
    }

    const insightFiles = this.vault.getFiles().filter(isInsightNote);

    for (const file of insightFiles) {
      try {
        await this.syncInsight(file);
        stats.indexed++;
      } catch (error) {
        stats.errors.push(`${file.path}: ${error}`);
      }
    }

    if (showNotice) {
      if (stats.errors.length > 0) {
        new Notice(
          `Synced ${stats.indexed} Insights. ${stats.errors.length} errors.`
        );
      } else {
        new Notice(`Synced ${stats.indexed} Insights successfully.`);
      }
    }

    return stats;
  }
}
