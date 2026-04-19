export type TaskType = 'search_and_extract' | 'visit_and_summarize' | 'extract_table';

export interface OutputSchema {
  [key: string]: string | string[];
}

export interface BrowserTaskRequest {
  goal: string;
  task_type: TaskType;
  url?: string;
  query?: string;
  output_schema?: OutputSchema;
  max_results?: number;
}

export interface BrowserTaskResult {
  status: 'success' | 'error';
  task_type: TaskType;
  goal: string;
  result: unknown;
  trace: string[];
  latency_ms: number;
  timestamp: string;
}
