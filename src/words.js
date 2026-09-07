export function validateWords(value) {
  if (!Array.isArray(value) || value.length !== 5) throw new Error('Expected five words');
  const normalized = value.map(item => {
    if (!item || typeof item !== 'object') throw new Error('Invalid word');
    return Object.fromEntries(['word', 'description', 'useCase'].map(key => {
      if (typeof item[key] !== 'string' || !item[key].trim() || item[key].length > 2000) throw new Error('Invalid word field');
      return [key, item[key].trim()];
    }));
  });
  if (new Set(normalized.map(item => item.word.toLowerCase())).size !== 5) throw new Error('Duplicate words');
  return normalized;
}

export async function generateWords({ apiKey, model = 'gpt-4o-mini', fetchImpl = fetch }) {
  if (!apiKey) throw new Error('Missing API key');
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    signal: AbortSignal.timeout(45000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 1800,
      instructions: 'Você é professor de inglês para brasileiros. Selecione cinco palavras distintas e úteis de nível A2 a B2. Explique cada significado em português e escreva uma frase natural de exemplo em inglês. Varie os temas e as palavras a cada consulta.',
      input: 'Prepare cinco palavras para uma nova sessão de estudo.',
      text: { format: { type: 'json_schema', name: 'vocabulary', strict: true, schema: {
        type: 'object', additionalProperties: false,
        properties: { words: { type: 'array', minItems: 5, maxItems: 5, items: {
          type: 'object', additionalProperties: false,
          properties: { word: { type: 'string' }, description: { type: 'string' }, useCase: { type: 'string' } },
          required: ['word', 'description', 'useCase'],
        } } }, required: ['words'],
      } } },
    }),
  });
  if (!response.ok) throw new Error(`Provider status ${response.status}`);
  const data = await response.json();
  if (data.status !== 'completed') throw new Error('Provider response incomplete');
  const content = data.output?.flatMap(item => item.type === 'message' ? item.content : [])?.find(item => item.type === 'output_text')?.text;
  if (!content) throw new Error('No provider content');
  return validateWords(JSON.parse(content).words);
}

// Modo de desenvolvimento explícito. Não é um fallback silencioso da OpenAI.
export const demoWords = [
  { word: 'curiosity', description: 'Curiosidade: vontade de aprender, explorar e entender algo novo.', useCase: 'Her curiosity led her to learn a new language.' },
  { word: 'embrace', description: 'Abraçar ou aceitar uma ideia, mudança ou oportunidade com entusiasmo.', useCase: 'Embrace every opportunity to practice your English.' },
  { word: 'journey', description: 'Jornada: uma viagem ou um processo de aprendizado e transformação.', useCase: 'Learning a language is a journey, not a race.' },
  { word: 'thoughtful', description: 'Atencioso: alguém que demonstra cuidado com as outras pessoas.', useCase: 'It was thoughtful of you to help your neighbor.' },
  { word: 'achieve', description: 'Alcançar um objetivo ou resultado por meio de esforço.', useCase: 'You can achieve your goals with daily practice.' },
];
