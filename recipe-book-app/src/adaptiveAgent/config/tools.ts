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
  FunctionDeclaration,
  FunctionDeclarationSchemaType as SchemaType,
} from '@google/generative-ai';
import {
  getRecipe,
  markAsFavorite,
  searchRecipes as searchRecipesAPI,
  setDarkMode,
  setFontSizeFactor,
} from '../../api';
import {recipes} from '../../data/recipes';
import {favorites} from '../../state';
import {
  renderFavorites,
  renderRecipeList,
  showRecipeListView,
  viewRecipe,
} from '../../ui/render';

// --- Tool Interfaces ---

export interface SearchRecipesArgs {
  query: string;
}

export interface ViewRecipeArgs {
  recipe_id: number;
}

export interface GetRecipeDetailsArgs {
  recipe_id: number;
}

export interface MarkAsFavoriteArgs {
  recipe_id: number;
  is_favorite: boolean;
}

export interface SetDarkModeArgs {
  enabled: boolean;
}

export interface SetFontSizeArgs {
  factor: number;
}

// --- Function Declarations ---

export const searchRecipesDeclaration: FunctionDeclaration = {
  name: 'search_recipes',
  description:
    'Searches for recipes based on a query string and displays the results.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description: 'The search term for recipes.',
      },
    },
    required: ['query'],
  },
};

export const viewRecipeDeclaration: FunctionDeclaration = {
  name: 'view_recipe',
  description: 'Displays the detailed view for a specific recipe by its ID.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      recipe_id: {
        type: SchemaType.NUMBER,
        description: 'The ID of the recipe to display.',
      },
    },
    required: ['recipe_id'],
  },
};

export const listRecipesDeclaration: FunctionDeclaration = {
  name: 'list_recipes',
  description:
    "Returns a list of the recipe titles and IDs currently visible in the main recipe list. Useful for getting context of what's on screen.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
  },
};

export const listFavoritesDeclaration: FunctionDeclaration = {
  name: 'list_favorites',
  description: "Returns a list of the user's favorite recipes.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
  },
};

export const getRecipeDetailsDeclaration: FunctionDeclaration = {
  name: 'get_recipe_details',
  description:
    "Retrieves the full details of a single recipe by its ID without changing the user's view. Useful for answering questions about a specific recipe.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      recipe_id: {
        type: SchemaType.NUMBER,
        description: 'The ID of the recipe to retrieve details for.',
      },
    },
    required: ['recipe_id'],
  },
};

export const markAsFavoriteDeclaration: FunctionDeclaration = {
  name: 'mark_as_favorite',
  description: 'Marks or unmarks a recipe as a favorite.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      recipe_id: {
        type: SchemaType.NUMBER,
        description: 'The ID of the recipe to mark or unmark.',
      },
      is_favorite: {
        type: SchemaType.BOOLEAN,
        description: 'Set to true to mark as favorite, false to unmark.',
      },
    },
    required: ['recipe_id', 'is_favorite'],
  },
};

export const setDarkModeDeclaration: FunctionDeclaration = {
  name: 'set_dark_mode',
  description: 'Enables or disables dark mode for the application UI.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      enabled: {
        type: SchemaType.BOOLEAN,
        description:
          'Set to true to enable dark mode, false to disable (use light mode).',
      },
    },
    required: ['enabled'],
  },
};

export const setFontSizeDeclaration: FunctionDeclaration = {
  name: 'set_font_size',
  description:
    'Adjusts the application font size by a multiplier. The factor should be between 0.5 (smaller) and 2.0 (larger). A factor of 1.1 would be a 10% increase.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      factor: {
        type: SchemaType.NUMBER,
        description:
          'The multiplication factor for the font size. E.g., 1.2 for a 20% increase.',
      },
    },
    required: ['factor'],
  },
};

export const goBackToListDeclaration: FunctionDeclaration = {
  name: 'go_back_to_list',
  description:
    'Navigates from the recipe detail view back to the main recipe list.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
  },
};

// --- Tool Implementations ---

export async function search_recipes(args: SearchRecipesArgs): Promise<string> {
  const results = searchRecipesAPI(args.query);
  renderRecipeList(results);
  (document.getElementById('search-input') as HTMLInputElement).value =
    args.query;
  return `Searched for "${args.query}" and found ${results.length} recipes.`;
}

