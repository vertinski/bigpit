import * as THREE from '/static/three.module.min.js';

export class AnimationController {
  constructor(character, params) {
    this.character = character;
    this.params = params;
    
    this.animationTime = 0;
    this.isJumping = false;
    this.jumpStartTime = 0;

    this.bounceOffset = 0;

    // Add this for storing animation offsets
    this.animationOffsets = {
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1)
    };

    // Store the original scale of the character when first created
    this.originalScale = { 
      x: this.character ? this.character.scale.x : 1,
      y: this.character ? this.character.scale.y : 1, 
      z: this.character ? this.character.scale.z : 1
    };
    
    // Add this to track current scale factor applied by player growth
    this.currentScaleFactor = 1.0;
  }
  
  updateCharacter(character) {
    this.character = character;
  }
  

  update(delta, currentAnimation, physicsState = null) {
    this.animationTime += delta;

    // Reset animation offsets
    this.animationOffsets.position.set(0, 0, 0);
    this.animationOffsets.scale.set(1, 1, 1);
  
    if (currentAnimation === 'jump') {
      if (physicsState) {
        // Physics-driven jump animation
        this.updatePhysicsJumpAnimation(physicsState);
      } else {
        // Legacy jump animation path
        this.updateJumpAnimation();
      }
    } else {
      // Apply animation based on current type
      switch (currentAnimation) {
        case 'stand':
          this.applyStandingAnimation();
          break;
        case 'walk':
          this.applyWalkingAnimation();
          break;
        case 'run':
          this.applyRunningAnimation();
          break;
      }
    }
  }

// Add a method to get current offsets
getAnimationOffsets() {
  return this.animationOffsets;
}

