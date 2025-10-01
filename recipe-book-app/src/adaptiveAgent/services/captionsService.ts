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
 * A service to display draggable captions on the screen.
 * All styling and drag logic is self-contained.
 */
export class CaptionsService {
  private currentCaptionElement: HTMLDivElement | null = null;
  private currentCaptionTimeoutId: number | null = null;

  // --- Dragging State ---
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private initialLeft = 0;
  private initialTop = 0;

  // --- Persisted Position ---
  private persistedLeft: string | null = null;
  private persistedTop: string | null = null;

  // --- Bound Event Handlers ---
  // Binding ensures 'this' context is correct when handlers are called by the browser
  private _onMouseDownRef = this._onMouseDown.bind(this);
  private _onMouseMoveRef = this._onMouseMove.bind(this);
  private _onMouseUpRef = this._onMouseUp.bind(this);

  /**
   * Shows a draggable caption on the screen. Replaces any existing caption.
   * @param caption The text to display.
   * @param milliseconds The optional number of milliseconds to display the caption for.
   * If omitted, the caption stays until removeCaption() is called
   * or showCaption() is called again.
   */
  showCaption(caption: string, milliseconds?: number): void {
    this.removeCaption();

    const captionElement = document.createElement('div');
    captionElement.textContent = caption;
    this.currentCaptionElement = captionElement;

    const initialStyle: Partial<CSSStyleDeclaration> = {
      position: 'fixed',
      left: '50%',
      top: '5%',
      transform: 'translateX(-50%)',
      width: 'auto',
      maxWidth: '80%',
      height: 'auto',
      backgroundColor: 'rgba(17, 17, 17, 0.85)',
      color: 'white',
      textAlign: 'center',
      zIndex: '10001',
      padding: '10px 15px',
      borderRadius: '6px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
      fontSize: '18px',
      lineHeight: '1.4',
      cursor: 'move',
      userSelect: 'none',
      touchAction: 'none',
      transition: 'opacity 0.3s ease',
    };

    // Apply persisted position if available
    if (this.persistedLeft && this.persistedTop) {
      initialStyle.left = this.persistedLeft;
      initialStyle.top = this.persistedTop;
      initialStyle.transform = 'none'; // Remove translateX to respect specific left position
    }

    Object.assign(captionElement.style, initialStyle);

    captionElement.addEventListener('mousedown', this._onMouseDownRef);
    captionElement.addEventListener('touchstart', this._onMouseDownRef, {
      passive: false,
    });

    document.body.appendChild(captionElement);

    // Set removal timeout if specified
    if (milliseconds && milliseconds > 0) {
      this.currentCaptionTimeoutId = window.setTimeout(() => {
        // Check if the element still exists before trying to remove
        if (this.currentCaptionElement === captionElement) {
          this.removeCaption();
        }
      }, milliseconds);
    }
  }

  /**
   * Removes the currently displayed caption from the screen immediately.
   * Also cleans up any associated timeouts and event listeners.
   */
  removeCaption(): void {
    if (this.currentCaptionTimeoutId !== null) {
      clearTimeout(this.currentCaptionTimeoutId);
      this.currentCaptionTimeoutId = null;
    }

    this._removeDragListeners();

    if (this.currentCaptionElement) {
      this.currentCaptionElement.removeEventListener(
        'mousedown',
        this._onMouseDownRef,
      );
      this.currentCaptionElement.removeEventListener(
        'touchstart',
        this._onMouseDownRef,
      );

      if (this.currentCaptionElement.parentNode) {
        this.currentCaptionElement.parentNode.removeChild(
          this.currentCaptionElement,
        );
      }
      this.currentCaptionElement = null;
    }
    this.isDragging = false;
  }

  // --- Private Drag Handlers ---

  /**
   * Handles the mousedown/touchstart event on the caption element.
   * Initiates the dragging process.
   */
  private _onMouseDown(event: MouseEvent | TouchEvent): void {
    if (!this.currentCaptionElement) return;

    if (event.type === 'touchstart') {
      event.preventDefault();
    }

    this.isDragging = true;

    this.startX =
      event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    this.startY =
      event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

    const rect = this.currentCaptionElement.getBoundingClientRect();
    this.initialLeft = rect.left;
    this.initialTop = rect.top;

    this.currentCaptionElement.style.transform = 'none';
    this.currentCaptionElement.style.left = `${this.initialLeft}px`;
    this.currentCaptionElement.style.top = `${this.initialTop}px`;

    document.addEventListener('mousemove', this._onMouseMoveRef);
    document.addEventListener('mouseup', this._onMouseUpRef);
    document.addEventListener('touchmove', this._onMouseMoveRef, {
      passive: false,
    });
    document.addEventListener('touchend', this._onMouseUpRef);
    document.addEventListener('touchcancel', this._onMouseUpRef);
  }

  /**
   * Handles the mousemove/touchmove event on the document during a drag.
   * Updates the caption element's position.
   */
  private _onMouseMove(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging || !this.currentCaptionElement) return;

    // Prevent default only for touch to avoid interfering with scrolling if needed elsewhere
    if (event.type === 'touchmove') {
      event.preventDefault();
    }

    const currentX =
      event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    const currentY =
      event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

    const deltaX = currentX - this.startX;
    const deltaY = currentY - this.startY;

    const newLeft = this.initialLeft + deltaX;
    const newTop = this.initialTop + deltaY;

    this.currentCaptionElement.style.left = `${newLeft}px`;
    this.currentCaptionElement.style.top = `${newTop}px`;
  }

  /**
   * Handles the mouseup/touchend/touchcancel event on the document.
   * Stops the dragging process and cleans up listeners.
   */
  private _onMouseUp(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    this._removeDragListeners();

    // Persist the final position
    if (this.currentCaptionElement) {
      this.persistedLeft = this.currentCaptionElement.style.left;
      this.persistedTop = this.currentCaptionElement.style.top;
    }
  }

  /**
   * Helper method to remove document-level drag listeners.
   */
  private _removeDragListeners(): void {
    document.removeEventListener('mousemove', this._onMouseMoveRef);
    document.removeEventListener('mouseup', this._onMouseUpRef);
    document.removeEventListener('touchmove', this._onMouseMoveRef);
    document.removeEventListener('touchend', this._onMouseUpRef);
    document.removeEventListener('touchcancel', this._onMouseUpRef);
  }
}