export async function view_recipe(args: ViewRecipeArgs): Promise<string> {
  viewRecipe(args.recipe_id);
  return `Displaying details for recipe ID ${args.recipe_id}.`;
}

export async function list_recipes(): Promise<object | string> {
  const recipeElements = document.querySelectorAll('#recipe-list > div');
  if (recipeElements.length === 0) {
    return 'No recipes are currently listed on the screen.';
  }
  const recipeData = Array.from(recipeElements)
    .map((card) => {
      const id = (card as HTMLElement).dataset.recipeId;
      const title = card.querySelector('h3')?.textContent;
      if (id && title) {
        return {id: parseInt(id, 10), title};
      }
      return null;
    })
    .filter(Boolean); // Filter out any nulls if card structure is wrong

  return recipeData;
}

export async function list_favorites(): Promise<object> {
  const favoriteRecipes = recipes
    .filter((r) => favorites.includes(r.id))
    .map((r) => ({id: r.id, title: r.title}));
  return favoriteRecipes;
}

export async function get_recipe_details(
  args: GetRecipeDetailsArgs,
): Promise<object | string> {
  const recipe = getRecipe(args.recipe_id);
  if (!recipe) {
    return `Recipe with ID ${args.recipe_id} not found.`;
  }
  // Return a serializable subset of details to avoid overwhelming the context
  const {title, description, ingredients, food_country, keywords} = recipe;
  return {title, description, ingredients, food_country, keywords};
}

export async function mark_as_favorite(
  args: MarkAsFavoriteArgs,
): Promise<string> {
  markAsFavorite(args.recipe_id, args.is_favorite);
  // Re-render lists to reflect the change visually (e.g., heart icon)
  const currentSearch = (
    document.getElementById('search-input') as HTMLInputElement
  ).value;
  const recipesToRender = currentSearch
    ? searchRecipesAPI(currentSearch)
    : recipes;
  renderRecipeList(recipesToRender);
  renderFavorites();
  return `Recipe ${args.recipe_id} has been ${
    args.is_favorite ? 'added to' : 'removed from'
  } favorites.`;
}

export async function set_dark_mode(args: SetDarkModeArgs): Promise<string> {
  setDarkMode(args.enabled);
  return `Dark mode has been ${args.enabled ? 'enabled' : 'disabled'}.`;
}

export async function set_font_size(args: SetFontSizeArgs): Promise<string> {
  if (args.factor < 0.5 || args.factor > 2.0) {
    return 'Error: Font size factor must be between 0.5 and 2.0.';
  }
  setFontSizeFactor(args.factor);
  return `Font size adjusted by a factor of ${args.factor}.`;
}

export async function go_back_to_list(): Promise<string> {
  showRecipeListView();
  return 'Returned to the main recipe list view.';
}

// --- Tool Call Handler ---

export async function handleToolCall(
  functionName: string,
  args: any,
): Promise<string | object | null> {
  switch (functionName) {
    case 'search_recipes':
      return await search_recipes(args as SearchRecipesArgs);
    case 'view_recipe':
      return await view_recipe(args as ViewRecipeArgs);
    case 'list_recipes':
      return await list_recipes();
    case 'list_favorites':
      return await list_favorites();
    case 'get_recipe_details':
      return await get_recipe_details(args as GetRecipeDetailsArgs);
    case 'mark_as_favorite':
      return await mark_as_favorite(args as MarkAsFavoriteArgs);
    case 'set_dark_mode':
      return await set_dark_mode(args as SetDarkModeArgs);
    case 'set_font_size':
      return await set_font_size(args as SetFontSizeArgs);
    case 'go_back_to_list':
      return await go_back_to_list();
    default:
      console.error(`Error: Function ${functionName} not found.`);
      return `Error: Tool ${functionName} is not available.`;
  }
}

// --- Export All Declarations ---

export const functionDeclarations: FunctionDeclaration[] = [
  searchRecipesDeclaration,
  viewRecipeDeclaration,
  listRecipesDeclaration,
  listFavoritesDeclaration,
  getRecipeDetailsDeclaration,
  markAsFavoriteDeclaration,
  setDarkModeDeclaration,
  setFontSizeDeclaration,
  goBackToListDeclaration,
];