// Add a getter method to retrieve the bounce offset
getBounceOffset() {
  return this.bounceOffset;
}

  
  applyStandingAnimation() {
    const { height, armLength } = this.params;
    
    // Reset rotations to A-pose position
    if (this.character.leftArm) {
      this.character.leftArm.rotation.z = Math.PI/2 + Math.PI/6; // A-pose left arm
      this.character.leftArm.rotation.x = 0;
      this.character.leftArm.position.set(
        -this.params.thickness - armLength/2 * Math.cos(Math.PI/6), 
        height/4 - armLength/2 * Math.sin(Math.PI/6), 
        0
      );
      // End cap will follow automatically as a child
    }
    
    if (this.character.rightArm) {
      this.character.rightArm.rotation.z = -Math.PI/2 - Math.PI/6; // A-pose right arm
      this.character.rightArm.rotation.x = 0;
      this.character.rightArm.position.set(
        this.params.thickness + armLength/2 * Math.cos(Math.PI/6), 
        height/4 - armLength/2 * Math.sin(Math.PI/6), 
        0
      );
      // End cap will follow automatically as a child
    }
    
    if (this.character.leftLeg) {
      this.character.leftLeg.rotation.x = 0;
      // End cap will follow automatically as a child
    }
    
    if (this.character.rightLeg) {
      this.character.rightLeg.rotation.x = 0;
      // End cap will follow automatically as a child
    }
    
    // Add subtle idle movement
    const time = this.animationTime;
    const idleAmount = Math.sin(time * 2) * 0.02;
    
    if (this.character.head) this.character.head.rotation.y = Math.sin(time * 0.5) * 0.1;
    if (this.character.torso) this.character.torso.rotation.x = idleAmount;
    
    // Extra subtle movements for blobby characters
    if (this.params.blobbiness > 0) {
      // Subtle body sway
      if (this.character.torso) {
        this.character.torso.rotation.z = Math.sin(time * 0.8) * 0.02 * this.params.blobbiness;
      }
    }
  }
  
  applyWalkingAnimation() {
    const time = this.animationTime;
    const walkSpeed = 5;
    const legAngle = Math.PI/6;  // 30 degrees max rotation
    const armAngle = Math.PI/8;  // 22.5 degrees max rotation
    const { height, armLength } = this.params;
    
    // Legs swing back and forth (opposite phases)
    if (this.character.leftLeg) {
      this.character.leftLeg.rotation.x = Math.sin(time * walkSpeed) * legAngle;
      // End cap will follow automatically as a child
    }
    
    if (this.character.rightLeg) {
      this.character.rightLeg.rotation.x = Math.sin(time * walkSpeed + Math.PI) * legAngle;
      // End cap will follow automatically as a child
    }
    
    // Arms swing back and forth from the A-pose (counter to legs)
    if (this.character.leftArm) {
      // Keep the arm's Z-rotation at A-pose angle
      this.character.leftArm.rotation.z = Math.PI/2 + Math.PI/6;
      
      // Swing arm forward/backward (opposite to right leg)
      this.character.leftArm.rotation.x = Math.sin(time * walkSpeed + Math.PI) * armAngle;
      
      // Adjust arm position based on height and armLength
      this.character.leftArm.position.set(
        -this.params.thickness - armLength/2 * Math.cos(Math.PI/6), 
        height/4 - armLength/2 * Math.sin(Math.PI/6), 
        0
      );
      // End cap will follow automatically as a child
    }
    
    if (this.character.rightArm) {
      // Keep the arm's Z-rotation at A-pose angle
      this.character.rightArm.rotation.z = -Math.PI/2 - Math.PI/6;
      
      // Swing arm forward/backward (opposite to left leg)
      this.character.rightArm.rotation.x = Math.sin(time * walkSpeed) * armAngle;
      
      // Adjust arm position based on height and armLength
      this.character.rightArm.position.set(
        this.params.thickness + armLength/2 * Math.cos(Math.PI/6), 
        height/4 - armLength/2 * Math.sin(Math.PI/6), 
        0
      );
      // End cap will follow automatically as a child
    }
    
    // Slight torso lean
    if (this.character.torso) {
      this.character.torso.rotation.x = 0.05;
      
      // Add torso sway for blobby characters
      if (this.params.blobbiness > 0) {
        this.character.torso.rotation.z = Math.sin(time * walkSpeed) * 0.03 * this.params.blobbiness;
      }
    }
    
    // Add subtle body bounce for blobby characters
    if (this.params.blobbiness > 0 && this.character) {
      this.character.position.y = Math.abs(Math.sin(time * walkSpeed)) * 0.05 * this.params.blobbiness;
    }
  }
  
  applyRunningAnimation() {
    const time = this.animationTime;
    const runSpeed = 10;  // Faster than walking
    const legAngle = Math.PI/4;  // 45 degrees max rotation - more exaggerated
    const armAngle = Math.PI/3;  // 60 degrees max rotation - more exaggerated
    const { height, armLength } = this.params;
    
    // Legs swing back and forth (opposite phases) - exaggerated
    if (this.character.leftLeg) {
      this.character.leftLeg.rotation.x = Math.sin(time * runSpeed) * legAngle;
      // End cap will follow automatically as a child
    }
    
    if (this.character.rightLeg) {
      this.character.rightLeg.rotation.x = Math.sin(time * runSpeed + Math.PI) * legAngle;
      // End cap will follow automatically as a child
    }
    
    // Arms swing with more exaggerated movement
    if (this.character.leftArm) {
      // Keep base A-pose angle
      this.character.leftArm.rotation.z = Math.PI/2 + Math.PI/6;
      
      // Swing arm forward/backward more vigorously (opposite to right leg)
      this.character.leftArm.rotation.x = Math.sin(time * runSpeed + Math.PI) * armAngle;
      
      // Adjust arm position
      this.character.leftArm.position.set(
        -this.params.thickness - armLength/2 * Math.cos(Math.PI/6), 
        height/4 - armLength/2 * Math.sin(Math.PI/6), 
        0
      );
      // End cap will follow automatically as a child
    }
    
    if (this.character.rightArm) {
      // Keep base A-pose angle
      this.character.rightArm.rotation.z = -Math.PI/2 - Math.PI/6;
      
      // Swing arm forward/backward more vigorously (opposite to left leg)
      this.character.rightArm.rotation.x = Math.sin(time * runSpeed) * armAngle;
      
      // Adjust arm position
      this.character.rightArm.position.set(
        this.params.thickness + armLength/2 * Math.cos(Math.PI/6), 
        height/4 - armLength/2 * Math.sin(Math.PI/6), 
        0
      );
      // End cap will follow automatically as a child
    }
    
    // More pronounced torso lean
    if (this.character.torso) {
      this.character.torso.rotation.x = 0.1;
      
      // Add exaggerated torso sway for blobby characters
      if (this.params.blobbiness > 0) {
        this.character.torso.rotation.z = Math.sin(time * runSpeed) * 0.05 * this.params.blobbiness;
      }
    }
    
    // Make the character bounce more during running
    if (this.character) {
      const bounceAmount = 0.1 + (this.params.blobbiness * 0.05);
      //this.character.position.y = Math.abs(Math.sin(time * runSpeed)) * bounceAmount;
      this.bounceOffset = Math.abs(Math.sin(time * runSpeed)) * bounceAmount;
    }
  }
  
  startJump() {
    if (this.isJumping) return;
    
    this.isJumping = true;
    this.jumpStartTime = this.animationTime;
    
    // Save the current arm positions/rotations for smooth transition
    if (this.character.leftArm) {
      this.leftArmStartRotX = this.character.leftArm.rotation.x;
      this.leftArmStartRotZ = this.character.leftArm.rotation.z;
    }
    
    if (this.character.rightArm) {
      this.rightArmStartRotX = this.character.rightArm.rotation.x;
      this.rightArmStartRotZ = this.character.rightArm.rotation.z;
    }
    
    // Immediately set legs to running position at the start of jump
    if (this.character.leftLeg && this.character.rightLeg) {
      this.character.leftLeg.rotation.x = Math.PI/6;  // 30 degrees forward
      this.character.rightLeg.rotation.x = -Math.PI/6; // 30 degrees backward
    }
  }
  
