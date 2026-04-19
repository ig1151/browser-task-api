import axios from 'axios';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

export async function claudeExtract(
  text: string,
  goal: string,
  outputSchema?: Record<string, string | string[]>
): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const schemaInstructions = outputSchema
    ? `Return a JSON object with exactly these fields: ${JSON.stringify(outputSchema)}. Only return valid JSON, no markdown.`
    : 'Return a JSON object with the most relevant structured data extracted. Only return valid JSON, no markdown.';

  const prompt = `You are a web data extraction agent.

Goal: ${goal}

${schemaInstructions}

Extract the data from the following content. If exact values are present, use them. Do not return N/A if data is visible in the content.

Content:
${text}`;

  const res = await axios.post(
    ANTHROPIC_API,
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const content = res.data.content[0]?.text ?? '{}';
  try {
    return JSON.parse(content.replace(/```json|```/g, '').trim());
  } catch {
    return { raw: content };
  }
}

export async function claudeSummarize(text: string, goal: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await axios.post(
    ANTHROPIC_API,
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Summarize the following page content in relation to this goal: "${goal}"\n\nContent:\n${text}\n\nReturn a concise, factual summary in 3-5 sentences.`,
        },
      ],
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return res.data.content[0]?.text ?? '';
}
