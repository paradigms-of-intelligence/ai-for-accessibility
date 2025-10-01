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

import { recipes } from './data/recipes.js';
import { renderRecipeList, renderFavorites } from './ui/render.js';
import { initTheme } from './ui/theme.js';

const searchInput = document.getElementById('search-input');
const recipeDetailView = document.getElementById('recipe-detail-view');
const recipeListView = document.getElementById('recipe-list-view');

/**
 * Searches recipes by title, description, ingredients, food country, and keywords.
 * @param {string} query The search term.
 */
function searchRecipes(query) {
    const lowerCaseQuery = query.toLowerCase();
    const filteredRecipes = recipes.filter(recipe => {
        const inTitle = recipe.title.toLowerCase().includes(lowerCaseQuery);
        const inDescription = recipe.description.toLowerCase().includes(lowerCaseQuery);
        const inIngredients = recipe.ingredients.some(ing => ing.toLowerCase().includes(lowerCaseQuery));
        const inFoodCountry = recipe.food_country.toLowerCase().includes(lowerCaseQuery);
        const inKeywords = recipe.keywords.some(key => key.toLowerCase().includes(lowerCaseQuery));
        return inTitle || inDescription || inIngredients || inFoodCountry || inKeywords;
    });
    recipeDetailView.classList.add('hidden');
    recipeListView.classList.remove('hidden');
    renderRecipeList(filteredRecipes);
    console.log(`Searching for: ${query}`);
}

// --- INITIALIZATION & EVENT LISTENERS ---
function init() {
    initTheme();

    // Render initial lists
    renderRecipeList(recipes);
    renderFavorites();

    // Event Listeners
    searchInput.addEventListener('input', (e) => searchRecipes(e.target.value));
}

// Run the app
document.addEventListener('DOMContentLoaded', init);

// ----- Integration for Adaptive Agent -----
// This snippet initializes the agent after the main application UI is ready.
import { initializeAgent } from './adaptiveAgent/agent';

// --- !! IMPORTANT !! ---
// An API key is included here for demonstration purposes.
// For production, you must use a secure method to store and access your API key,
// such as environment variables or a secure backend service.
// Do not commit this key to a public repository.
const GEMINI_API_KEY = 'YOUR_API_KEY_HERE';

const agentTargetSelector = '#agent-container';

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_API_KEY_HERE') {
  if (document.querySelector(agentTargetSelector)) {
    initializeAgent({
      targetElementSelector: agentTargetSelector,
      apiKey: GEMINI_API_KEY,
      language: 'en-US',
      modelName: 'gemini-2.5-flash',
      shortcuts: {
        toggleAgent: {key: 'Enter'},
        toggleMic: {key: 'A'},
      },
    });
  } else {
    console.error(`Adaptive Agent: Target element "${agentTargetSelector}" not found. Agent not initialized.`);
  }
} else {
  console.warn("Gemini API Key is missing or is a placeholder. Adaptive Agent not initialized. Please replace 'YOUR_API_KEY_HERE' in main.js.");
}
// ----- End Integration for Adaptive Agent -----
