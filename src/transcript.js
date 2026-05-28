export function parseTranscriptUsage(jsonlText) {
  let totalInputTokens = 0, totalOutputTokens = 0, lastContextTokens = 0;
  for (const line of (jsonlText || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try { obj = JSON.parse(trimmed); } catch { continue; }
    const usage = obj?.message?.usage;
    if (!usage) continue;
    const input = usage.input_tokens || 0;
    const output = usage.output_tokens || 0;
    const cache = (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
    totalInputTokens += input;
    totalOutputTokens += output;
    lastContextTokens = input + cache;
  }
  return {
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    lastContextTokens,
  };
}
