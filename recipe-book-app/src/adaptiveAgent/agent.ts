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

import {getGeminiClientConfig} from './config/agentConfig';
import {GeminiClient} from './gemini/geminiClient';
import {CaptionsService} from './services/captionsService';
import {EarconService} from './services/earconService';
import {SpeechToTextService} from './services/speechToTextService';
import {TextToSpeechService} from './services/textToSpeechService';
import {
  getState,
  onStateChange,
  resetState,
  State,
  updateState,
} from './state/state';

// Import CSS
import './agent.css';

// --- Type Definitions ---
export interface Shortcut {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

// --- Constants ---
const AGENT_BUTTON_ID = 'adaptive-agent-toggle-button';
const MIC_BUTTON_ID = 'adaptive-agent-mic-button';
const GREETING_MESSAGE = 'Hello! Ready to help.';
const MIC_RELEASE_DELAY_MS = 2000;

// --- Module Scope Variables ---
let captionsService: CaptionsService;
let earconService: EarconService;
let sttService: SpeechToTextService;
let ttsService: TextToSpeechService;

let stateUnsubscribe: (() => void) | null = null;
let keydownListener: ((e: KeyboardEvent) => void) | null = null;
let keyupListener: ((e: KeyboardEvent) => void) | null = null;

let micStopTimeoutId: number | null = null;
let agentApiKey: string | null = null;
let agentModelName: string | undefined;
let shortcuts: {
  toggleAgent: Shortcut;
  toggleMic: Shortcut;
};

// --- Initialization ---

/**
 * Options for initializing the Adaptive Agent.
 */
export interface AgentInitOptions {
  /** CSS selector for the element where agent buttons should be appended. */
  targetElementSelector: string;
  /** Your Gemini API Key. WARNING: Exposing this in frontend code is insecure for production. */
  apiKey: string;
  /** Optional: Language code for STT and TTS (e.g., 'en-US', 'en-GB'). Defaults to 'en-US'. */
  language?: string;
  /** Optional: The name of the Gemini model to use. Defaults to 'gemini-2.5-flash'. */
  modelName?: string;
  /** Optional: Initial user preferences for the agent config. */
  userPreferences?: Record<string, string>;
  /** Optional: Text for the agent button. Defaults to 'Enable Agent'. */
  agentButtonText?: string;
  /** Optional: Custom keyboard shortcuts for agent actions. */
  shortcuts?: {
    toggleAgent?: Shortcut;
    toggleMic?: Shortcut;
  };
}

/**
 * Initializes the Adaptive Agent, sets up services, creates UI buttons,
 * and attaches necessary event listeners.
 * @param options Configuration options for the agent.
 */
export function initializeAgent(options: AgentInitOptions): boolean {
  console.log('Initializing Adaptive Agent...');

  if (!options.targetElementSelector || !options.apiKey) {
    console.error(
      'Agent Initialization Failed: Missing targetElementSelector or apiKey.',
    );
    updateState({
      isSupported: false,
      lastError: 'Initialization options missing.',
    });
    return false;
  }

  const targetElement = document.querySelector(options.targetElementSelector);
  if (!targetElement) {
    console.error(
      `Agent Initialization Failed: Target element "${options.targetElementSelector}" not found.`,
    );
    updateState({isSupported: false, lastError: 'Target element not found.'});
    return false;
  }

  // Define default shortcuts and merge with provided options
  shortcuts = {
    toggleAgent: options.shortcuts?.toggleAgent ?? {key: 'Enter'},
    toggleMic: options.shortcuts?.toggleMic ?? {key: 'A'},
  };

  // Instantiate services
  captionsService = new CaptionsService();
  earconService = new EarconService();
  sttService = new SpeechToTextService(options.language || 'en-US');
  ttsService = new TextToSpeechService(); // Uses internal default lang logic

  // Check basic support
  if (!sttService.isSupported() || !ttsService.isSupported()) {
    console.error(
      'Agent Initialization Failed: Speech Recognition or Synthesis not supported.',
    );
    updateState({
      isSupported: false,
      lastError: 'Browser does not support required Speech APIs.',
    });
    return false;
  }

  // Start loading TTS voices (don't await, let it happen in background)
  ttsService
    .initialize()
    .then(() => console.log('TTS voices initialized.'))
    .catch((err) => {
      console.error('TTS voice initialization failed:', err);
      updateState({isSupported: false, lastError: `TTS init failed: ${err}`});
    });

  // Create and inject buttons
  const agentButton = _createAgentButton(
    options.agentButtonText || 'Enable Agent',
    shortcuts.toggleAgent,
  );
  const micButton = _createMicButton(shortcuts.toggleMic);
  targetElement.appendChild(agentButton);
  targetElement.appendChild(micButton);

  // Initial state update
  updateState({
    isSupported: true,
    agentButtonElement: agentButton,
    micButtonElement: micButton,
    lastError: null,
  });

  // Subscribe to state changes to update UI
  stateUnsubscribe = onStateChange(_handleStateChange);

  // Add global keyboard listeners
  _setupKeyboardListeners();

  agentApiKey = options.apiKey;
  agentModelName = options.modelName;

  console.log('Adaptive Agent Initialized Successfully.');
  return true; // Indicate successful initialization setup
}

/**
 * Cleans up agent resources, removes listeners and buttons.
 */
export function destroyAgent(): void {
  console.log('Destroying Adaptive Agent...');
  // Stop any ongoing processes
  ttsService?.stop();
  sttService?.abort();
  earconService?.stopAllSounds();

  // Reset state which should trigger UI updates via subscription
  resetState(); // Reset state variables including client/button refs

  // Unsubscribe from state changes
  stateUnsubscribe?.();
  stateUnsubscribe = null;

  // Remove global listeners
  if (keydownListener) document.removeEventListener('keydown', keydownListener);
  if (keyupListener) document.removeEventListener('keyup', keyupListener);
  keydownListener = null;
  keyupListener = null;
  if (micStopTimeoutId) clearTimeout(micStopTimeoutId);

  // Remove buttons from DOM
  document.getElementById(AGENT_BUTTON_ID)?.remove();
  document.getElementById(MIC_BUTTON_ID)?.remove();

  // Clean up services
  ttsService?.destroy();
  sttService?.destroy();
  earconService?.destroy();
  // Gemini client is cleaned up during disable toggle or state reset

  console.log('Adaptive Agent Destroyed.');
}

// --- Button Creation ---

function _createAgentButton(
  agentButtonText: string,
  shortcut: Shortcut,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = AGENT_BUTTON_ID;
  button.textContent = agentButtonText;
  const shortcutText = _formatShortcut(shortcut);
  button.title = `Toggle Agent (Shortcut: ${shortcutText})`;
  button.setAttribute('aria-label', `Toggle Agent (Shortcut: ${shortcutText})`);
  button.addEventListener('click', _handleAgentToggleClick);
  // Add basic styling or classes for user styling
  button.style.marginRight = '5px';
  return button;
}

function _createMicButton(shortcut: Shortcut): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = MIC_BUTTON_ID;
  // Initial icon/text
  button.innerHTML = `<img src="https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/mic_off/default/24px.svg" alt="Microphone Off" />`;
  const shortcutText = _formatShortcut(shortcut);
  button.title = `Hold to Talk (Shortcut: Hold ${shortcutText})`;
  button.setAttribute(
    'aria-label',
    `Activate Microphone (Shortcut: Hold ${shortcutText})`,
  );
  button.disabled = true; // Disabled initially

