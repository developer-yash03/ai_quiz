import dotenv from 'dotenv';
dotenv.config();

export function createPromptBuilder(defaultModel = 'gemini-1.5-flash') {
  let callCount = 0;
  const history = [];

  return {
    buildPrompt(topic) {
      callCount++;
      const promptText = `
You are an expert educational assessment creator.
Generate a high-quality 5-question Multiple Choice Quiz (MCQ) on the topic: "${topic}".

STRICT GUIDELINES:
1. Generate exactly 5 questions.
2. Each question must have exactly 4 options labeled "A", "B", "C", and "D".
3. Exactly one option must be the correct answer.
4. Include a brief, clear explanation for why the correct answer is right.
5. Return ONLY a valid JSON array matching the exact structure below. Do not wrap in markdown or backticks.

REQUIRED JSON FORMAT:
[
  {
    "question": "Clear question text here?",
    "options": {
      "A": "First option",
      "B": "Second option",
      "C": "Third option",
      "D": "Fourth option"
    },
    "correct_answer": "A",
    "explanation": "Why A is correct."
  }
]
`;
      history.push({ topic, timestamp: new Date() });
      return promptText;
    },

    getStats() {
      return { totalPromptCalls: callCount, historyCount: history.length, model: defaultModel };
    }
  };
}

export const promptEngine = createPromptBuilder('gemini-1.5-flash');

export async function generateMCQsWithLLM(topic, customApiKey = null) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  const prompt = promptEngine.buildPrompt(topic);

  if (apiKey && (apiKey.startsWith('AIza') || process.env.GEMINI_API_KEY)) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length >= 5) {
        return parsed.slice(0, 5);
      }
    } catch (err) {
      console.warn('Gemini API call failed, using fallback generator:', err.message);
    }
  }

  if (apiKey && apiKey.startsWith('sk-')) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a quiz generation engine that strictly outputs valid JSON.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = JSON.parse(data.choices[0].message.content);
        const questions = Array.isArray(content) ? content : (content.questions || Object.values(content)[0]);
        if (Array.isArray(questions)) return questions.slice(0, 5);
      }
    } catch (err) {
      console.warn('OpenAI API call failed, using fallback generator:', err.message);
    }
  }

  return generateTopicFallbackMCQs(topic);
}

function generateTopicFallbackMCQs(topic) {
  const t = topic.trim();
  return [
    {
      question: `What is the core fundamental principle behind ${t}?`,
      options: {
        A: `It establishes foundational structures and primary mechanisms of ${t}`,
        B: `It is completely unrelated to computation or domain logic`,
        C: `It only works in legacy systems without active configuration`,
        D: `It serves solely as an aesthetic decorator without functional value`
      },
      correct_answer: 'A',
      explanation: `Option A accurately states the core principle and mechanisms of ${t}.`
    },
    {
      question: `Which of the following is considered a best practice when working with ${t}?`,
      options: {
        A: `Ignoring modular design and combining all concerns into a single file`,
        B: `Applying structured schema validation and systematic error handling`,
        C: `Hardcoding sensitive credentials directly into client-side code`,
        D: `Disabling logging and performance monitoring entirely`
      },
      correct_answer: 'B',
      explanation: `Structured validation and error handling ensure robust reliability for ${t}.`
    },
    {
      question: `In modern architectures, how does ${t} optimize performance and scalability?`,
      options: {
        A: `By blocking asynchronous operations and running synchronously`,
        B: `By increasing network latency through uncompressed payloads`,
        C: `By leveraging efficient caching, indexing, and asynchronous processing`,
        D: `By multiplying memory footprint exponentially`
      },
      correct_answer: 'C',
      explanation: `Modern implementations use caching, indexing, and async execution for efficiency.`
    },
    {
      question: `Which data format is most commonly used for structured outputs in ${t}?`,
      options: {
        A: `Unformatted raw binary strings`,
        B: `Standardized JSON / JSON Schema`,
        C: `Proprietary undocumented bytecode`,
        D: `Plain CSV with inconsistent delimiters`
      },
      correct_answer: 'B',
      explanation: `JSON is universally adopted for structured LLM outputs and web API contracts.`
    },
    {
      question: `When integrating relational databases with ${t}, what guarantees relational integrity?`,
      options: {
        A: `Primary Keys and Foreign Key constraints with relational JOINs`,
        B: `Random file renaming without metadata`,
        C: `Deleting all indexes before queries`,
        D: `Storing all data in unindexed plaintext files`
      },
      correct_answer: 'A',
      explanation: `Primary and Foreign keys enforce referential integrity across relational tables.`
    }
  ];
}
