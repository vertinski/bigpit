// CharacterManager.js
import * as THREE from '/static/three.module.min.js';
import { CharacterBuilder } from './CharacterBuilder.js';
import { AnimationController } from './AnimationController.js';

export class CharacterManager {
  constructor(scene) {
    this.scene = scene;
    
    // Character parameters - default settings from character editor
    this.params = {
      height: 0.5,
      armLength: 0.4,
      legLength: 0.5,
      thickness: 0.2,
      torsoWidth: 1.2,
      blobbiness: 0.5,
      colors: {
        torso: '#007DFF',  // blue
        head: '#00FFFF',   // yellow
        arms: '#007DFF',   // red
        legs: '#007DFF'    // green
      }
    };
    
    // Animation state
    this.currentAnimation = 'run'; // Default to running
    this.animationEnabled = true;
    
    // Character components
    this.characterBuilder = null;
    this.animationController = null;
    this.character = null;
    this.clock = new THREE.Clock();
    
    // Movement direction for animation control
    this.movementDirection = new THREE.Vector3();
    this.isMoving = false;
    
    // Lighting state
    this.currentLightPosition = new THREE.Vector3(50, 80, 50);
    this.currentLightColor = new THREE.Color(0xffffaa);
    this.currentLightIntensity = 1.0;
    this.ambientColor = new THREE.Color(0x404040);
    this.ambientIntensity = 0.3;
    
    // Time controller for lighting updates - to throttle updates
    this.lastLightingUpdate = 0;
    this.lightingUpdateInterval = 100; // milliseconds
  }
  
  init() {
    // Initialize character builder
    this.characterBuilder = new CharacterBuilder(this.scene, this.params);
    
    // Create the character
    this.character = this.characterBuilder.createCharacter();
    
    // Scale the character to fit properly inside the physics sphere
    // Adjusted scale to ensure it's clearly visible but fits within the sphere
    this.character.scale.set(0.6, 0.6, 0.6);
    
    // Define the front face by rotating the entire character
    // In A-pose stick figure, the character is facing +Z by default
    // We'll rotate it to face -Z to align with camera's forward direction
    //this.character.rotation.y = Math.PI; // 180 degrees
    
    // Initialize animation controller
    this.animationController = new AnimationController(this.character, this.params);
    
    // Initialize lighting with default values
    this.updateLighting({
      lightPosition: this.currentLightPosition,
      lightColor: this.currentLightColor,
      lightIntensity: this.currentLightIntensity,
      ambientColor: this.ambientColor,
      ambientIntensity: this.ambientIntensity
    });
    
    return this.character;
  }
  
  // Method to update character lighting
  updateLighting(lightParams) {
    if (!this.characterBuilder) return;
    
    const now = performance.now();
    
    // Throttle lighting updates to avoid excessive shader recompilation
    if (now - this.lastLightingUpdate < this.lightingUpdateInterval) {
      return;
    }
    
    // Update stored lighting values if provided
    if (lightParams.lightPosition) this.currentLightPosition.copy(lightParams.lightPosition);
    if (lightParams.lightColor) this.currentLightColor.copy(lightParams.lightColor);
    if (lightParams.lightIntensity !== undefined) this.currentLightIntensity = lightParams.lightIntensity;
    if (lightParams.ambientColor) this.ambientColor.copy(lightParams.ambientColor);
    if (lightParams.ambientIntensity !== undefined) this.ambientIntensity = lightParams.ambientIntensity;
    
    // Pass lighting parameters to character builder
    this.characterBuilder.updateLighting({
      lightPosition: this.currentLightPosition,
      lightColor: this.currentLightColor,
      lightIntensity: this.currentLightIntensity,
      ambientColor: this.ambientColor,
      ambientIntensity: this.ambientIntensity
    });
    
    this.lastLightingUpdate = now;
  }
  
  // the update method
  update(dt, position, velocity, movementDirection, physicsState = null, lightParams = null) {
    if (!this.character || !this.animationController) return;
  
    // Update character position to follow physics body
    this.character.position.copy(position);

    const originalY = this.character.position.y;
  
    // Determine if the player is moving based on actual keyboard input
    this.isMoving = movementDirection.isMoving || false;
  
    // Determine animation based on physics state and movement
    let newAnimation = 'stand';
  
    // Check physics state first if provided
    if (physicsState) {
      if (physicsState.isJumping) {
        newAnimation = 'jump';
      } else if (this.isMoving) {
        newAnimation = 'run';
      }
    } else if (this.isMoving) {
      // Legacy code path for backward compatibility
      newAnimation = 'run';
    }
  
    // Check if animation state needs to change
    if (this.currentAnimation !== newAnimation) {
      this.currentAnimation = newAnimation;
    }
    
    // Rotate character based on camera direction
    if (movementDirection.lengthSq() > 0.01) {
      // Calculate the rotation angle based on movement direction
      // Adding PI because we initially rotated the character to face -Z (Math.PI)
      const angle = Math.atan2(movementDirection.x, movementDirection.z);
      
      // Use smooth rotation towards the target angle
      const currentAngle = this.character.rotation.y;
      let targetAngle = angle;
      
      // Calculate shortest path to target angle (handle wrapping)
      let angleDiff = targetAngle - currentAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      
      // Smooth rotation speed based on angle difference
      const rotationSpeed = 10;
      this.character.rotation.y = currentAngle + (angleDiff * Math.min(dt * rotationSpeed, 1));
    }
    
    // Update animation, passing physics state
    if (this.animationEnabled) {
      this.animationController.update(dt, this.currentAnimation, physicsState);
      const bounceOffset = this.animationController.getBounceOffset();
      this.character.position.y += bounceOffset;
    }
    
    // Update lighting if parameters are provided
    if (lightParams) {
      this.updateLighting(lightParams);
    }
  }
  
  setAnimation(animName) {
    this.currentAnimation = animName;
  }
  
  dispose() {
    if (this.character) {
      this.characterBuilder.removeCharacter();
      this.character = null;
    }
  }
}