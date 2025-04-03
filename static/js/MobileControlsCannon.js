import * as THREE from '/static/three.module.min.js';
import nipplejs from 'https://cdn.jsdelivr.net/npm/nipplejs@0.10.1/+esm';

/**
 * Manages mobile controls using nipplejs for joystick and a dedicated jump button.
 * Emits 'joystickMove', 'joystickEnd', and 'jumpPress' events.
 */
export class MobileControlsCannon extends THREE.EventDispatcher {
  constructor() {
    super();
    this.joystickManager = null;
    this.jumpButton = null;
    this.joystickData = { angle: 0, force: 0, active: false };

    // Bind methods
    this.handleJoystickMove = this.handleJoystickMove.bind(this);
    this.handleJoystickEnd = this.handleJoystickEnd.bind(this);
    this.handleJumpPress = this.handleJumpPress.bind(this);
  }

  /**
   * Initializes the mobile controls by creating the joystick and setting up the jump button.
   * @param {HTMLElement} joystickZone - The DOM element to contain the joystick.
   * @param {HTMLElement} jumpButtonElement - The DOM element for the jump button.
   */
  init(joystickZone, jumpButtonElement) {
    console.log("Initializing MobileControlsCannon...");
    if (!joystickZone || !jumpButtonElement) {
      console.error("MobileControlsCannon: Joystick zone or jump button element not provided.");
      return;
    }

    this.jumpButton = jumpButtonElement;

    // --- Joystick Setup ---
    const options = {
      zone: joystickZone,
      mode: 'static', // 'dynamic', 'semi', 'static'
      position: { left: '50%', top: '50%' },
      color: 'rgba(255, 255, 255, 0.5)',
      size: 150, // Adjust size as needed
      threshold: 0.1, // Minimum move distance to trigger events (deadzone)
      fadeTime: 250
    };

    this.joystickManager = nipplejs.create(options);
    this.joystickManager.on('move', this.handleJoystickMove);
    this.joystickManager.on('end', this.handleJoystickEnd);
    console.log("NippleJS joystick initialized.");

    // --- Jump Button Setup ---
    // Use 'touchstart' for better responsiveness on mobile
    this.jumpButton.addEventListener('touchstart', this.handleJumpPress, { passive: false });
    console.log("Jump button listener attached.");
  }

  handleJoystickMove(evt, data) {
    this.joystickData.angle = data.angle.radian; // Angle in radians
    this.joystickData.force = data.force; // Force (0 to 1, relative to joystick size)
    this.joystickData.active = true;
    // Clamp force to max 1
    this.joystickData.force = Math.min(this.joystickData.force, 1.0); 

    this.dispatchEvent({ type: 'joystickMove', data: this.joystickData });
  }

  handleJoystickEnd(evt, data) {
    this.joystickData.force = 0;
    this.joystickData.active = false;
    this.dispatchEvent({ type: 'joystickEnd' });
    this.dispatchEvent({ type: 'joystickMove', data: this.joystickData }); // Send final zero force
  }

  handleJumpPress(event) {
    event.preventDefault(); // Prevent potential double-triggering or other default actions
    console.log("Jump pressed");
    this.dispatchEvent({ type: 'jumpPress' });
  }

  /**
   * Removes event listeners and destroys the joystick manager.
   */
  destroy() {
    console.log("Destroying MobileControlsCannon...");
    if (this.joystickManager) {
      this.joystickManager.off('move', this.handleJoystickMove);
      this.joystickManager.off('end', this.handleJoystickEnd);
      this.joystickManager.destroy();
      this.joystickManager = null;
      console.log("NippleJS joystick destroyed.");
    }
    if (this.jumpButton) {
      this.jumpButton.removeEventListener('touchstart', this.handleJumpPress);
      this.jumpButton = null; // Remove reference
      console.log("Jump button listeners removed.");
    }
  }

  /**
   * Returns the current state of the joystick.
   * @returns {object} Object containing angle (radians), force (0-1), and active (boolean).
   */
  getJoystickData() {
    return this.joystickData;
  }
} 