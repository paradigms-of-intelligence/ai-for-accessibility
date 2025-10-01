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
 * Service for converting speech to text using the browser's Web Speech API.
 * Manages the microphone access and recognition lifecycle.
 */
export class SpeechToTextService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private finalTranscript = '';
  // Stores the resolve/reject functions for the promise returned by stop()
  private stopPromiseResolver: ((transcript: string) => void) | null = null;
  private stopPromiseRejecter: ((reason?: string | Error) => void) | null =
    null;

  // Optional: For emitting events (e.g., for live feedback)
  // You could integrate EventEmitter3 here as well if needed
  // public events = new EventEmitter(); // Example

  constructor(lang = 'en-US') {
    // Allow language configuration
    // Check for browser support (including vendor prefix)
    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error('Speech Recognition API is not supported in this browser.');
      this.recognition = null;
      return;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = lang;

      // Bind event handlers
      this.recognition.onstart = this._onStart.bind(this);
      this.recognition.onresult = this._onResult.bind(this);
      this.recognition.onerror = this._onError.bind(this);
      this.recognition.onend = this._onEnd.bind(this);
    } catch (error) {
      console.error('Failed to initialize SpeechRecognition:', error);
      this.recognition = null;
    }
  }

  /**
   * Checks if the Speech Recognition API is available and initialized.
   */
  isSupported(): boolean {
    return this.recognition !== null;
  }

  /**
   * Checks if the service is currently listening.
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * Starts listening to the microphone and recognizing speech.
   * Requires microphone permission from the user on the first call.
   */
  start(): void {
    if (!this.recognition) {
      console.warn('SpeechRecognition not supported or initialized.');
      return;
    }
    if (this.isListening) {
      console.warn('Speech recognition is already active.');
      return;
    }

    // Reset previous transcript
    this.finalTranscript = '';
    // Ensure any dangling promises are rejected if start is called again
    this._rejectPendingStopPromise(
      'New recognition started before previous stop completed.',
    );

    try {
      this.recognition.start();
      console.log('Speech recognition starting...');
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      this._onError(
        new SpeechRecognitionErrorEvent('error', {
          error: 'start-failed',
          message: String(error),
        }),
      );
    }
  }

  /**
   * Stops listening to the microphone and attempts to finalize the recognition.
   * @returns A Promise that resolves with the final transcript, or rejects on error/abort.
   */
  stop(): Promise<string> {
    if (!this.recognition) {
      console.warn('SpeechRecognition not supported or initialized.');
      return Promise.reject('SpeechRecognition not supported.');
    }
    if (!this.isListening) {
      console.warn('Speech recognition is not currently active.');
      return Promise.resolve(this.finalTranscript);
    }

    // Create a promise that will be resolved/rejected by the event handlers
    return new Promise<string>((resolve, reject) => {
      this.stopPromiseResolver = resolve;
      this.stopPromiseRejecter = reject;

      try {
        this.recognition.stop();
        console.log('Speech recognition stopping...');
        // Note: Actual stopping and promise resolution happens in onend
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
        this._rejectPendingStopPromise(error);
      }
    });
  }

  /**
   * Aborts the speech recognition process immediately.
   * Discards any results and rejects the promise returned by stop().
   */
  abort(): void {
    if (!this.recognition) {
      console.warn('SpeechRecognition not supported or initialized.');
      return;
    }
    if (!this.isListening) {
      console.warn('Speech recognition is not currently active.');
      return;
    }

    try {
      this.recognition.abort();
      console.log('Speech recognition aborted.');
      this._rejectPendingStopPromise('Recognition aborted by user.');
    } catch (error) {
      console.error('Error aborting speech recognition:', error);
      this._rejectPendingStopPromise(error);
    }
  }

  // --- Private Event Handlers ---

  private _onStart(): void {
    this.isListening = true;
    console.log('Speech recognition started successfully.');
  }

  private _onResult(event: SpeechRecognitionEvent): void {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        const finalChunk = event.results[i][0].transcript.trim();
        this.finalTranscript += finalChunk + ' ';
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    this.events.emit('interimResult', interim);
  }

  private _onError(event: SpeechRecognitionErrorEvent): void {
    console.error('Speech recognition error:', event.error, event.message);
    this.isListening = false;
    this._rejectPendingStopPromise(event.error);
    this.events.emit('error', event.error);
  }

  private _onEnd(): void {
    console.log('Speech recognition ended.');
    this.isListening = false;

    if (this.stopPromiseResolver) {
      this.stopPromiseResolver(this.finalTranscript.trim());
    } else if (this.stopPromiseRejecter) {
      this.stopPromiseRejecter(
        'Recognition ended unexpectedly after stop() call.',
      );
    }
    this.stopPromiseResolver = null;
    this.stopPromiseRejecter = null;
  }

  /** Safely rejects the pending promise from stop() and clears handlers */
  private _rejectPendingStopPromise(reason: string | Error): void {
    if (this.stopPromiseRejecter) {
      this.stopPromiseRejecter(reason);
      this.stopPromiseResolver = null;
      this.stopPromiseRejecter = null;
    }
  }

  /**
   * Cleans up the recognition instance if needed.
   */
  destroy(): void {
    if (this.recognition) {
      if (this.isListening) {
        this.recognition.abort();
      }
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition = null;
      console.log('SpeechToTextService destroyed.');
    }
    this._rejectPendingStopPromise('Service destroyed');
  }
}
