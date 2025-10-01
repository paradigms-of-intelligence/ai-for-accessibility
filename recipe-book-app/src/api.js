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
import { toggleTheme } from './ui/theme.js';
import { addFavorite, removeFavorite, setFontSize, currentFontSize } from './state/index.js';

/**
 * Searches recipes by title, description, ingredients, food country, and keywords.
 * @param {string} query The search term.
 * @returns {Array} An array of recipe objects that match the search query.
 */
export function searchRecipes(query) {
    const lowerCaseQuery = query.toLowerCase();
    return recipes.filter(recipe => {
        const inTitle = recipe.title.toLowerCase().includes(lowerCaseQuery);
        const inDescription = recipe.description.toLowerCase().includes(lowerCaseQuery);
        const inIngredients = recipe.ingredients.some(ing => ing.toLowerCase().includes(lowerCaseQuery));
        const inFoodCountry = recipe.food_country.toLowerCase().includes(lowerCaseQuery);
        const inKeywords = recipe.keywords.some(key => key.toLowerCase().includes(lowerCaseQuery));
        return inTitle || inDescription || inIngredients || inFoodCountry || inKeywords;
    });
}

/**
 * Sets the color theme to dark or light mode.
 * @param {boolean} isDark True to set dark mode, false for light mode.
 */
export function setDarkMode(isDark) {
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    if (isDark !== isCurrentlyDark) {
        toggleTheme();
    }
}

/**
 * Adjusts the base font size by a given factor.
 * @param {number} factor A multiplier for the font size (e.g., 2.0 for double, 0.5 for half). 
 *                        The factor should be between 0 and 2.
 */
export function setFontSizeFactor(factor) {
    if (factor > 0 && factor <= 2) {
        const newSize = Math.round(currentFontSize * factor);
        setFontSize(newSize);
        document.documentElement.style.setProperty('--base-font-size', `${newSize}px`);
        console.log(`Font size set to ${newSize}px based on factor ${factor}`);
    } else {
        console.error("Font size factor must be between 0 and 2.");
    }
}

/**
 * Retrieves a single recipe by its ID.
 * @param {number} recipeId The ID of the recipe to retrieve.
 * @returns {object | undefined} The recipe object, or undefined if not found.
 */
export function getRecipe(recipeId) {
    return recipes.find(r => r.id === recipeId);
}

/**
 * Marks or unmarks a recipe as a favorite.
 * @param {number} recipeId The ID of the recipe.
 * @param {boolean} isFavorite True to mark as favorite, false to unmark.
 */
export function markAsFavorite(recipeId, isFavorite) {
    if (isFavorite) {
        addFavorite(recipeId);
    } else {
        removeFavorite(recipeId);
    }
}
