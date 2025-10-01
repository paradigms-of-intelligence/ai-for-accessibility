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

/**
 * Service for synthesizing speech from text using the browser's Web Speech API.
 * Manages voice loading, speaking state, and allows configuration of voice properties.
 */
export class TextToSpeechService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeakingFlag = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  private pitch = 1;
  private rate = 1;
  private volume = 1;
  private readonly targetVoiceNameUK = 'Google UK English Female';
  private readonly targetLangFallback = 'en-US';
  private readonly targetLangPrefix = 'en-';

  private voicesLoadedPromise: Promise<void>;
  private voicesLoadedResolver: (() => void) | null = null;
  private voicesLoadedRejecter: ((reason?: string) => void) | null = null;

  private speakPromiseResolver: (() => void) | null = null;
  private speakPromiseRejecter: ((reason?: string) => void) | null = null;

  constructor() {
    this.voicesLoadedPromise = new Promise<void>((resolve, reject) => {
      this.voicesLoadedResolver = resolve;
      this.voicesLoadedRejecter = reject; // Store rejecter
    });

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initialize();
    } else {
      console.error('Speech Synthesis API is not supported in this browser.');
      this.synth = null;
      this.voicesLoadedRejecter?.('Speech Synthesis not supported');
      this.voicesLoadedResolver = null;
      this.voicesLoadedRejecter = null;
    }
  }

  /**
   * Checks if the Speech Synthesis API is available.
   */
  isSupported(): boolean {
    return this.synth !== null;
  }

  /**
   * Initiates the loading of available speech synthesis voices.
   * It's recommended to call this early, perhaps after user interaction.
   * @returns A promise that resolves when voices are loaded, or rejects on error.
   */
  initialize(): Promise<void> {
    if (!this.isSupported()) {
      return Promise.reject('Speech Synthesis not supported.');
    }
    if (this.voices.length > 0 && !this.voicesLoadedResolver) {
      return Promise.resolve();
    }
    const boundLoadHandler = this._loadVoicesHandler.bind(this);
    this._loadVoicesHandler();
    this.synth!.onvoiceschanged = boundLoadHandler;
    // Add a timeout safeguard in case 'voiceschanged' never fires in some browsers
    const timeoutDuration = 5000;
    setTimeout(() => {
      if (this.voicesLoadedResolver) {
        console.warn(
          'Voice loading timed out. Proceeding with potentially empty voice list.',
        );
        this._selectDefaultVoice();
        this.voicesLoadedResolver();
        this.voicesLoadedResolver = null;
        this.voicesLoadedRejecter = null;
      }
    }, timeoutDuration);

    return this.voicesLoadedPromise;
  }

  /**
   * Handler for loading and selecting voices. Attached to onvoiceschanged.
   */
  private _loadVoicesHandler(): void {
    if (!this.synth) return;

    const loadedVoices = this.synth.getVoices();
    if (loadedVoices.length > 0) {
      this.voices = loadedVoices;
      console.log(`Loaded ${this.voices.length} voices.`);
      this._selectDefaultVoice();
      if (this.voicesLoadedResolver) {
        this.voicesLoadedResolver();
        this.voicesLoadedResolver = null;
        this.voicesLoadedRejecter = null;
      }
    } else {
      console.log('Waiting for voices to populate...');
    }
  }

  /**
   * Selects the default voice based on priority (UK Google Female -> US -> any English).
   */
  private _selectDefaultVoice(): void {
    let foundVoice: SpeechSynthesisVoice | null = null;
    foundVoice =
      this.voices.find((voice) => voice.name === this.targetVoiceNameUK) ||
      null;
    if (!foundVoice) {
      foundVoice =
        this.voices.find((voice) => voice.lang === this.targetLangFallback) ||
        null;
    }
    if (!foundVoice) {
      foundVoice =
        this.voices.find((voice) =>
          voice.lang.startsWith(this.targetLangPrefix),
        ) || null;
    }
    if (!foundVoice && this.voices.length > 0) {
      foundVoice = this.voices[0];
    }

    this.selectedVoice = foundVoice;

    if (this.selectedVoice) {
      console.log(
        `Selected voice: ${this.selectedVoice.name} (${this.selectedVoice.lang})`,
      );
    } else {
      console.warn('Could not find a suitable default voice.');
    }
  }

  /**
   * Speaks the given text using the selected voice and settings.
   * Waits for voices to be loaded if they haven't been already.
   * Stops any currently speaking utterance before starting the new one.
   * @param text The string of text to speak.
   * @returns A promise that resolves when speaking finishes, or rejects on error/stop.
   */
  async speak(text: string): Promise<void> {
    if (!this.isSupported()) {
      return Promise.reject('Speech Synthesis not supported.');
    }
    try {
      await this.voicesLoadedPromise;
    } catch (error) {
      return Promise.reject(`Failed to load voices: ${error}`);
    }
    if (this.isSpeakingFlag || this.synth!.pending) {
      console.log('Stopping previous speech before starting new one.');
      this.stop();
    }

    // Split the text into chunks to avoid exceeding the character limit
    const [chunks, unmatched] = this.splitByPunctuation(text);
    // For every chunk, speak it and wait for it to finish.
    for (const chunk of chunks) {
      await this._speak(chunk);
    }
    // If there is any unmatched text, speak it separately.
    if (unmatched.length > 0) {
      await this._speak(unmatched);
    }
  }

  /**
   * Stops the currently speaking utterance and clears the queue.
   * Rejects the promise associated with the stopped utterance.
   */
  stop(): void {
    if (!this.isSupported()) return;
    if (this.synth!.speaking || this.synth!.pending || this.isSpeakingFlag) {
      console.log('Stopping speech.');
      this._rejectPendingSpeakPromise('Speech interrupted by stop() call.');
      this.synth!.cancel();
      this.isSpeakingFlag = false;
      this.currentUtterance = null;
    }
  }

  private _speak(text: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.speakPromiseResolver = resolve;
      this.speakPromiseRejecter = reject;
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance = utterance;
        utterance.voice = this.selectedVoice;
        if (this.selectedVoice) {
          utterance.lang = this.selectedVoice.lang;
        }
        utterance.pitch = this.pitch;
        utterance.rate = this.rate;
        utterance.volume = this.volume;
        utterance.onstart = this._onUtteranceStart.bind(this);
        utterance.onend = this._onUtteranceEnd.bind(this);
        utterance.onerror = this._onUtteranceError.bind(this);
        this.isSpeakingFlag = false;
        this.synth!.speak(utterance);
      } catch (error) {
        console.error('Error initiating speech:', error);
        this._rejectPendingSpeakPromise(`${error}`); // Reject if speak fails immediately
      }
    });
  }

  /**
   * Checks if the service is currently speaking an utterance.
   * @returns True if speaking, false otherwise.
   */
  isSpeaking(): boolean {
    // Use internal flag managed by utterance events for better accuracy
    return this.isSpeakingFlag;
  }

  /** Sets the pitch for subsequent utterances (0 to 2). */
  setPitch(pitch: number): void {
    if (pitch >= 0 && pitch <= 2) {
      this.pitch = pitch;
    } else {
      console.warn('Pitch must be between 0 and 2.');
    }
  }

  /** Sets the rate for subsequent utterances (0.5 to 2.0). */
  setRate(rate: number): void {
    // Add reasonable caps, although spec allows 0.5-2.0
    const minRate = 0.5;
    const maxRate = 2.0;
    if (rate >= minRate && rate <= maxRate) {
      this.rate = rate;
    } else {
      console.warn(`Rate must be between ${minRate} and ${maxRate}.`);
    }
  }

  /** Sets the volume for subsequent utterances (0 to 1). */
  setVolume(volume: number): void {
    if (volume >= 0 && volume <= 1) {
      this.volume = volume;
    } else {
      console.warn('Volume must be between 0 and 1.');
    }
  }

  /**
   * Attempts to select a voice by its name. Requires voices to be loaded.
   * @param voiceName The exact name of the voice to select.
   * @returns True if the voice was found and selected, false otherwise.
   */
  setVoice(voiceName: string): boolean {
    if (this.voices.length === 0) {
      console.warn(
        'Cannot set voice: Voices not loaded yet. Call initialize() first.',
      );
      return false;
    }
    const voice = this.voices.find((v) => v.name === voiceName);
    if (voice) {
      this.selectedVoice = voice;
      console.log(`Voice set to: ${voice.name} (${voice.lang})`);
      return true;
    } else {
      console.warn(`Voice not found: ${voiceName}`);
      return false;
    }
  }

  /** Gets the list of available voices. Requires prior initialization. */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0) {
      console.warn(
        'Voice list is empty. Call initialize() and wait for it to complete.',
      );
    }
    return this.voices;
  }

  /** Gets the currently selected voice object. */
  getSelectedVoice(): SpeechSynthesisVoice | null {
    return this.selectedVoice;
  }

  private splitByPunctuation(text: string): [string[], string] {
    const regexString =
      '([^.!?;]*([.!?;,"*]|[.!?:;,]+|(d{1,3}(?:,d{3})*(?:.d+)?))+)';
    const regex = new RegExp(regexString, 'g');
    const chunks = text.match(regex);
    const matches = chunks ? chunks : [];
    const matchedString = matches?.join('');
    const unmatched = text.replace(matchedString, '');
    return [matches, unmatched];
  }

  // --- Private Utterance Event Handlers ---

  private _onUtteranceStart(): void {
    this.isSpeakingFlag = true;
  }

  private _onUtteranceEnd(): void {
    if (this.speakPromiseResolver) {
      this.isSpeakingFlag = false;
      this.speakPromiseResolver();
      this.speakPromiseResolver = null;
      this.speakPromiseRejecter = null;
      this.currentUtterance = null;
    } else {
      this.isSpeakingFlag = false;
      this.currentUtterance = null;
    }
  }

  private _onUtteranceError(event: SpeechSynthesisErrorEvent): void {
    console.error('Speech synthesis error:', event.error, event);
    if (this.speakPromiseRejecter) {
      this.isSpeakingFlag = false;
      this.speakPromiseRejecter(event.error);
      this.speakPromiseResolver = null;
      this.speakPromiseRejecter = null;
      this.currentUtterance = null;
    } else {
      this.isSpeakingFlag = false;
      this.currentUtterance = null;
    }
  }

  /** Safely rejects the pending promise from speak() and clears handlers */
  private _rejectPendingSpeakPromise(reason: string): void {
    if (this.speakPromiseRejecter) {
      this.speakPromiseRejecter(reason);
      this.speakPromiseResolver = null;
      this.speakPromiseRejecter = null;
    }
  }

  /**
   * Cleans up resources, stopping speech.
   */
  destroy(): void {
    if (!this.isSupported()) return;
    this.stop();
    this.synth!.onvoiceschanged = null;
    console.log('TextToSpeechService destroyed.');
  }
}
