import { runTask } from './runner';

export interface WorkflowRequest {
  workflow: string;
  input: Record<string, string>;
}

export interface WorkflowResult {
  workflow: string;
  status: 'completed' | 'failed';
  result: unknown;
  trace: string[];
  latency_ms: number;
  timestamp: string;
}

export const WORKFLOWS = [
  {
    name: 'lead_generation',
    description: 'Find companies or contacts matching a query and return structured leads',
    input_schema: { query: 'string', location: 'string (optional)', industry: 'string (optional)' },
    output_schema: { leads: 'array', count: 'number' },
  },
  {
    name: 'research_summary',
    description: 'Deep search a topic and return a structured research summary with key facts',
    input_schema: { topic: 'string', focus: 'string (optional)' },
    output_schema: { summary: 'string', key_facts: 'array', sources: 'array' },
  },
  {
    name: 'search_extract',
    description: 'Search the web for a goal and return structured extracted data',
    input_schema: { query: 'string', output_schema: 'object (optional)' },
    output_schema: { extracted: 'object', source: 'object' },
  },
  {
    name: 'price_tracker',
    description: 'Find the current price and market data for any asset, product or commodity',
    input_schema: { asset: 'string' },
    output_schema: { price: 'string', market_cap: 'string', change_24h: 'string', source: 'string' },
  },
  {
    name: 'competitor_analysis',
    description: 'Research a company and return structured competitive intelligence',
    input_schema: { company: 'string', focus: 'string (optional)' },
    output_schema: { company: 'string', summary: 'string', products: 'array', strengths: 'array', weaknesses: 'array' },
  },
];

export async function runWorkflow(req: WorkflowRequest): Promise<WorkflowResult> {
  const start = Date.now();

  const workflow = WORKFLOWS.find(w => w.name === req.workflow);
  if (!workflow) {
    return {
      workflow: req.workflow,
      status: 'failed',
      result: { error: `Unknown workflow: ${req.workflow}. Available: ${WORKFLOWS.map(w => w.name).join(', ')}` },
      trace: [`Unknown workflow: ${req.workflow}`],
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    if (req.workflow === 'lead_generation') {
      const query = [req.input.query, req.input.industry, req.input.location].filter(Boolean).join(' ');
      const taskResult = await runTask({
        goal: `Find companies and contacts for: ${query}. Extract name, website, description and contact info for each.`,
        task_type: 'search_and_extract',
        query: `${query} companies contacts leads`,
        max_results: 5,
        output_schema: {
          leads: ['{ name: string, website: string, description: string, contact: string }'],
        },
      });

      return {
        workflow: req.workflow,
        status: taskResult.status === 'success' ? 'completed' : 'failed',
        result: taskResult.result,
        trace: taskResult.trace,
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }

    if (req.workflow === 'research_summary') {
      const topic = req.input.focus
        ? `${req.input.topic} — focus on: ${req.input.focus}`
        : req.input.topic;

      const taskResult = await runTask({
        goal: `Research this topic thoroughly: ${topic}. Extract a summary, key facts, and sources.`,
        task_type: 'search_and_extract',
        query: req.input.topic,
        max_results: 5,
        output_schema: {
          summary: 'string',
          key_facts: ['string'],
          sources: ['string'],
        },
      });

      return {
        workflow: req.workflow,
        status: taskResult.status === 'success' ? 'completed' : 'failed',
        result: taskResult.result,
        trace: taskResult.trace,
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }

    if (req.workflow === 'search_extract') {
      const taskResult = await runTask({
        goal: req.input.query,
        task_type: 'search_and_extract',
        query: req.input.query,
        max_results: 3,
      });

      return {
        workflow: req.workflow,
        status: taskResult.status === 'success' ? 'completed' : 'failed',
        result: taskResult.result,
        trace: taskResult.trace,
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }

    if (req.workflow === 'price_tracker') {
      const taskResult = await runTask({
        goal: `Find the current price, market cap, and 24h change for ${req.input.asset}`,
        task_type: 'search_and_extract',
        query: `${req.input.asset} current price market cap today`,
        max_results: 3,
        output_schema: {
          price: 'string',
          market_cap: 'string',
          change_24h: 'string',
          source: 'string',
        },
      });

      return {
        workflow: req.workflow,
        status: taskResult.status === 'success' ? 'completed' : 'failed',
        result: taskResult.result,
        trace: taskResult.trace,
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }

    if (req.workflow === 'competitor_analysis') {
      const focus = req.input.focus ? ` Focus on: ${req.input.focus}.` : '';
      const taskResult = await runTask({
        goal: `Research ${req.input.company} as a competitor.${focus} Extract company summary, products, strengths and weaknesses.`,
        task_type: 'search_and_extract',
        query: `${req.input.company} company products review analysis`,
        max_results: 5,
        output_schema: {
          company: 'string',
          summary: 'string',
          products: ['string'],
          strengths: ['string'],
          weaknesses: ['string'],
        },
      });

      return {
        workflow: req.workflow,
        status: taskResult.status === 'success' ? 'completed' : 'failed',
        result: taskResult.result,
        trace: taskResult.trace,
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }

    throw new Error(`Workflow handler not implemented: ${req.workflow}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      workflow: req.workflow,
      status: 'failed',
      result: { error: message },
      trace: [`Error: ${message}`],
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}
