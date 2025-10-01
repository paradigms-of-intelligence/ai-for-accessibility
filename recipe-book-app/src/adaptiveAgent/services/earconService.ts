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
 * Service for playing short audio cues (earcons) using the Web Audio API.
 * Ensures only one earcon plays at a time and manages the AudioContext.
 * All audio generation logic is self-contained.
 */
export class EarconService {
  private audioContext: AudioContext | null = null;
  private isPlayingFlag = false;
  private currentSources: Set<OscillatorNode> = new Set();
  private thinkingOscillator: OscillatorNode | null = null;

  private readonly defaultVolume = 0.15;
  private readonly defaultAttackTime = 0.01;
  private readonly defaultDecayTime = 0.1;
  private readonly thinkingFrequency = 100;
  private readonly thinkingVolume = 0.05;

  /**
   * Checks if any earcon or the thinking loop is currently playing.
   * @returns True if audio is playing, false otherwise.
   */
  isPlaying(): boolean {
    return this.isPlayingFlag;
  }

  /**
   * Stops all currently playing earcons and the thinking loop immediately.
   */
  stopAllSounds(): void {
    // Stop non-looping sounds
    this.currentSources.forEach((osc) => {
      try {
        osc.onended = null;
        osc.stop(0);
      } catch (e) {
        /* Ignore errors on stopping already stopped nodes */
      }
    });
    this.currentSources.clear();

    this.stopThinkingLoop();
    if (!this.thinkingOscillator && this.currentSources.size === 0) {
      this.isPlayingFlag = false;
    }
  }

  /**
   * Starts playing a subtle, looping "thinking" sound.
   * Stops any other earcon currently playing.
   * Does nothing if the thinking sound is already playing.
   */
  async startThinkingLoop(): Promise<void> {
    if (this.thinkingOscillator) {
      return;
    }
    this.stopAllSounds();
    const context = await this._getAudioContext();
    if (!context) return;
    this.isPlayingFlag = true;

    try {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(
        this.thinkingFrequency,
        context.currentTime,
      );
      gainNode.gain.setValueAtTime(this.thinkingVolume, context.currentTime);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.loop = true;
      oscillator.start(context.currentTime);

      this.thinkingOscillator = oscillator;
    } catch (error) {
      console.error('Error starting thinking loop:', error);
      this.isPlayingFlag = false;
    }
  }

  /**
   * Stops the looping "thinking" sound if it's playing.
   */
  stopThinkingLoop(): void {
    if (this.thinkingOscillator) {
      try {
        this.thinkingOscillator.stop(0);
      } catch (e) {
        /* Ignore errors */
      }
      this.thinkingOscillator = null;

      // Only set flag to false if no other sounds are tracked
      if (this.currentSources.size === 0) {
        this.isPlayingFlag = false;
      }
    }
  }

  // --- Specific Earcon Playback Methods ---

  /** Earcon: Assistant Enabled (Positive Confirmation) */
  async playEnableEarcon(): Promise<void> {
    await this._playTone(783.99, 0.15);
  }

  /** Earcon: Assistant Disabled (Neutral/Off Confirmation) */
  async playDisableEarcon(): Promise<void> {
    await this._playTone(523.25, 0.15);
  }

  /** Earcon: Microphone Enabled (Ready/Open) - Ascending */
  async playMicOnEarcon(): Promise<void> {
    await this._playToneSequence([
      {frequency: 523.25, duration: 0.08},
      {frequency: 659.25, duration: 0.08},
    ]);
  }

  /** Earcon: Microphone Disabled (Off/Closed) - Descending */
  async playMicOffEarcon(): Promise<void> {
    await this._playToneSequence([
      {frequency: 659.25, duration: 0.08},
      {frequency: 523.25, duration: 0.08},
    ]);
  }

  /** Earcon: Error Occurred (Dissonant/Warning) */
  async playErrorEarcon(): Promise<void> {
    await this._playToneSequence(
      [
        {frequency: 440.0, duration: 0.2},
        {frequency: 415.3, duration: 0.2},
      ],
      this.defaultVolume * 1.2,
    );
  }

  /** Earcon: Action Completed/Ready (Positive Notification) */
  async playReadyEarcon(): Promise<void> {
    await this._playToneSequence([
      {frequency: 523.25, duration: 0.08, pauseAfter: 0.01},
      {frequency: 783.99, duration: 0.08, pauseAfter: 0.01},
      {frequency: 1046.5, duration: 0.1},
    ]);
  }

