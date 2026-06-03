export async function runOllamaJson<T>(systemPrompt: string, userPrompt: string) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.1:8b";

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    message?: {
      content?: string;
    };
  };
  const content = payload.message?.content?.trim();

  if (!content) {
    throw new Error("Ollama returned an empty response");
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error("Ollama returned invalid JSON");
  }
}