// Updated physics-driven jump animation method
updatePhysicsJumpAnimation(physicsState) {
  // Store the current global scale factors before modifying
  const currentGlobalScale = {
    x: this.character.scale.x / this.originalScale.x,
    y: this.character.scale.y / this.originalScale.y,
    z: this.character.scale.z / this.originalScale.z
  };
  
  // Early jump phase (take-off)
  if (physicsState.jumpTime < 300) {
    // Squash and prepare for jump - USING RELATIVE SCALE
    const squashFactor = 0.3 * Math.min(physicsState.jumpTime / 300, 1) * this.params.blobbiness;
    this.character.scale.set(
      this.originalScale.x * (1 + squashFactor * 0.5) * this.currentScaleFactor,  // Wider
      this.originalScale.y * (1 - squashFactor) * this.currentScaleFactor,        // Shorter
      this.originalScale.z * (1 + squashFactor * 0.5) * this.currentScaleFactor   // Wider
    );
    
    // Prepare jump pose
    if (this.character.leftLeg && this.character.rightLeg) {
      this.character.leftLeg.rotation.x = Math.PI/6 * (physicsState.jumpTime / 300);
      this.character.rightLeg.rotation.x = -Math.PI/6 * (physicsState.jumpTime / 300);
    }
    
    // Start raising arms
    if (this.character.leftArm && this.character.rightArm) {
      const armRaise = Math.sin((physicsState.jumpTime / 300) * Math.PI/2) * 0.5;
      this.character.leftArm.rotation.x = armRaise;
      this.character.rightArm.rotation.x = armRaise;
    }
  } 
  // Mid-air phase
  else {
    // Stretch during flight - USING RELATIVE SCALE
    const stretchFactor = 0.2 * this.params.blobbiness;
    this.character.scale.set(
      this.originalScale.x * (1 - stretchFactor * 0.5) * this.currentScaleFactor,  // Thinner
      this.originalScale.y * (1 + stretchFactor) * this.currentScaleFactor,        // Taller
      this.originalScale.z * (1 - stretchFactor * 0.5) * this.currentScaleFactor   // Thinner
    );
    
    // Mid-air pose
    if (this.character.leftLeg && this.character.rightLeg) {
      this.character.leftLeg.rotation.x = Math.PI/6;
      this.character.rightLeg.rotation.x = -Math.PI/6;
    }
    
    // Arms raised
    if (this.character.leftArm && this.character.rightArm) {
      this.character.leftArm.rotation.x = 0.5;
      this.character.rightArm.rotation.x = 0.5;
    }
  }
  
  // If we're no longer jumping (we landed), reset character
  if (!physicsState.isJumping && physicsState.jumpTime > 0) {
    // Apply temporary landing squash - USING RELATIVE SCALE
    const landSquashFactor = 0.2 * this.params.blobbiness;
    this.character.scale.set(
      this.originalScale.x * (1 + landSquashFactor * 0.5) * this.currentScaleFactor,  // Wider
      this.originalScale.y * (1 - landSquashFactor) * this.currentScaleFactor,        // Shorter
      this.originalScale.z * (1 + landSquashFactor * 0.5) * this.currentScaleFactor   // Wider
    );
      
    // Schedule a reset to normal scale
    setTimeout(() => {
      if (this.character) {
        // Reset to the original scaled size
        this.restoreOriginalScale();
      }
    }, 100);
  }
}