  /**
   * Cleans up resources, stopping sounds and potentially closing the AudioContext.
   */
  destroy(): void {
    this.stopAllSounds();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext
        .close()
        .then(() => {
          console.log('AudioContext closed.');
          this.audioContext = null;
        })
        .catch((e) => console.error('Error closing AudioContext:', e));
    }
  }

  // --- Private Core Audio Methods ---

  /**
   * Initializes and returns the AudioContext, ensuring it's running.
   */
  private async _getAudioContext(): Promise<AudioContext | null> {
    if (!this.audioContext) {
      if (typeof window !== 'undefined' && window.AudioContext) {
        try {
          this.audioContext = new window.AudioContext();
        } catch (e) {
          console.error('Web Audio API context creation failed.', e);
          return null;
        }
      } else {
        console.error('Web Audio API is not supported.');
        return null;
      }
    }

    // Resume context if suspended (required by browser policies)
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (e) {
        console.error('Failed to resume AudioContext.', e);
        // Might still fail to play sounds
      }
    }
    return this.audioContext;
  }

  /**
   * Core function to play a single tone with envelope. Stops other sounds first.
   * @returns Promise resolving when the sound finishes playing.
   */
  private async _playTone(
    frequency: number,
    duration: number,
    volume: number = this.defaultVolume,
    type: OscillatorType = 'sine',
  ): Promise<void> {
    this.stopAllSounds();

    const context = await this._getAudioContext();
    if (!context) return Promise.resolve();

    return new Promise((resolve) => {
      try {
        const now = context.currentTime;
        const attackEndTime = now + this.defaultAttackTime;
        const decayStartTime = Math.max(
          attackEndTime,
          now + duration - this.defaultDecayTime,
        );
        const stopTime = now + duration;

        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(volume, attackEndTime);
        if (decayStartTime > attackEndTime) {
          gainNode.gain.setValueAtTime(volume, decayStartTime);
        }
        gainNode.gain.linearRampToValueAtTime(0, stopTime);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        this.currentSources.add(oscillator); // Track the source
        this.isPlayingFlag = true; // Set playing flag

        oscillator.onended = () => {
          this.currentSources.delete(oscillator); // Untrack
          // Only set flag to false if this was the last sound *and* thinking isn't playing
          if (this.currentSources.size === 0 && !this.thinkingOscillator) {
            this.isPlayingFlag = false;
          }
          resolve();
        };

        oscillator.start(now);
        oscillator.stop(stopTime);
      } catch (error) {
        console.error('Error playing tone:', error);
        // Ensure state is reset on error during setup
        if (this.currentSources.size === 0 && !this.thinkingOscillator) {
          this.isPlayingFlag = false;
        }
        resolve();
      }
    });
  }

  /**
   * Core function to play a sequence of tones. Stops other sounds first.
   * @returns Promise resolving when the entire sequence finishes playing.
   */
  private async _playToneSequence(
    tones: Array<{frequency: number; duration: number; pauseAfter?: number}>,
    volume: number = this.defaultVolume,
    type: OscillatorType = 'sine',
  ): Promise<void> {
    this.stopAllSounds();

    const context = await this._getAudioContext();
    if (!context) return Promise.resolve();

    return new Promise(async (resolve) => {
      let sequenceOffset = 0;
      const sourcesInSequence = new Set<OscillatorNode>();

      try {
        this.isPlayingFlag = true;

        for (let i = 0; i < tones.length; i++) {
          const tone = tones[i];

          const now = context.currentTime;
          const startTime = now + sequenceOffset;
          const attackEndTime = startTime + this.defaultAttackTime;
          const decayEndTime = startTime + tone.duration;
          const decayStartTime = Math.max(
            attackEndTime,
            decayEndTime - this.defaultDecayTime,
          );

          const oscillator = context.createOscillator();
          const gainNode = context.createGain();

          oscillator.type = type;
          oscillator.frequency.setValueAtTime(tone.frequency, startTime);

          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(volume, attackEndTime);
          if (decayStartTime > attackEndTime) {
            gainNode.gain.setValueAtTime(volume, decayStartTime);
          }
          gainNode.gain.linearRampToValueAtTime(0, decayEndTime);

          oscillator.connect(gainNode);
          gainNode.connect(context.destination);

          this.currentSources.add(oscillator);
          sourcesInSequence.add(oscillator);

          oscillator.onended = () => {
            this.currentSources.delete(oscillator);
            sourcesInSequence.delete(oscillator);

            // If this was the last source in the sequence to finish
            if (sourcesInSequence.size === 0) {
              if (this.currentSources.size === 0 && !this.thinkingOscillator) {
                this.isPlayingFlag = false;
              }
              resolve();
            }
          };

          oscillator.start(startTime);
          oscillator.stop(decayEndTime);

          const pause = tone.pauseAfter ?? 0;
          sequenceOffset += tone.duration + pause;
        }
      } catch (error) {
        console.error('Error playing tone sequence:', error);
        // Cleanup sources added so far on error
        sourcesInSequence.forEach((osc) => this.currentSources.delete(osc));
        if (this.currentSources.size === 0 && !this.thinkingOscillator) {
          this.isPlayingFlag = false;
        }
        resolve(); // Resolve on error
      }
    });
  }
}