  // Mouse/Touch interaction
  button.addEventListener('mousedown', _handleMicPress);
  button.addEventListener('mouseup', _handleMicRelease);
  button.addEventListener('mouseleave', _handleMicRelease); // Stop if mouse leaves button while pressed
  button.addEventListener('touchstart', _handleMicPress, {passive: false});
  button.addEventListener('touchend', _handleMicRelease);
  button.addEventListener('touchcancel', _handleMicRelease);

  return button;
}

// --- Event Handlers ---

function _handleStateChange(newState: Readonly<State>): void {
  // Update Agent Button
  if (newState.agentButtonElement) {
    newState.agentButtonElement.textContent = newState.isAgentEnabled
      ? 'Disable Agent'
      : 'Enable Agent';

    // Clear existing classes and apply base styles.
    newState.agentButtonElement.className = '';
    newState.agentButtonElement.classList.add('adaptive-agent-toggle-button');

    // Add the gradient class if the agent is enabled
    if (newState.isAgentEnabled) {
      newState.agentButtonElement.classList.add('gradient');
    }
  }

  // Update Mic Button
  if (newState.micButtonElement) {
    newState.micButtonElement.disabled = !newState.isAgentEnabled;
    // Update appearance based on mic state
    newState.micButtonElement.style.opacity = newState.isAgentEnabled
      ? '1'
      : '0.5';
    newState.micButtonElement.style.border = newState.isMicOpen
      ? '2px solid red'
      : '1px solid black'; // Example visual cue
    newState.micButtonElement.innerHTML = newState.isMicOpen
      ? `<img src="https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/mic/default/24px.svg" alt="Microphone On" />`
      : `<img src="https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/mic_off/default/24px.svg" alt="Microphone Off" />`; // Example visual cue
  }

  // Update based on thinking state (e.g., visual cue on agent button)
  if (newState.agentButtonElement) {
    newState.agentButtonElement.style.fontStyle = newState.isAgentThinking
      ? 'italic'
      : 'normal';
  }

  // Potentially display newState.lastError somewhere
}

