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

import { recipes } from '../data/recipes.js';
import { favorites, addFavorite, removeFavorite } from '../state/index.js';

const recipeList = document.getElementById('recipe-list');
const favoritesList = document.getElementById('favorites-list');
const noFavoritesMessage = document.getElementById('no-favorites-message');
const recipeDetailView = document.getElementById('recipe-detail-view');
const recipeListView = document.getElementById('recipe-list-view');

/**
 * Navigates back to the main recipe list view.
 */
export function showRecipeListView() {
    recipeDetailView.classList.add('hidden');
    recipeListView.classList.remove('hidden');
    recipeDetailView.innerHTML = '';
    renderRecipeList(recipes);
}

function createRecipeCard(recipe) {
    const isFavorite = favorites.includes(recipe.id);
    const card = document.createElement('div');
    card.className = "bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 cursor-pointer";
    card.dataset.recipeId = recipe.id;
    card.innerHTML = `
        <div class="p-6">
            <h3 class="text-xl font-semibold mb-2">${recipe.title}</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">${recipe.description}</p>
            <div class="flex justify-between items-center">
                 <button class="view-btn text-indigo-600 dark:text-indigo-400 hover:underline">View Recipe</button>
                 <button class="favorite-btn p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900" title="Add to favorites">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 ${isFavorite ? 'text-red-500 fill-current' : 'text-gray-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                 </button>
            </div>
        </div>
    `;
    card.querySelector('.view-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        viewRecipe(recipe.id);
    });
    card.addEventListener('click', () => viewRecipe(recipe.id));

    const favBtn = card.querySelector('.favorite-btn');
    favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (favorites.includes(recipe.id)) {
            removeRecipeFromFavorites(recipe.id);
        } else {
            addRecipeToFavorites(recipe.id);
        }
    });

    return card;
}

export function renderRecipeList(recipesToRender) {
    recipeList.innerHTML = '';
    if (recipesToRender.length === 0) {
         recipeList.innerHTML = `<p class="text-gray-500 dark:text-gray-400 col-span-full">No recipes found.</p>`;
    } else {
        recipesToRender.forEach(recipe => {
            const card = createRecipeCard(recipe);
            recipeList.appendChild(card);
        });
    }
}

export function renderRecipeDetail(recipe) {
    recipeDetailView.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 md:p-8">
            <div class="flex justify-between items-start mb-4">
                <div>
                   <h2 class="text-3xl font-bold mb-2">${recipe.title}</h2>
                   <p class="text-gray-600 dark:text-gray-400">${recipe.description}</p>
                </div>
                <button id="back-btn" class="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Back
                </button>
            </div>
            
            <div class="my-6">
                <h3 class="text-2xl font-semibold mb-3">Ingredients</h3>
                <ul class="list-disc list-inside space-y-2 pl-2 text-gray-700 dark:text-gray-300">
                    ${recipe.ingredients.map(ing => `<li>${ing}</li>`).join('')}
                </ul>
            </div>
            
            <div>
                <h3 class="text-2xl font-semibold mb-3">Instructions</h3>
                <ol class="list-decimal list-inside space-y-3 pl-2 text-gray-700 dark:text-gray-300 leading-relaxed">
                    ${recipe.instructions.map(step => `<li>${step}</li>`).join('')}
                </ol>
            </div>
        </div>
    `;
    document.getElementById('back-btn').addEventListener('click', showRecipeListView);
}

export function renderFavorites() {
    favoritesList.innerHTML = '';
    const favoriteRecipes = recipes.filter(r => favorites.includes(r.id));
    if (favoriteRecipes.length === 0) {
        noFavoritesMessage.classList.remove('hidden');
    } else {
        noFavoritesMessage.classList.add('hidden');
        favoriteRecipes.forEach(recipe => {
            const card = createRecipeCard(recipe);
            favoritesList.appendChild(card);
        });
    }
}

function rerenderLists() {
    renderRecipeList(recipes);
    renderFavorites();
}

function addRecipeToFavorites(recipeId) {
    addFavorite(recipeId);
    rerenderLists();
    console.log(`Added recipe ${recipeId} to favorites.`);
}

function removeRecipeFromFavorites(recipeId) {
    removeFavorite(recipeId);
    rerenderLists();
    console.log(`Removed recipe ${recipeId} from favorites.`);
}

export function viewRecipe(recipeId) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (recipe) {
        renderRecipeDetail(recipe);
        recipeListView.classList.add('hidden');
        recipeDetailView.classList.remove('hidden');
        window.scrollTo(0, 0);
        console.log(`Viewing recipe: ${recipe.title}`);
    } else {
        console.error(`Recipe with ID ${recipeId} not found.`);
    }
}
