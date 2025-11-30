#!/usr/bin/env tsx
/**
 * Test script for direct OpenAI wrapper
 *
 * Run with: npx tsx src/llm/test-direct-openai.ts
 */

import { llmCall, createLLMCall } from './direct-openai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testBasicCall() {
  console.log('\n🧪 Test 1: Basic LLM call');
  console.log('─'.repeat(50));

  try {
    const response = await llmCall({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Hello from OpenAI!" and nothing else.' },
      ],
      temperature: 0.3,
      maxTokens: 50,
    });

    console.log('✅ Response:', response.content);
    console.log('📊 Usage:', {
      prompt: response.usage.promptTokens,
      completion: response.usage.completionTokens,
      total: response.usage.totalTokens,
    });

    return true;
  } catch (error) {
    console.error('❌ FAILED:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function testWithTools() {
  console.log('\n🧪 Test 2: LLM call with tool definition');
  console.log('─'.repeat(50));

  try {
    const response = await llmCall({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: 'What is the weather in San Francisco?',
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get the current weather for a location',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'The city and state, e.g. San Francisco, CA',
                },
              },
              required: ['location'],
            },
          },
        },
      ],
      temperature: 0.3,
      maxTokens: 100,
    });

    console.log('✅ Response:', response.content);
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log('🔧 Tool calls:', response.toolCalls);
    }
    console.log('📊 Usage:', {
      prompt: response.usage.promptTokens,
      completion: response.usage.completionTokens,
      total: response.usage.totalTokens,
    });

    return true;
  } catch (error) {
    console.error('❌ FAILED:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function testConfiguredCall() {
  console.log('\n🧪 Test 3: Configured LLM call with defaults');
  console.log('─'.repeat(50));

  try {
    const fastLLM = createLLMCall('gpt-4o-mini', 0.3);

    const response = await fastLLM({
      messages: [
        { role: 'user', content: 'Count from 1 to 3, one number per line.' },
      ],
      maxTokens: 50,
    });

    console.log('✅ Response:', response.content);
    console.log('📊 Usage:', {
      prompt: response.usage.promptTokens,
      completion: response.usage.completionTokens,
      total: response.usage.totalTokens,
    });

    return true;
  } catch (error) {
    console.error('❌ FAILED:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function testErrorHandling() {
  console.log('\n🧪 Test 4: Error handling (invalid API key)');
  console.log('─'.repeat(50));

  // Save original API key
  const originalKey = process.env.OPENAI_API_KEY;

  try {
    // Temporarily clear API key
    delete process.env.OPENAI_API_KEY;

    await llmCall({
      messages: [{ role: 'user', content: 'test' }],
    });

    console.error('❌ FAILED: Should have thrown an error');
    return false;
  } catch (error) {
    console.log('✅ Correctly caught error:', error instanceof Error ? error.message : error);
    return true;
  } finally {
    // Restore API key
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
}

async function runAllTests() {
  console.log('\n🚀 Running Direct OpenAI Wrapper Tests');
  console.log('='.repeat(50));

  // Check if API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.error('\n❌ OPENAI_API_KEY is not set in environment variables');
    console.error('Please set it in your .env file or environment');
    process.exit(1);
  }

  const results = {
    test1: await testBasicCall(),
    test2: await testWithTools(),
    test3: await testConfiguredCall(),
    test4: await testErrorHandling(),
  };

  console.log('\n📋 Test Summary');
  console.log('='.repeat(50));
  console.log('Test 1 (Basic call):', results.test1 ? '✅ PASS' : '❌ FAIL');
  console.log('Test 2 (With tools):', results.test2 ? '✅ PASS' : '❌ FAIL');
  console.log('Test 3 (Configured):', results.test3 ? '✅ PASS' : '❌ FAIL');
  console.log('Test 4 (Error handling):', results.test4 ? '✅ PASS' : '❌ FAIL');

  const allPassed = Object.values(results).every((r) => r);
  console.log('\n' + (allPassed ? '✅ All tests passed!' : '❌ Some tests failed'));

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
