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

// system-instructions-factory.ts

/**
 * Defines the structure for a single task the assistant can perform.
 */
export interface AssistantTask {
  /** A clear description of what the task does. */
  description: string;
  /** Examples of user queries that should trigger this task. */
  exampleQueries?: string[];
  /**
   * The sequence of function names (tools) to call for this task.
   * The functions will be called in the order they appear in the array.
   * If only one function is needed, provide a single-element array.
   * Example: ['getUserProfile', 'sendGreeting'] means call getUserProfile first, then sendGreeting.
   */
  functionCallSequence?: string[];
}

/**
 * Defines the structure for application-specific context.
 * Uses a Record for flexibility, allowing any string keys and string values.
 * Example: { documentTitle: 'My Report', documentSummary: 'A summary...' }
 */
export type AppContext = Record<string, string>;

/**
 * Defines the structure for user preferences.
 * Uses a Record for flexibility, allowing customization based on the assistant's purpose.
 * Example: { tone: 'formal', verbosity: 'concise', language: 'en-US' }
 */
export type UserPreferences = Record<string, string>;

/**
 * Configuration interface for the SystemInstructionsFactory.
 * Defines all the parameters needed to construct the factory.
 */
export interface SystemInstructionsFactoryConfig {
  /** The primary goal or purpose of the AI assistant. */
  goal: string;
  /** A list of specific tasks the assistant can perform. */
  tasks?: AssistantTask[]; // Optional: Assistant might not have specific tools
  /** User-specific preferences to tailor the assistant's behavior. */
  userPreferences?: UserPreferences; // Optional: Defaults can be used if not provided
  /** Contextual information about the application environment. */
  appContext?: AppContext; // Optional: Not always needed
}

/**
 * Factory class responsible for generating system instruction prompts for an LLM assistant.
 * It takes configuration defining the assistant's goal, tasks, user preferences,
 * and application context to create a tailored system prompt.
 */
export class SystemInstructionsFactory {
  private readonly goal: string;
  private readonly tasks: AssistantTask[];
  private readonly userPreferences: UserPreferences;
  private readonly appContext: AppContext;

  /**
   * Constructs a new SystemInstructionsFactory.
   * @param config - The configuration object containing goal, tasks, preferences, and context.
   */
  constructor(config: SystemInstructionsFactoryConfig) {
    this.goal = config.goal;
    this.tasks = config.tasks ?? []; // Default to empty array if undefined
    this.userPreferences = config.userPreferences ?? {}; // Default to empty object
    this.appContext = config.appContext ?? {}; // Default to empty object
  }

  /**
   * Creates the system instruction prompt string based on the factory's configuration.
   * @returns A string containing the formatted system instructions for the LLM.
   */
  createPrompt(): string {
    let prompt = `You are a helpful AI assistant. Your primary goal is: ${this.goal}\n\n`;

    prompt += this.buildAppContextSection();
    prompt += this.buildUserPreferencesSection();
    prompt += this.buildTasksSection();

    prompt +=
      "Based on the user's query and the provided context and tools, provide the most helpful and relevant response possible, adhering to any specified user preferences.";

    return prompt.trim(); // Remove any trailing whitespace
  }

  /**
   * Builds the Application Context section of the prompt.
   * @returns A formatted string for the app context, or an empty string if no context exists.
   */
  private buildAppContextSection(): string {
    const contextKeys = Object.keys(this.appContext);
    if (contextKeys.length === 0) {
      return '';
    }

    let section = '## Application Context\n';
    section +=
      'Consider the following contextual information about the current application state:\n';
    for (const key in this.appContext) {
      if (Object.prototype.hasOwnProperty.call(this.appContext, key)) {
        section += `- ${key}: ${this.appContext[key]}\n`;
      }
    }
    return section + '\n'; // Add extra newline for spacing
  }

  /**
   * Builds the User Preferences section of the prompt.
   * @returns A formatted string for user preferences, or an empty string if no preferences exist.
   */
  private buildUserPreferencesSection(): string {
    const preferenceKeys = Object.keys(this.userPreferences);
    if (preferenceKeys.length === 0) {
      return '';
    }

    let section = '## User Preferences\n';
    section +=
      'Please adhere to the following user preferences when generating your response:\n';
    for (const key in this.userPreferences) {
      if (Object.prototype.hasOwnProperty.call(this.userPreferences, key)) {
        section += `- ${key}: ${this.userPreferences[key]}\n`;
      }
    }
    return section + '\n'; // Add extra newline for spacing
  }

  /**
   * Builds the Available Tasks/Tools section of the prompt.
   * @returns A formatted string describing available tasks, or an empty string if no tasks exist.
   */
  private buildTasksSection(): string {
    if (this.tasks.length === 0) {
      return '';
    }

    let section = '## Available Tools/Tasks\n';
    section +=
      "You have access to the following tools/tasks. If the user's query matches the description or examples of a task, you should invoke the specified function(s) in the given order.\n\n";

    this.tasks.forEach((task, index) => {
      section += `### Task ${index + 1}\n`;
      section += `- Description: ${task.description}\n`;
      if (task.exampleQueries && task.exampleQueries.length > 0) {
        section += `- Example User Queries: \n`;
        task.exampleQueries.forEach((ex) => (section += `  - "${ex}"\n`));
      }
      // Format the function call sequence clearly
      if (task.functionCallSequence && task.functionCallSequence.length > 0) {
        const functionSequence = task.functionCallSequence
          .map((fn) => `\`${fn}\``)
          .join(' -> ');
        section += `- Function(s) to Call (in order): ${functionSequence}\n\n`;
      }
    });

    return section;
  }
}