async function _handleAgentToggleClick(): Promise<void> {
  const {isAgentEnabled, geminiClient} = getState();

  if (!isAgentEnabled) {
    // --- Enabling Agent ---
    captionsService.showCaption('Initializing Agent...', 2000);
    earconService.playEnableEarcon();

    // --- Enabling Agent ---
    captionsService.showCaption('Initializing Agent...', 2000);
    earconService.playEnableEarcon();

    const apiKey = agentApiKey;
    if (!apiKey) {
      console.error('API Key not found for Gemini Client initialization.');
      updateState({lastError: 'API Key missing.'});
      captionsService.showCaption('Error: API Key missing', 3000);
      earconService.playErrorEarcon();
      return;
    }

    try {
      // TODO: Get actual user preferences if available
      const config = getGeminiClientConfig(apiKey, {}, agentModelName);
      const client = new GeminiClient(config);

      // Subscribe to Gemini events BEFORE initializing chat
      client.on('thinking', _handleGeminiThinking);
      client.on('responseComplete', _handleGeminiResponse);
      client.on('error', _handleGeminiError);
      // Add listeners for function calls if needed for UI feedback

      client.initializeChat();

      // Update state AFTER successful initialization
      updateState({
        isAgentEnabled: true,
        geminiClient: client,
        lastError: null,
      });

      // Speak greeting after state update allows mic button to potentially enable
      await ttsService.speak(GREETING_MESSAGE);
    } catch (error) {
      console.error('Failed to initialize Gemini Client:', error);
      updateState({lastError: `Gemini init failed: ${error}`});
      captionsService.showCaption(`Error: ${error}`, 5000);
      earconService.playErrorEarcon();
      updateState({isAgentEnabled: false, geminiClient: null}); // Ensure state reflects failure
    }
  } else {
    // --- Disabling Agent ---
    earconService.playDisableEarcon();
    ttsService.stop(); // Stop any ongoing speech
    if (sttService.getIsListening()) {
      sttService.abort(); // Abort listening if active
    }
    earconService.stopAllSounds(); // Stop thinking loop etc.

    // Clean up Gemini client and listeners
    geminiClient?.destroy(); // Removes listeners and cleans up

    // Update state
    updateState({
      isAgentEnabled: false,
      geminiClient: null,
      isMicOpen: false,
      isAgentSpeaking: false,
      isAgentThinking: false,
      lastError: null,
    });
    captionsService.removeCaption(); // Clear any leftover captions
  }
}

// --- Microphone Handling ---

function _handleMicPress(event: MouseEvent | TouchEvent): void {
  // Prevent default touch behavior like scrolling
  if (event.type === 'touchstart') {
    event.preventDefault();
  }

  const {isAgentEnabled, isMicOpen} = getState();
  if (!isAgentEnabled || isMicOpen) {
    return;
  }
  _startRecording();
}

function _handleMicRelease(): void {
  const {isAgentEnabled, isMicOpen} = getState();
  // Only stop if mic was actually open (prevents stopping if release happens after abort/error)
  if (isAgentEnabled && isMicOpen) {
    _stopRecording();
  }
  // Clear any pending keyboard delay timeout if mouse/touch release happens
  if (micStopTimeoutId) {
    clearTimeout(micStopTimeoutId);
    micStopTimeoutId = null;
  }
}

function _startRecording(): void {
  const {isAgentEnabled, isMicOpen} = getState();
  if (!isAgentEnabled || isMicOpen || !sttService) return;

  console.log('Starting recording...');
  earconService.playMicOnEarcon();
  ttsService.stop(); // Stop any current speech when mic is opened
  sttService.start();
  updateState({isMicOpen: true});
}

function _stopRecording(): void {
  const {isAgentEnabled, isMicOpen, geminiClient} = getState();
  if (!isAgentEnabled || !isMicOpen || !sttService) return;

  console.log('Stopping recording...');
  earconService.playMicOffEarcon();
  updateState({isMicOpen: false});

  sttService
    .stop()
    .then((transcript) => {
      console.log('Transcript:', transcript);
      if (transcript && geminiClient) {
        captionsService.showCaption(`You said: ${transcript}`, 15000);
        geminiClient.sendMessage(transcript);
      } else if (!transcript) {
        console.log('No speech detected or empty transcript.');
        captionsService.showCaption("Didn't catch that.", 10000);
      }
    })
    .catch((error) => {
      console.error('Speech recognition error:', error);
      // Don't update isMicOpen again, already set
      updateState({lastError: `STT Error: ${error}`});
      captionsService.showCaption(`Error: ${error}`, 10000);
      earconService.playErrorEarcon();
    });
}

