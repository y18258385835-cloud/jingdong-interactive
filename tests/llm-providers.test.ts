import { describe, expect, it } from 'vitest';
import { getModelsEndpoint, getProvider } from '../src/utils/llmProviders';

describe('LLM provider endpoint derivation', () => {
  it('derives models from a complete chat endpoint', () => {
    expect(getModelsEndpoint('custom', 'https://ai.example.com/v1/chat/completions'))
      .toBe('https://ai.example.com/v1/models');
  });

  it('derives models from a version root or service root', () => {
    expect(getModelsEndpoint('custom', 'https://ai.example.com/v1')).toBe('https://ai.example.com/v1/models');
    expect(getModelsEndpoint('custom', 'https://ai.example.com')).toBe('https://ai.example.com/v1/models');
  });

  it('keeps an explicitly supplied models endpoint', () => {
    expect(getModelsEndpoint('custom', 'https://ai.example.com/models')).toBe('https://ai.example.com/models');
  });

  it('includes Ollama as a first-class local provider with default port 11434', () => {
    const ollama = getProvider('ollama');
    expect(ollama).toBeDefined();
    expect(ollama?.endpoint).toBe('http://localhost:11434/v1/chat/completions');
    expect(ollama?.modelsEndpoint).toBe('http://localhost:11434/v1/models');
    expect(ollama?.supportsVision).toBe(true);
  });

  it('includes Gemini provider with OpenAI-compatible endpoint', () => {
    const gemini = getProvider('gemini');
    expect(gemini).toBeDefined();
    expect(gemini?.endpoint).toContain('generativelanguage.googleapis.com');
  });
});