// Update this method for maintaining the scale factor
updateJumpAnimation() {
  const jumpDuration = 1.2;  // seconds
  const elapsedTime = this.animationTime - this.jumpStartTime;
  const { height, armLength } = this.params;
  
  // Calculate jump progress (0 to 1)
  const jumpProgress = Math.min(elapsedTime / jumpDuration, 1);
  
  // Simple parabolic jump curve
  const jumpCurve = -4 * Math.pow(jumpProgress - 0.5, 2) + 1;
  const jumpHeight = jumpCurve * 1.5;  // Maximum jump height
  
  // Update character position
  if (this.character) {
    // Squash and stretch for blobby characters
    if (this.params.blobbiness > 0) {
      // Squash at start and end, stretch at middle
      if (jumpProgress < 0.2 || jumpProgress > 0.8) {
        // Squash (make wider, shorter)
        const yScale = 1 - (this.params.blobbiness * 0.3 * (jumpProgress < 0.2 ? 
                              (0.2 - jumpProgress) * 5 : 
                              (jumpProgress - 0.8) * 5));
        const xzScale = 1 + (this.params.blobbiness * 0.15 * (jumpProgress < 0.2 ? 
                              (0.2 - jumpProgress) * 5 : 
                              (jumpProgress - 0.8) * 5));
                              
        this.character.scale.y = yScale * this.currentScaleFactor;
        this.character.scale.x = xzScale * this.currentScaleFactor;
        this.character.scale.z = xzScale * this.currentScaleFactor;
      } else {
        // Stretch during middle of jump (taller, thinner)
        const yScale = 1 + (this.params.blobbiness * 0.2 * jumpCurve);
        const xzScale = 1 - (this.params.blobbiness * 0.1 * jumpCurve);
        
        this.character.scale.y = yScale * this.currentScaleFactor;
        this.character.scale.x = xzScale * this.currentScaleFactor;
        this.character.scale.z = xzScale * this.currentScaleFactor;
      }
    }
  }
  
  // Legs spread in a running position, but static during jump
  if (this.character.leftLeg && this.character.rightLeg) {
    // Set legs in opposite fixed positions like in running
    this.character.leftLeg.rotation.x = Math.PI/6;  // 30 degrees forward
    this.character.rightLeg.rotation.x = -Math.PI/6; // 30 degrees backward
    // End caps will follow automatically as children
  }
  
  // Arms raise forward during jump while maintaining A-pose angle
  if (this.character.leftArm) {
    // Maintain A-pose Z rotation
    this.character.leftArm.rotation.z = Math.PI/2 + Math.PI/6;
    
    // Raise arms forward during jump
    const armRaise = Math.sin(jumpProgress * Math.PI) * 0.7;
    this.character.leftArm.rotation.x = armRaise;
    
    // Update position
    this.character.leftArm.position.set(
      -this.params.thickness - armLength/2 * Math.cos(Math.PI/6), 
      height/4 - armLength/2 * Math.sin(Math.PI/6), 
      0
    );
    // End cap will follow automatically as a child
  }
  
  if (this.character.rightArm) {
    // Maintain A-pose Z rotation
    this.character.rightArm.rotation.z = -Math.PI/2 - Math.PI/6;
    
    // Raise arms forward during jump
    const armRaise = Math.sin(jumpProgress * Math.PI) * 0.7;
    this.character.rightArm.rotation.x = armRaise;
    
    // Update position
    this.character.rightArm.position.set(
      this.params.thickness + armLength/2 * Math.cos(Math.PI/6), 
      height/4 - armLength/2 * Math.sin(Math.PI/6), 
      0
    );
    // End cap will follow automatically as a child
  }
  
  // End jump after duration
  if (jumpProgress >= 1) {
    this.isJumping = false;
    this.character.position.y = 0;
    
    // Reset character scale (with current scale factor)
    if (this.character && this.params.blobbiness > 0) {
      this.restoreOriginalScale();
    }
  }
}