// --- Keyboard Shortcut Handling ---

function _setupKeyboardListeners(): void {
  if (!shortcuts) return;

  const {toggleAgent, toggleMic} = shortcuts;

  keydownListener = (event: KeyboardEvent) => {
    // Stop TTS playback on Escape key
    if (event.key === 'Escape') {
      if (ttsService?.isSpeaking()) {
        event.preventDefault();
        ttsService.stop();
        captionsService.showCaption('Speech stopped', 1000);
      }
    }

    const matches = (shortcut: Shortcut) =>
      event.key.toLowerCase() === shortcut.key.toLowerCase() &&
      !!event.shiftKey === !!shortcut.shiftKey &&
      !!event.ctrlKey === !!shortcut.ctrlKey &&
      !!event.altKey === !!shortcut.altKey;

    // Agent Toggle
    if (matches(toggleAgent) && !event.repeat) {
      event.preventDefault();
      _handleAgentToggleClick();
    }

    // Microphone Hold (Keydown)
    if (matches(toggleMic) && !event.repeat) {
      const {isAgentEnabled, isMicOpen} = getState();
      if (isAgentEnabled && !isMicOpen) {
        event.preventDefault();
        if (micStopTimeoutId) {
          clearTimeout(micStopTimeoutId);
          micStopTimeoutId = null;
        }
        _startRecording();
      }
    }
  };

  keyupListener = (event: KeyboardEvent) => {
    const matches = (shortcut: Shortcut) =>
      event.key.toLowerCase() === shortcut.key.toLowerCase();

    // Microphone Hold (Keyup)
    if (matches(toggleMic)) {
      const {isAgentEnabled, isMicOpen} = getState();
      if (isAgentEnabled && isMicOpen) {
        event.preventDefault();
        if (micStopTimeoutId) clearTimeout(micStopTimeoutId);
        micStopTimeoutId = window.setTimeout(
          () => _stopRecording(),
          MIC_RELEASE_DELAY_MS,
        );
      }
    }
  };

  document.addEventListener('keydown', keydownListener);
  document.addEventListener('keyup', keyupListener);
}

/**
 * Formats a shortcut configuration into a user-friendly string.
 * @param shortcut The shortcut configuration object.
 * @returns A string representation (e.g., "Shift + G", "Enter").
 */
function _formatShortcut(shortcut: Shortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.altKey) parts.push('Alt');
  if (shortcut.shiftKey) parts.push('Shift');

  let keyName = shortcut.key;
  if (keyName === ' ') keyName = 'Space';
  else if (keyName.length > 1)
    keyName = keyName.charAt(0).toUpperCase() + keyName.slice(1);
  else keyName = keyName.toUpperCase();

  parts.push(keyName);
  return parts.join(' + ');
}

// --- Gemini Event Handlers ---

function _handleGeminiThinking(): void {
  console.log('Agent is thinking...');
  updateState({isAgentThinking: true});
  earconService.startThinkingLoop();
}

function _handleGeminiResponse(payload: {
  text: string | null;
  error?: any;
}): void {
  console.log('Agent response received.');
  earconService.stopThinkingLoop();
  updateState({isAgentThinking: false});

  if (payload.text) {
    captionsService.showCaption(`Agent: ${payload.text}`); // Keep caption until removed or replaced
    ttsService.speak(payload.text).catch((err) => {
      console.error('TTS Error:', err);
      updateState({lastError: `TTS failed: ${err}`});
      //captionsService.showCaption('Error: Could not speak response.', 6000);
    });
  } else if (payload.error) {
    // Handle cases where Gemini might return an error within the response payload
    _handleGeminiError({
      message: `Gemini response error: ${payload.error}`,
      details: payload.error,
    });
  } else {
    console.log(
      'Agent response was empty (e.g., after function call with no text).',
    );
    // Optionally remove caption or show a generic one like "OK."
    captionsService.removeCaption();
    earconService.playReadyEarcon();
  }
}

function _handleGeminiError(errorPayload: {
  message: string;
  details?: any;
}): void {
  console.error(
    'Gemini Client Error:',
    errorPayload.message,
    errorPayload.details,
  );
  earconService.stopThinkingLoop(); // Ensure thinking stops on error
  updateState({
    isAgentThinking: false,
    lastError: errorPayload.message,
  });
  earconService.playErrorEarcon();
  captionsService.showCaption(`Error: ${errorPayload.message}`, 6000);
}

// --- Placeholder for API Key Storage (Replace with secure method) ---
// This is highly insecure for production. Use environment variables
// during build or fetch from a secure backend endpoint.
(window as any).__AGENT_API_KEY__ = 'AIzaSyD2B9w-RiDaUwYtf59HGYjwU7eUB4gHDn0'; // Example: Set this before calling initializeAgent
