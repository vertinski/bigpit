import * as THREE from '/static/three.module.min.js';
import * as CANNON from '/dist/cannon-es.js';


/**
 * Modified version of PointerLockControlsCannon to work with character implementation
 * - Movement controls now handled by Player class
 * - Focuses on camera rotation and positioning
 */
export class PointerLockControlsCannon extends THREE.EventDispatcher {
  constructor(camera, cannonBody) {
    super();
    
    this.enabled = false;
    this.isLocked = false;
    
    this.cannonBody = cannonBody;
    this.camera = camera;
    
    // Create objects to handle pitch and yaw rotations
    this.pitchObject = new THREE.Object3D();
    this.pitchObject.add(camera);
    
    this.yawObject = new THREE.Object3D();
    this.yawObject.position.y = 2; // Camera height offset
    this.yawObject.add(this.pitchObject);
    
    // Store quaternion for camera rotation
    this.quaternion = new THREE.Quaternion();
    
    // Velocity handling (though movement is managed by Player.js)
    this.velocity = this.cannonBody.velocity;
    
    // Input velocity - kept for direction calculation
    this.inputVelocity = new THREE.Vector3();
    this.euler = new THREE.Euler();
    
    // Custom events
    this.lockEvent = { type: 'lock' };
    this.unlockEvent = { type: 'unlock' };
    
    // Initialize event listeners
    this.connect();
  }
  
  onMouseMove = (event) => {
    if (!this.enabled) {
      return;
    }
    
    // Get mouse movement delta
    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
    
    // Fix for inverted horizontal controls - change the sign
    // Positive movementX should rotate the camera to the right (negative yaw)
    const mouseSensitivity = 0.001;
    
    // Apply the rotation based on mouse movement
    // For horizontal, we're removing the negative sign to fix inversion
    this.yawObject.rotation.y -= movementX * mouseSensitivity;
    this.pitchObject.rotation.x += movementY * mouseSensitivity;
    
    // Clamp vertical rotation to prevent flipping (less extreme to avoid looking straight up/down)
    this.pitchObject.rotation.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.pitchObject.rotation.x));
    console.log(this.pitchObject.rotation.x);
  }
  
  onPointerlockChange = () => {
    if (document.pointerLockElement) {
      this.dispatchEvent(this.lockEvent);
      this.isLocked = true;
    } else {
      this.dispatchEvent(this.unlockEvent);
      this.isLocked = false;
    }
  }
  
  onPointerlockError = () => {
    console.error('PointerLockControlsCannon: Unable to use Pointer Lock API');
  }
  
  connect() {
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerlockChange);
    document.addEventListener('pointerlockerror', this.onPointerlockError);
  }
  
  disconnect() {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerlockChange);
    document.removeEventListener('pointerlockerror', this.onPointerlockError);
  }
  
  dispose() {
    this.disconnect();
  }
  
  lock() {
    document.body.requestPointerLock();
  }
  
  unlock() {
    document.exitPointerLock();
  }
  
  getObject() {
    return this.yawObject;
  }
  
  getDirection() {
    const vector = new CANNON.Vec3(0, 0, -1);
    vector.applyQuaternion(this.quaternion);
    return vector;
  }
  
  update(delta, skipPositionUpdate = false) {
    if (this.enabled === false) {
      return;
    }
    
    // Update the quaternion used for direction calculations
    this.euler.x = this.pitchObject.rotation.x;
    this.euler.y = this.yawObject.rotation.y;
    this.euler.order = 'XYZ';
    this.quaternion.setFromEuler(this.euler);
    
    // Normalize quaternion to prevent drift
    this.quaternion.normalize();
    
    // Update camera position to follow the physics body - unless we're using 3rd person camera
    if (!skipPositionUpdate) {
      this.yawObject.position.copy(this.cannonBody.position);
    }
  }
  
  // Method to set camera position directly (for third person view)
  setCameraPosition(position) {
    if (this.yawObject) {
      this.yawObject.position.copy(position);
    }
  }
  
  // Get the camera's forward direction vector
  getDirection() {
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.quaternion);
    return direction;
  }
  
  // Get the yaw rotation (y-axis rotation)
  getYawRotation() {
    return this.yawObject.rotation.y;
  }
  
  // Get the pitch rotation (x-axis rotation)
  getPitchRotation() {
    return this.pitchObject.rotation.x;
  }
}