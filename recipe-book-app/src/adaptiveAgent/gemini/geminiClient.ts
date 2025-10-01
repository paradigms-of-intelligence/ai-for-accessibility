// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  ChatSession,
  EnhancedGenerateContentResponse,
  FunctionCall,
  FunctionDeclaration,
  GenerateContentResponse,
  GenerateContentResult,
  GenerativeModel,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  Part,
} from '@google/generative-ai';
import EventEmitter from 'eventemitter3';
import {GeminiClientConfig} from '../config/agentConfig';

/**
 * Defines the events emitted by the GeminiClient.
 */
export type GeminiClientEvent =
  | 'chatInitialized'
  | 'thinking'
  | 'responseChunk'
  | 'responseComplete'
  | 'functionCallRequested'
  | 'functionCallCompleted'
  | 'error';

/**
 * A client for interacting with the Gemini API.
 * It handles the initialization of the API, chat sessions,
 * sending messages, handling function calls, and emitting events.
 */
export class GeminiClient extends EventEmitter<GeminiClientEvent> {
  private generativeAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private chat: ChatSession | null = null;
  private config: GeminiClientConfig;
  private systemInstruction: string;

  // Generation configuration (same as before)
  private generationConfig = {
    temperature: 0.5,
  };

  constructor(config: GeminiClientConfig) {
    super();
    this.config = config;
    this.generativeAI = new GoogleGenerativeAI(config.apiKey);
    this.systemInstruction = config.systemInstructionsFactory.createPrompt();

    this.model = this.generativeAI.getGenerativeModel({
      model: config.modelName || 'gemini-2.5-flash',
      systemInstruction: this.systemInstruction,
      tools: config.toolsConfig?.functionDeclarations?.length
        ? [{functionDeclarations: config.toolsConfig.functionDeclarations}]
        : undefined,
      generationConfig: this.generationConfig,
    });

    console.log('GeminiClient initialized with model:', this.model.model);
    if (config.toolsConfig?.functionDeclarations?.length) {
      console.log(
        'Tools configured:',
        config.toolsConfig.functionDeclarations.map((f) => f.name),
      );
    } else {
      console.log('No tools configured.');
    }
  }

  /**
   * Starts the chat session. Must be called before sending messages.
   */
  initializeChat(history: Part[] = []): void {
    try {
      this.chat = this.model.startChat({history});
      console.log('Gemini chat session initialized.');
      this.emit('chatInitialized');
    } catch (error) {
      console.error('Error initializing Gemini chat:', error);
      this.emit('error', {
        message: 'Failed to initialize chat session.',
        details: error,
      });
    }
  }

  /**
   * Sends a user message to the Gemini model and handles the response,
   * including function call loops.
   * @param userInput The text message from the user.
   */
  async sendMessage(userInput: string): Promise<void> {
    if (!this.chat) {
      const errorMsg = 'Chat not initialized. Call initializeChat() first.';
      console.error(errorMsg);
      this.emit('error', {message: errorMsg});
      return;
    }

    this.emit('thinking');

    try {
      await this.processApiResponse(await this.chat.sendMessage(userInput));
    } catch (error) {
      console.error('Error sending message or processing response:', error);
      this.emit('error', {
        message: 'Failed to get response from Gemini.',
        details: error,
      });
      this.emit('responseComplete', {text: null, error});
    }
  }

  /**
   * Processes the API response, handling potential function calls recursively.
   * @param result The result object from a sendMessage call.
   */
  private async processApiResponse(
    result: GenerateContentResult | undefined,
  ): Promise<void> {
    if (!result || !result.response) {
      throw new Error('Received invalid response from API');
    }

    const response = result.response as EnhancedGenerateContentResponse;
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      await this.handleFunctionCalls(functionCalls);
    } else {
      const text = response.text();
      console.log('Gemini Response:', text);
      this.emit('responseComplete', {text});
    }
  }

  /**
   * Handles the execution of function calls requested by the model.
   * @param functionCalls An array of FunctionCall objects.
   */
  private async handleFunctionCalls(
    functionCalls: FunctionCall[],
  ): Promise<void> {
    if (!this.chat) {
      throw new Error('Chat not initialized during function call handling.');
    }
    if (!this.config.toolsConfig?.handleToolCall) {
      throw new Error('handleToolCall function is not configured.');
    }

    console.log(
      `Gemini requested ${functionCalls.length} function call(s):`,
      functionCalls.map((fc) => fc.name),
    );
    this.emit('functionCallRequested', functionCalls);

    const functionResponseParts: Part[] = [];

    await Promise.all(
      functionCalls.map(async (fc) => {
        const functionName = fc.name;
        const args = fc.args;

        console.log(`Executing function: ${functionName} with args:`, args);
        try {
          const toolResult = await this.config.toolsConfig.handleToolCall(
            functionName,
            args,
          );

          // Always wrap the tool result in a standard object structure.
          // The Gemini API requires the 'response' field to be a JSON object.
          // This prevents errors when a tool returns a primitive (string) or an
          // array, by ensuring the top-level payload is always an object.
          const functionResponseData = {
            result: toolResult,
          };

          functionResponseParts.push({
            functionResponse: {
              name: functionName,
              response: functionResponseData,
            },
          });
          this.emit('functionCallCompleted', {
            name: functionName,
            args,
            result: functionResponseData,
          });
        } catch (error) {
          console.error(`Error executing tool ${functionName}:`, error);
          this.emit('error', {
            message: `Error executing tool ${functionName}`,
            details: error,
          });
          functionResponseParts.push({
            functionResponse: {
              name: functionName,
              response: {
                error: `Failed to execute tool: ${error instanceof Error ? error.message : String(error)}`,
              },
            },
          });
        }
      }),
    );

    console.log(
      'Sending function responses back to Gemini:',
      functionResponseParts,
    );
    const nextResult = await this.chat.sendMessage(functionResponseParts);
    await this.processApiResponse(nextResult);
  }

  /**
   * Cleans up resources, like removing listeners inherited from EventEmitter.
   */
  destroy(): void {
    this.removeAllListeners();
    this.chat = null;
    console.log('GeminiClient destroyed.');
  }
}