// Add method to set current scale factor
setScaleFactor(factor) {
  if (!this.character) return;
  
  this.currentScaleFactor = factor;
  this.restoreOriginalScale();
}

// Updated to restore scale with current scale factor
restoreOriginalScale() {
  if (this.character && this.originalScale) {
    this.character.scale.set(
      this.originalScale.x * this.currentScaleFactor,
      this.originalScale.y * this.currentScaleFactor,
      this.originalScale.z * this.currentScaleFactor
    );
  }
}
  
// Updated to maintain scale factor
stopJump() {
  this.isJumping = false;
  if (this.character) {
    this.character.position.y = 0;
    
    // Reset character scale to original (with current scale factor)
    this.restoreOriginalScale();
    
    // Reset leg positions
    if (this.character.leftLeg) this.character.leftLeg.rotation.x = 0;
    if (this.character.rightLeg) this.character.rightLeg.rotation.x = 0;
  }
}
  
// Updated to maintain scale factor
resetCharacter() {
  const { height, armLength } = this.params;
  
  // Reset position and scale
  if (this.character) {
    this.character.position.y = 0;
    this.restoreOriginalScale();
    
    // Reset all limbs
    if (this.character.leftLeg) {
      this.character.leftLeg.rotation.x = 0;
      // End cap will follow automatically as a child
    }
    
    if (this.character.rightLeg) {
      this.character.rightLeg.rotation.x = 0;
      // End cap will follow automatically as a child
    }
    
    // Reset arms to A-pose
    if (this.character.leftArm) {
      this.character.leftArm.rotation.z = Math.PI/2 + Math.PI/6;
      this.character.leftArm.rotation.x = 0;
      this.character.leftArm.position.set(
        -this.params.thickness - armLength/2 * Math.cos(Math.PI/6), 
        height/4 - armLength/2 * Math.sin(Math.PI/6), 
        0
      );
      // End cap will follow automatically as a child
    }
    
    if (this.character.rightArm) {
      this.character.rightArm.rotation.z = -Math.PI/2 - Math.PI/6;
      this.character.rightArm.rotation.x = 0;
      this.character.rightArm.position.set(
        this.params.thickness + armLength/2 * Math.cos(Math.PI/6), 
        height/4 - armLength/2 * Math.sin(Math.PI/6), 
        0
      );
      // End cap will follow automatically as a child
    }
    
    if (this.character.torso) {
      this.character.torso.rotation.x = 0;
      this.character.torso.rotation.z = 0;
    }
    if (this.character.head) this.character.head.rotation.y = 0;
  }
}
}