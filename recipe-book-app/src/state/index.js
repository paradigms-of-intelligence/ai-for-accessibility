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

export let favorites = JSON.parse(localStorage.getItem('recipeFavorites')) || [];
export let currentFontSize = 16;

export function addFavorite(recipeId) {
    if (!favorites.includes(recipeId)) {
        favorites.push(recipeId);
        localStorage.setItem('recipeFavorites', JSON.stringify(favorites));
    }
}

export function removeFavorite(recipeId) {
    favorites = favorites.filter(id => id !== recipeId);
    localStorage.setItem('recipeFavorites', JSON.stringify(favorites));
}

export function setFontSize(size) {
    currentFontSize = size;
}
