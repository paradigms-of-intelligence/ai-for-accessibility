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

import {FunctionDeclaration} from '@google/generative-ai';
import {
  SystemInstructionsFactory,
  SystemInstructionsFactoryConfig,
} from './systemInstructionsFactory';
import {functionDeclarations, handleToolCall} from './tools';

export interface GeminiClientConfig {
  systemInstructionsFactory: SystemInstructionsFactory;
  toolsConfig: {
    functionDeclarations: FunctionDeclaration[];
    handleToolCall: (
      functionName: string,
      args: any,
    ) => Promise<string | object | null>;
  };
  apiKey: string;
  modelName?: string;
}

export function getGeminiClientConfig(
  apiKey: string,
  userPreferences?: Record<string, string>,
  modelName?: string,
): GeminiClientConfig {
  const agentConfig: SystemInstructionsFactoryConfig = {
    goal: "You are a helpful AI assistant integrated into a Recipe Book application. Your primary goal is to help users find, view, and manage recipes by interacting with the UI on their behalf. You can search for recipes, display recipe details, manage a list of favorites, and adjust UI settings like dark mode and font size. You also act as a user guide, explaining how to use the application's features. IMPORTANT: Always respond in plain text. Do not use markdown (like **bold** or *italics*), lists, or any other formatting, as the speech synthesizer can only read simple text and punctuation.",
    tasks: [
      {
        description: 'Searches for recipes by a keyword or phrase.',
        exampleQueries: [
          'Find recipes with chicken',
          'Search for pasta dishes',
          'Show me some desserts',
        ],
        functionCallSequence: ['search_recipes'],
      },
      {
        description:
          "Lists the recipes currently visible on the screen to understand the context. This should be used before viewing a recipe if the user's query is ambiguous (e.g., 'open the first one').",
        exampleQueries: [
          'What recipes are shown right now?',
          "What's on the screen?",
          'List the current recipes',
        ],
        functionCallSequence: ['list_recipes'],
      },
      {
        description: 'Displays the detailed view for a specific recipe.',
        exampleQueries: [
          'Show me how to make the Classic Pancakes',
          'Open recipe ID 7',
          "Let's look at the first one",
        ],
        functionCallSequence: ['view_recipe'],
      },
      {
        description:
          'Gets the details (like ingredients or country) for a specific recipe without navigating away from the current view. Useful for answering specific questions.',
        exampleQueries: [
          'What are the ingredients for the Guacamole?',
          'Where is the Beef Tacos recipe from?',
          'Tell me more about recipe 14',
        ],
        functionCallSequence: ['get_recipe_details'],
      },
      {
        description: 'Adds or removes a recipe from the user’s favorites list.',
        exampleQueries: [
          'Add the pancake recipe to my favorites',
          'Save this recipe',
          'Remove the burger from my favorites',
          'Unfavorite the pasta',
        ],
        functionCallSequence: ['mark_as_favorite'],
      },
      {
        description: "Retrieves the user's list of saved favorite recipes.",
        exampleQueries: [
          "What's in my favorites?",
          'Show me my saved recipes',
          'List my favorites',
        ],
        functionCallSequence: ['list_favorites'],
      },
      {
        description:
          'Navigates from a recipe detail page back to the main list.',
        exampleQueries: ['Go back to the list', 'Show all recipes again'],
        functionCallSequence: ['go_back_to_list'],
      },
      {
        description:
          'Toggles the user interface between light and dark themes.',
        exampleQueries: [
          'Enable dark mode',
          'Switch to light theme',
          "It's too bright in here",
        ],
        functionCallSequence: ['set_dark_mode'],
      },
      {
        description: 'Adjusts the font size of the application.',
        exampleQueries: [
          'Make the text bigger',
          'Increase the font size a little',
          'I can’t read this, make it 50% larger',
          'Decrease the text size',
        ],
        functionCallSequence: ['set_font_size'],
      },
    ],
    userPreferences:
      userPreferences ||
      {
        // Example User Preferences. These could be loaded from app settings.
        // tone: 'friendly',
        // verbosity: 'concise',
      },
    // Application context can be dynamically populated if needed
    appContext: {
      appName: 'Recipe Book App',
    },
  };

  return {
    systemInstructionsFactory: new SystemInstructionsFactory(agentConfig),
    toolsConfig: {
      functionDeclarations,
      handleToolCall,
    },
    apiKey,
    modelName,
  };
}
