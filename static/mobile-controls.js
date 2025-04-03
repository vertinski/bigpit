
// Mobile Controls Manager
// This file handles touch-based interaction for mobile devices

export class MobileControls {
  constructor(player, camera) {
    this.player = player;
    this.camera = camera;

    // Touch control elements
    this.runButton = document.getElementById('runButton');
    this.jumpIndicator = document.getElementById('jumpIndicator');

    // Touch state
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.touchMoved = false;
    this.lastTouchEnd = 0;
    this.isRunning = false;

    // Camera movement
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.movementX = 0;
    this.movementY = 0;

    // Input sensitivity settings
    this.lookSensitivity = 0.3;
    this.panThreshold = 5; // Minimum pixels moved before considering it a pan
    this.doubleTapThreshold = 300; // Maximum ms between taps to count as double-tap

    // Bind methods
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onRunButtonTouchStart = this.onRunButtonTouchStart.bind(this);
    this.onRunButtonTouchEnd = this.onRunButtonTouchEnd.bind(this);
  }

  init() {
    console.log("Initializing mobile controls");

    // Set up event listeners for the screen area (looking/jumping)
    document.addEventListener('touchstart', this.onTouchStart, { passive: false });
    document.addEventListener('touchmove', this.onTouchMove, { passive: false });
    document.addEventListener('touchend', this.onTouchEnd, { passive: false });

    // Set up event listeners for the run button
    if (this.runButton) {
      this.runButton.addEventListener('touchstart', this.onRunButtonTouchStart, { passive: false });
      this.runButton.addEventListener('touchend', this.onRunButtonTouchEnd, { passive: false });
    }
  }

  // Handle touch start events
  onTouchStart(event) {
    // Ignore touches on control elements
    if (event.target.id === 'runButton' || event.target.id === 'unmuteButton') {
      return;
    }

    // Prevent default to avoid scrolling/zooming
    event.preventDefault();

    // Reset touch tracking
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.lastTouchX = touch.clientX;
    this.lastTouchY = touch.clientY;
    this.touchStartTime = performance.now();
    this.touchMoved = false;

    // Check for double-tap (jump)
    const now = performance.now();
    const timeSinceLastTouch = now - this.lastTouchEnd;

    if (timeSinceLastTouch < this.doubleTapThreshold) {
      console.log("Double tap detected, jumping");
      this.player.jump();
      this.showJumpIndicator();
    }
  }

  // Handle touch move events
  onTouchMove(event) {
    // Ignore touches on control elements
    if (event.target.id === 'runButton' || event.target.id === 'unmuteButton') {
      return;
    }

    // Prevent default to avoid scrolling/zooming
    event.preventDefault();

    const touch = event.touches[0];

    // Calculate movement delta
    const deltaX = touch.clientX - this.lastTouchX;
    const deltaY = touch.clientY - this.lastTouchY;

    // Update last position
    this.lastTouchX = touch.clientX;
    this.lastTouchY = touch.clientY;

    // Check if the touch has moved enough to count as a pan
    const distanceMoved = Math.sqrt(
      Math.pow(touch.clientX - this.touchStartX, 2) + 
      Math.pow(touch.clientY - this.touchStartY, 2)
    );

    if (distanceMoved > this.panThreshold) {
      this.touchMoved = true;
    }

    // Apply camera rotation (only if player controls are enabled)
    if (this.player && this.player.controls && this.player.controls.enabled) {
      // Simulate mouse movement for camera rotation
      this.movementX = -deltaX * this.lookSensitivity;
      this.movementY = -deltaY * this.lookSensitivity;

      // Apply the rotation via the player controls
      if (this.player.controls.onTouchMove) {
        // Custom method on controls if available
        this.player.controls.onTouchMove({
          movementX: this.movementX,
          movementY: this.movementY
        });
      }
    }
  }

  // Handle touch end events
  onTouchEnd(event) {
    // Ignore touches on control elements
    if (event.target.id === 'runButton' || event.target.id === 'unmuteButton') {
      return;
    }

    // Prevent default
    event.preventDefault();

    // Store timestamp for double-tap detection
    this.lastTouchEnd = performance.now();

    // If the touch didn't move much and was quick, it's a tap
    const touchDuration = performance.now() - this.touchStartTime;

    if (!this.touchMoved && touchDuration < 300) {
      // Single tap - could be used for an action
      console.log("Single tap detected");
    }
  }

  // Run button touch handlers
  onRunButtonTouchStart(event) {
    event.preventDefault();
    this.isRunning = true;
    this.runButton.classList.add('active');

    if (this.player) {
      this.player.moveForward = true;
    }
  }

  onRunButtonTouchEnd(event) {
    event.preventDefault();
    this.isRunning = false;
    this.runButton.classList.remove('active');

    if (this.player) {
      this.player.moveForward = false;
    }
  }

  // Visual feedback for jump
  showJumpIndicator() {
    if (this.jumpIndicator) {
      this.jumpIndicator.style.opacity = '1';
      setTimeout(() => {
        this.jumpIndicator.style.opacity = '0';
      }, 500);
    }
  }

  // Update method for animation loop
  update() {
    // This method is called from the main animation loop
    // Currently just a placeholder for future state updates
    // No implementation needed for basic functionality
  }

  // Cleanup
  dispose() {
    document.removeEventListener('touchstart', this.onTouchStart);
    document.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);

    if (this.runButton) {
      this.runButton.removeEventListener('touchstart', this.onRunButtonTouchStart);
      this.runButton.removeEventListener('touchend', this.onRunButtonTouchEnd);
    }
  }
}

// Helper function for external setup - properly exported
export function setupMobileControls(player, camera) {
  if (!player || !camera) {
    console.error("Cannot set up mobile controls - missing player or camera");
    return null;
  }

  const controls = new MobileControls(player, camera);
  controls.init(); // Initialize controls when created
  return controls;
}
