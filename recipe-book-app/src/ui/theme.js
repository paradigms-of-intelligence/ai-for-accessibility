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

import { currentFontSize, setFontSize } from '../state/index.js';

const themeToggleBtn = document.getElementById('theme-toggle-btn');
const fontIncreaseBtn = document.getElementById('font-increase-btn');
const fontDecreaseBtn = document.getElementById('font-decrease-btn');

function updateThemeIcons(isDarkMode) {
    document.getElementById('theme-icon-sun').classList.toggle('hidden', isDarkMode);
    document.getElementById('theme-icon-moon').classList.toggle('hidden', !isDarkMode);
}

/**
 * Toggles the color theme between light and dark mode.
 */
export function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    const isDarkMode = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    updateThemeIcons(isDarkMode);
    console.log(`Theme changed to ${isDarkMode ? 'dark' : 'light'}`);
}

import { setFontSizeFactor } from '../api.js';

/**
 * Changes the base font size of the application.
 * @param {'increase' | 'decrease'} direction Whether to increase or decrease the font size.
 */
export function changeFontSize(direction) {
    const currentSize = currentFontSize;
    const step = 2; // pixels
    const factor = direction === 'increase' 
        ? (currentSize + step) / currentSize
        : (currentSize - step) / currentSize;
    
    if ((direction === 'increase' && currentSize < 24) || (direction === 'decrease' && currentSize > 12)) {
        setFontSizeFactor(factor);
    }
}

export function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.documentElement.classList.add('dark');
        updateThemeIcons(true);
    } else {
         updateThemeIcons(false);
    }

    themeToggleBtn.addEventListener('click', toggleTheme);
    fontIncreaseBtn.addEventListener('click', () => changeFontSize('increase'));
    fontDecreaseBtn.addEventListener('click', () => changeFontSize('decrease'));
}
