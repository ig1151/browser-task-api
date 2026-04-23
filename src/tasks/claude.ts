const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-sonnet-4-5';

async function callOpenRouter(prompt: string, json = false): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
      ...(json && { response_format: { type: 'json_object' } }),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error: ${response.status} ${err}`);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content ?? '';
}

export async function claudeExtract(
  text: string,
  goal: string,
  outputSchema?: Record<string, string | string[]>
): Promise<unknown> {
  const schemaInstructions = outputSchema
    ? `Return a JSON object with exactly these fields: ${JSON.stringify(outputSchema)}. Only return valid JSON, no markdown.`
    : 'Return a JSON object with the most relevant structured data extracted. Only return valid JSON, no markdown.';

  const prompt = `You are a web data extraction agent.
Goal: ${goal}
${schemaInstructions}
Extract the data from the following content. If exact values are present, use them. Do not return N/A if data is visible in the content.
Content:
${text}`;

  const content = await callOpenRouter(prompt, true);
  try {
    return JSON.parse(content.replace(/```json|```/g, '').trim());
  } catch {
    return { raw: content };
  }
}

export async function claudeSummarize(text: string, goal: string): Promise<string> {
  const prompt = `Summarize the following page content in relation to this goal: "${goal}"

Content:
${text}

Return a concise, factual summary in 3-5 sentences.`;

  return callOpenRouter(prompt, false);
}
