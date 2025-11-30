/**
 * Example: Using the Anthropic Claude Provider
 *
 * This example demonstrates how to use the AnthropicClient
 * for chat completions, streaming, and tool use.
 */

import { AnthropicClient, ANTHROPIC_MODELS } from '../src/llm/providers/anthropic';
import type { ToolDefinition } from '../src/llm/client';

// Initialize the client
const client = new AnthropicClient({
  apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key-here',
});

// Example 1: Simple chat completion
async function simpleChatExample() {
  const response = await client.chat({
    model: ANTHROPIC_MODELS.CLAUDE_3_5_SONNET,
    messages: [
      { role: 'user', content: 'What is the capital of France?' },
    ],
    maxTokens: 1024,
  });

  console.log('Response:', response.content);
  console.log('Usage:', response.usage);
}

// Example 2: Streaming chat
async function streamingChatExample() {
  const stream = client.chatStream({
    model: ANTHROPIC_MODELS.CLAUDE_3_5_SONNET,
    messages: [
      { role: 'user', content: 'Write a short poem about AI' },
    ],
    maxTokens: 500,
  });

  console.log('Streaming response:');
  for await (const chunk of stream) {
    process.stdout.write(chunk.delta);

    if (chunk.finishReason) {
      console.log('\n\nFinish reason:', chunk.finishReason);
      console.log('Usage:', chunk.usage);
    }
  }
}

// Example 3: Tool use (function calling)
async function toolUseExample() {
  const tools: ToolDefinition[] = [
    {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      inputSchema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'The unit of temperature',
          },
        },
        required: ['location'],
      },
    },
  ];

  const response = await client.chat({
    model: ANTHROPIC_MODELS.CLAUDE_3_5_SONNET,
    messages: [
      { role: 'user', content: 'What is the weather in San Francisco?' },
    ],
    tools,
    maxTokens: 1024,
  });

  console.log('Response:', response.content);

  if (response.toolCalls && response.toolCalls.length > 0) {
    console.log('\nTool calls:');
    for (const toolCall of response.toolCalls) {
      console.log('- Tool:', toolCall.name);
      console.log('  Arguments:', toolCall.arguments);
    }
  }
}

// Example 4: Multi-turn conversation with tool results
async function conversationWithToolsExample() {
  const tools: ToolDefinition[] = [
    {
      name: 'calculate',
      description: 'Perform a mathematical calculation',
      inputSchema: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'The mathematical expression to evaluate',
          },
        },
        required: ['expression'],
      },
    },
  ];

  // First message
  const firstResponse = await client.chat({
    model: ANTHROPIC_MODELS.CLAUDE_3_5_SONNET,
    messages: [
      { role: 'user', content: 'What is 42 * 137?' },
    ],
    tools,
    maxTokens: 1024,
  });

  console.log('First response:', firstResponse.content);

  if (firstResponse.toolCalls && firstResponse.toolCalls.length > 0) {
    // Simulate tool execution
    const toolCall = firstResponse.toolCalls[0];
    const toolResult = '5754'; // 42 * 137 = 5754

    // Continue conversation with tool result
    const secondResponse = await client.chat({
      model: ANTHROPIC_MODELS.CLAUDE_3_5_SONNET,
      messages: [
        { role: 'user', content: 'What is 42 * 137?' },
        {
          role: 'assistant',
          content: firstResponse.content,
          toolCalls: firstResponse.toolCalls,
        },
        {
          role: 'tool',
          content: toolResult,
          toolCallId: toolCall.id,
        },
      ],
      tools,
      maxTokens: 1024,
    });

    console.log('\nSecond response:', secondResponse.content);
  }
}

// Example 5: Count tokens
async function tokenCountingExample() {
  const text = 'This is a test message for token counting.';
  const tokens = await client.countTokens(text, ANTHROPIC_MODELS.CLAUDE_3_5_SONNET);

  console.log('Text:', text);
  console.log('Estimated tokens:', tokens);
}

// Run examples
async function main() {
  try {
    console.log('=== Simple Chat Example ===');
    await simpleChatExample();

    console.log('\n\n=== Streaming Chat Example ===');
    await streamingChatExample();

    console.log('\n\n=== Tool Use Example ===');
    await toolUseExample();

    console.log('\n\n=== Conversation with Tools Example ===');
    await conversationWithToolsExample();

    console.log('\n\n=== Token Counting Example ===');
    await tokenCountingExample();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Uncomment to run:
// main();
