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

import EventEmitter from 'eventemitter3';
import { GeminiClient } from '../gemini/geminiClient'; // Adjust the import path as necessary

/**
 * Defines the structure for the application's shared state.
 * (Interface definition remains the same)
 */
export interface State {
  isSupported: boolean;
  isAgentEnabled: boolean;
  isMicOpen: boolean;
  isAgentSpeaking: boolean;
  isAgentThinking: boolean;
  geminiClient: GeminiClient | null;
  agentButtonElement: HTMLButtonElement | null;
  micButtonElement: HTMLButtonElement | null;
  lastError: string | null;
}

/**
 * Defines the initial default values for the application state.
 * (Default state definition remains the same)
 */
const _defaultState: State = Object.freeze({
  isSupported: false,
  isAgentEnabled: false,
  isMicOpen: false,
  isAgentSpeaking: false,
  isAgentThinking: false,
  geminiClient: null,
  agentButtonElement: null,
  micButtonElement: null,
  lastError: null,
});

/**
 * Internal variable holding the current, mutable state.
 */
let _state: State = { ..._defaultState };

/**
 * Event emitter for state changes.
 * Other modules can subscribe to the 'stateChanged' event.
 */
const stateEmitter = new EventEmitter();

/**
 * Type definition for the state change listener function.
 */
export type StateChangeListener = (newState: Readonly<State>) => void;

// --- Exported State Management Functions ---

/**
 * Retrieves a read-only snapshot of the current application state.
 * @returns A readonly copy of the current State object.
 */
export function getState(): Readonly<State> {
  return { ..._state };
}

/**
 * Updates the application state by merging the provided partial state object
 * and notifies listeners about the change.
 *
 * @param updates - An object containing the state properties to update.
 */
export function updateState(updates: Partial<State>): void {
  const previousState = { ..._state }; // Keep previous state for potential comparison
  _state = { ..._state, ...updates };

  // Check if the state actually changed (optional, prevents unnecessary emits)
  // This requires a shallow comparison or deep comparison if needed
  let hasChanged = false;
  for (const key in updates) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
          if (previousState[key as keyof State] !== _state[key as keyof State]) {
              hasChanged = true;
              break;
          }
      }
  }

  // Notify listeners only if the state has effectively changed
  if (hasChanged) {
      // console.log('State updated:', getState()); // Optional debugging
      // Emit the 'stateChanged' event with the new state object
      stateEmitter.emit('stateChanged', getState());
  }
}

/**
 * Resets the application state back to its initial default values
 * and notifies listeners.
 */
export function resetState(): void {
    const previousState = { ..._state }; // Keep previous state
    _state = { ..._defaultState };

    // Check if the state actually changed from the previous state before reset
    let hasChanged = false;
    for (const key in _state) {
        if (previousState[key as keyof State] !== _state[key as keyof State]) {
            hasChanged = true;
            break;
        }
    }

    if (hasChanged) {
        console.log('State reset to default.');
        // Emit the 'stateChanged' event with the new (default) state object
        stateEmitter.emit('stateChanged', getState());
    }
}

/**
 * Subscribes a listener function to state changes.
 * The listener will be called whenever the state is updated via updateState or resetState.
 *
 * @param listener - The function to call with the new state object when changes occur.
 * @returns A function to unsubscribe the listener. Call this function to stop receiving updates.
 */
export function onStateChange(listener: StateChangeListener): () => void {
  // Register the listener for the 'stateChanged' event
  stateEmitter.on('stateChanged', listener);

  // Return an unsubscribe function
  return () => {
    stateEmitter.off('stateChanged', listener);
  };
}

// Optional: Export default state if needed elsewhere
// export const defaultStateValues = _defaultState;