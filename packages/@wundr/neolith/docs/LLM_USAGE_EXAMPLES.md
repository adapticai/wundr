# LLM Service Usage Examples

## Table of Contents

1. [Server-Side Examples](#server-side-examples)
2. [Client-Side Examples](#client-side-examples)
3. [API Route Examples](#api-route-examples)
4. [Advanced Use Cases](#advanced-use-cases)

## Server-Side Examples

### Basic Chat Completion

```typescript
import { getLLMService } from '@neolith/core/services';

async function generateWelcomeMessage(userName: string) {
  const llm = getLLMService({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const result = await llm.chat(
    `Generate a friendly welcome message for a new user named ${userName}`,
    { temperature: 0.7 }
  );

  console.log('Tokens used:', result.usage.total_tokens);
  console.log('Cost:', result.usage.cost);

  return result.response;
}
```

### JSON Response

```typescript
import { getLLMService } from '@neolith/core/services';

interface TaskList {
  title: string;
  tasks: Array<{
    task: string;
    priority: 'high' | 'medium' | 'low';
    completed: boolean;
  }>;
}

async function generateTaskList(topic: string) {
  const llm = getLLMService();

  const result = await llm.chatJSON<TaskList>(
    `Generate a task list for: ${topic}. Include 5 tasks with priorities.`
  );

  return result.response;
}
```

### Structured Response with Schema

```typescript
import { getLLMService } from '@neolith/core/services';

interface Person {
  name: string;
  age: number;
  email: string;
  occupation: string;
}

async function extractPersonInfo(text: string) {
  const llm = getLLMService();

  const schema = {
    type: 'object' as const,
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
      email: { type: 'string' },
      occupation: { type: 'string' }
    },
    required: ['name', 'age', 'email', 'occupation']
  };

  const result = await llm.chatStructured<Person>(
    `Extract person information from this text: "${text}"`,
    schema
  );

  return result.response;
}
```

### Conversational Chat with History

```typescript
import { getLLMService, type ChatMessage } from '@neolith/core/services';

async function continueConversation(
  history: ChatMessage[],
  newMessage: string
) {
  const llm = getLLMService();

  const messages: ChatMessage[] = [
    ...history,
    { role: 'user', content: newMessage }
  ];

  const result = await llm.chatWithHistory(messages);

  return result.response;
}

// Usage
const conversation: ChatMessage[] = [
  { role: 'system', content: 'You are a helpful coding assistant.' },
  { role: 'user', content: 'How do I create a React component?' },
  { role: 'assistant', content: 'To create a React component...' }
];

const response = await continueConversation(
  conversation,
  'Can you show me an example?'
);
```

### Image Analysis

```typescript
import { getLLMService } from '@neolith/core/services';
import fs from 'fs';

async function analyzeProductImage(imagePath: string) {
  const llm = getLLMService();

  // Read image and convert to base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const result = await llm.analyzeImage(
    `data:image/jpeg;base64,${base64Image}`,
    'Describe this product in detail, including features, condition, and estimated value.'
  );

  return result.response;
}
```

## Client-Side Examples

### Simple Chat Component

```typescript
'use client';

import { useLLMChat } from '@/hooks/useLLMChat';
import { useState } from 'react';

export function SimpleChatBox() {
  const { chat, loading, error, lastUsage } = useLLMChat();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    const response = await chat(userMessage);

    if (response) {
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <div className="flex-1 overflow-y-auto mb-4 space-y-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg ${
              msg.role === 'user'
                ? 'bg-blue-100 ml-auto max-w-[80%]'
                : 'bg-gray-100 mr-auto max-w-[80%]'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && <div className="text-gray-500">Thinking...</div>}
        {error && <div className="text-red-500">Error: {error}</div>}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
          className="flex-1 px-4 py-2 border rounded-lg"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300"
        >
          Send
        </button>
      </form>

      {lastUsage && (
        <div className="text-xs text-gray-500 mt-2">
          Tokens: {lastUsage.prompt_tokens + lastUsage.completion_tokens} |
          Cost: ${lastUsage.cost.toFixed(4)}
        </div>
      )}
    </div>
  );
}
```

### JSON Response Component

```typescript
'use client';

import { useLLMChat } from '@/hooks/useLLMChat';
import { useState } from 'react';

interface Recipe {
  name: string;
  ingredients: string[];
  instructions: string[];
  prepTime: number;
  cookTime: number;
}

export function RecipeGenerator() {
  const { chatJSON, loading, error } = useLLMChat();
  const [ingredient, setIngredient] = useState('');
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  const generateRecipe = async () => {
    const result = await chatJSON<Recipe>(
      `Generate a recipe using ${ingredient}. Include name, ingredients list, step-by-step instructions, prep time and cook time in minutes.`
    );

    if (result) {
      setRecipe(result);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Recipe Generator</h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={ingredient}
          onChange={(e) => setIngredient(e.target.value)}
          placeholder="Enter an ingredient..."
          className="flex-1 px-4 py-2 border rounded"
        />
        <button
          onClick={generateRecipe}
          disabled={loading || !ingredient}
          className="px-6 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
        >
          {loading ? 'Generating...' : 'Generate Recipe'}
        </button>
      </div>

      {error && <div className="text-red-500 mb-4">Error: {error}</div>}

      {recipe && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">{recipe.name}</h2>

          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>Prep Time: {recipe.prepTime} mins</div>
            <div>Cook Time: {recipe.cookTime} mins</div>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold mb-2">Ingredients:</h3>
            <ul className="list-disc list-inside">
              {recipe.ingredients.map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Instructions:</h3>
            <ol className="list-decimal list-inside space-y-2">
              {recipe.instructions.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Image Analysis Component

```typescript
'use client';

import { useLLMImageAnalysis } from '@/hooks/useLLMChat';
import { useState } from 'react';

export function ImageAnalyzer() {
  const { analyzeImage, loading, error } = useLLMImageAnalysis();
  const [imageUrl, setImageUrl] = useState('');
  const [analysis, setAnalysis] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImageUrl(base64);

      const result = await analyzeImage(
        base64,
        'Describe this image in detail. What objects, people, or scenes do you see?'
      );

      if (result) {
        setAnalysis(result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Image Analyzer</h1>

      <div className="mb-6">
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
      </div>

      {loading && <div className="text-gray-500 mb-4">Analyzing image...</div>}
      {error && <div className="text-red-500 mb-4">Error: {error}</div>}

      {imageUrl && (
        <div className="space-y-4">
          <img
            src={imageUrl}
            alt="Uploaded"
            className="w-full rounded-lg shadow-lg"
          />

          {analysis && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Analysis:</h3>
              <p className="text-gray-700">{analysis}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## API Route Examples

### Custom API Route with LLM

```typescript
// app/api/summarize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getLLMService } from '@neolith/core/services';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { text, maxLength } = await req.json();

  if (!text) {
    return NextResponse.json(
      { error: 'Text is required' },
      { status: 400 }
    );
  }

  const llm = getLLMService();

  const result = await llm.chat(
    `Summarize the following text in ${maxLength || 100} words or less:\n\n${text}`,
    { temperature: 0.5 }
  );

  return NextResponse.json({
    summary: result.response,
    usage: result.usage
  });
}
```

## Advanced Use Cases

### Multi-Step Workflow

```typescript
import { getLLMService } from '@neolith/core/services';

interface BlogPost {
  title: string;
  outline: string[];
  content: string;
}

async function generateBlogPost(topic: string): Promise<BlogPost> {
  const llm = getLLMService();

  // Step 1: Generate title
  const titleResult = await llm.chatJSON<{ title: string }>(
    `Generate a compelling blog post title about: ${topic}`
  );

  // Step 2: Generate outline
  const outlineResult = await llm.chatJSON<{ outline: string[] }>(
    `Create a detailed outline for a blog post titled "${titleResult.response.title}"`
  );

  // Step 3: Generate full content
  const contentResult = await llm.chat(
    `Write a full blog post with the following outline:\n${outlineResult.response.outline.join('\n')}`,
    { model: 'gpt-5', temperature: 0.7 }
  );

  return {
    title: titleResult.response.title,
    outline: outlineResult.response.outline,
    content: contentResult.response
  };
}
```

### Batch Processing

```typescript
import { getLLMService } from '@neolith/core/services';

async function processBatchSentiment(texts: string[]) {
  const llm = getLLMService();

  const results = await Promise.all(
    texts.map(async (text) => {
      const result = await llm.chatJSON<{ sentiment: 'positive' | 'negative' | 'neutral', score: number }>(
        `Analyze the sentiment of this text: "${text}"`
      );
      return { text, ...result.response };
    })
  );

  return results;
}
```

### RAG (Retrieval-Augmented Generation)

```typescript
import { getLLMService } from '@neolith/core/services';

interface Document {
  id: string;
  content: string;
  relevance: number;
}

async function answerQuestionWithContext(
  question: string,
  documents: Document[]
) {
  const llm = getLLMService();

  // Sort by relevance and take top 3
  const topDocs = documents
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 3);

  const context = topDocs.map(doc => doc.content).join('\n\n');

  const result = await llm.chat(
    `Using the following context, answer the question.\n\nContext:\n${context}\n\nQuestion: ${question}\n\nAnswer:`,
    { temperature: 0.3 }
  );

  return {
    answer: result.response,
    sources: topDocs.map(doc => doc.id),
    usage: result.usage
  };
}
```

### Function Calling / Tool Use

```typescript
import { getLLMService } from '@neolith/core/services';
import { lumic } from '@neolith/core/services';

async function weatherAssistant(userMessage: string) {
  // Define tools
  const tools = [
    {
      type: 'function' as const,
      function: {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name or coordinates'
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
              description: 'Temperature unit'
            }
          },
          required: ['location']
        }
      }
    }
  ];

  // Call LLM with tools
  const result = await lumic.llm.call(userMessage, 'text', {
    model: 'gpt-5-mini',
    tools,
  });

  if (result.tool_calls) {
    // Process tool calls
    const weatherData = await getWeather(
      result.tool_calls[0].function.arguments.location
    );

    // Send tool results back to LLM
    const finalResult = await lumic.llm.call(
      'Based on this weather data, provide a summary',
      'text',
      {
        context: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: '', tool_calls: result.tool_calls },
          {
            role: 'tool',
            content: JSON.stringify(weatherData),
            tool_call_id: result.tool_calls[0].id
          }
        ]
      }
    );

    return finalResult.response;
  }

  return result.response;
}
```

## Best Practices

1. **Error Handling**
```typescript
try {
  const result = await llm.chat(prompt);
  return result.response;
} catch (error) {
  console.error('LLM error:', error);
  // Fallback or retry logic
  return 'Sorry, I encountered an error processing your request.';
}
```

2. **Cost Optimization**
```typescript
// Use cheaper model for simple tasks
const llm = getLLMService({ defaultModel: 'gpt-5-mini' });

// Set max tokens to limit costs
await llm.chat(prompt, { max_completion_tokens: 500 });

// Track usage
const result = await llm.chat(prompt);
console.log(`Cost: $${result.usage.cost.toFixed(4)}`);
```

3. **Temperature Guidelines**
```typescript
// Creative tasks: higher temperature (0.7-1.0)
await llm.chat('Write a creative story', { temperature: 0.9 });

// Factual tasks: lower temperature (0.0-0.3)
await llm.chat('Extract data from this text', { temperature: 0.1 });

// Balanced: medium temperature (0.4-0.7)
await llm.chat('Summarize this article', { temperature: 0.5 });
```

4. **Model Selection**
```typescript
// Fast, cheap tasks: gpt-5-mini
await llm.chat('Quick question', { model: 'gpt-5-mini' });

// Complex reasoning: o3-mini or gpt-5
await llm.chat('Complex analysis', { model: 'gpt-5' });

// Code generation: gpt-5
await llm.chat('Write a function', { model: 'gpt-5' });
```
