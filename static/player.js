import * as CANNON from '/dist/cannon-es.js';
import * as THREE from '/static/three.module.min.js';
import { PointerLockControlsCannon } from './js/PointerLockControlsCannon.js';
import { CharacterManager } from './CharacterManager.js';
import { PlayerShadow } from './PlayerShadow.js';



export class Player {
  constructor(camera, scene, world, physicsMaterial) {
    this.camera = camera;
    this.scene = scene;
    this.world = world;
    this.physicsMaterial = physicsMaterial;
    
    this.sphereShape = null;
    this.sphereBody = null;
    this.controls = null;
    
    this.balls = [];
    this.ballMeshes = [];

    this.shadow = null;
    
    // Character manager for the visual representation
    this.characterManager = null;
    
    // Camera offset for third person view
    this.cameraOffset = new THREE.Vector3(0, 2, 5);
    this.cameraTarget = new THREE.Vector3();
    
    // Movement variables
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;

    // Jump state tracking
    this.isGrounded = false;
    this.isJumping = false;
    this.jumpStartTime = 0;
    
    // Get DOM elements
    this.instructions = document.getElementById('instructions');
    this.enabled = false;

    this.isDead = false;
    this.deathY = -40; // Y position threshold for death
    this.respawnPosition = new THREE.Vector3(15, 30, 15); // Same as initial spawn position
  }

  // Initialize the player physics, controls, and character
  init() {
    this.createPlayerBody();
    this.initPointerLock();
    this.setupShootingMechanism();
    this.initCharacter();
    this.initShadow(); 
    this.setupKeyboardControls();
    
    // Initialize from portal data if coming from a portal
    this.initFromPortalData();
  }
  
  // Method to initialize player from portal data (if available)
  initFromPortalData() {
    const urlParams = new URLSearchParams(window.location.search);
    const cameFromPortal = urlParams.has('portal') && urlParams.get('portal') === 'true';

    if (!cameFromPortal) return false;

    console.log("Initializing player from portal data");

    // Get portal parameters
    const username = urlParams.get('username');
    const color = urlParams.get('color');
    const speed = parseFloat(urlParams.get('speed'));

    // Apply username if provided
    if (username) {
      this.playerName = username;
      console.log(`Player name set to: ${username}`);
    }

    // Apply color if provided and characterManager exists
    if (color && this.characterManager) {
      try {
        const colorObj = new THREE.Color(color);
        const hexColor = '#' + colorObj.getHexString();

        // Store original colors for reference
        this.originalColors = { ...this.characterManager.params.colors };

        // Update character colors
        this.characterManager.params.colors.head = hexColor;
        this.characterManager.params.colors.torso = hexColor;
        this.characterManager.params.colors.arms = hexColor;
        this.characterManager.params.colors.legs = hexColor;

        console.log(`Applied player color: ${hexColor}`);
      } catch (e) {
        console.warn("Could not apply color:", color, e);
      }
    }

    // Apply speed boost if provided
    if (!isNaN(speed) && speed > 0) {
      // Calculate a speed multiplier based on the provided value
      // For example, if speed=10, player might move twice as fast
      const baseSpeed = 5; // Our game's baseline speed
      const speedMultiplier = speed / baseSpeed;

      // Limit multiplier to a reasonable range (0.5 to 3.0)
      const cappedMultiplier = Math.max(0.5, Math.min(3.0, speedMultiplier));

      // Store the multiplier for use in movement calculations
      this.speedMultiplier = cappedMultiplier;

      console.log(`Applied speed multiplier: ${cappedMultiplier}`);
    } else {
      // Default speed multiplier
      this.speedMultiplier = 1.0;
    }

    return true; // Successfully initialized from portal data
  }
  
  // Initialize the 3D character
  initCharacter() {
    console.log("Creating character manager...");
    try {
      this.characterManager = new CharacterManager(this.scene);
      console.log("Character manager created successfully");
      
      console.log("Initializing character...");
      const character = this.characterManager.init();
      console.log("Character initialized:", character ? "Success" : "Failed");
      
      // Position the character inside the physics sphere
      if (character) {
        character.position.copy(this.sphereBody.position);
        console.log("Character positioned at:", this.sphereBody.position);
      } else {
        console.warn("No character object returned from characterManager.init()");
      }
    } catch (error) {
      console.error("Error initializing character:", error);
      console.error("Character initialization stack:", error.stack);
      throw error;
    }
  }

  // Create the player's physical body
  createPlayerBody() {
    const radius = 0.57;
    this.sphereShape = new CANNON.Sphere(radius);
    this.sphereBody = new CANNON.Body({ 
      mass: 4, 
      material: this.physicsMaterial 
    });
    this.sphereBody.addShape(this.sphereShape);
    
    // Start player higher above the terrain to prevent initial sinking
    this.sphereBody.position.set(15, 30, 15); // Higher starting position
    
    // Increased damping to prevent excessive sliding
    this.sphereBody.linearDamping = 0.6;  //0.95;
    
    // Adjust angular factors to prevent unwanted rotation
    this.sphereBody.angularDamping = 0.9;
    this.sphereBody.fixedRotation = true; // Prevent rotation from forces
    
    // Add to physics world
    this.world.addBody(this.sphereBody);
    
    // Contact event to detect when player can jump
    //this.sphereBody.addEventListener('collide', (e) => {
  //const contact = e.contact;
  
  // Check if the contact is below the player
  //if (contact.ni.y > 0.5) {
    //this.isGrounded = true;
    //this.canJump = true;
    
    // If we were jumping, we've now landed
    //if (this.isJumping) {
    //  this.isJumping = false;
    //}
  //}
//});
  }

  initShadow() {
    // Create player shadow
    this.shadow = new PlayerShadow(this.scene, this.world);
  }

  // Initialize pointer lock controls
  initPointerLock() {
    this.controls = new PointerLockControlsCannon(this.camera, this.sphereBody);
    this.scene.add(this.controls.getObject());

    // Make sure the instructions element is properly referenced
    if (!this.instructions) {
      console.error("Instructions element not found!");
      this.instructions = document.getElementById('instructions');
    }

    // Set up the click event on instructions to lock controls
    this.instructions.addEventListener('click', () => {
      console.log("Instructions clicked, locking controls...");
      this.controls.lock();
    });

    // Event handlers for locking/unlocking
    this.controls.addEventListener('lock', () => {
      console.log("Controls locked");
      this.controls.enabled = true;
      this.enabled = true;
      this.instructions.style.display = 'none';
    });

    this.controls.addEventListener('unlock', () => {
      console.log("Controls unlocked");
      this.controls.enabled = false;
      this.enabled = false;
      this.instructions.style.display = '';
    });
  }

  // Set up keyboard controls for WASD movement
  setupKeyboardControls() {
    document.addEventListener('keydown', (event) => {
      switch (event.code) {
        case 'KeyW':
          this.moveForward = true;
          break;
        case 'KeyA':
          this.moveLeft = true;
          break;
        case 'KeyS':
          this.moveBackward = true;
          break;
        case 'KeyD':
          this.moveRight = true;
          break;
        // Update the space key handler in setupKeyboardControls()
        case 'Space':
          console.log('Space pressed - canJump:', this.canJump, 'isGrounded:', this.isGrounded);
          if (this.canJump && this.isGrounded && !this.spacePressed) {
            console.log('Jumping!');
            this.sphereBody.velocity.y = 20;
            this.isJumping = true;
            this.jumpStartTime = performance.now();
            this.canJump = false;
            this.spacePressed = true;
          }
          break;
      }
    });

    document.addEventListener('keyup', (event) => {
      switch (event.code) {
        case 'KeyW':
          this.moveForward = false;
          break;
        case 'KeyA':
          this.moveLeft = false;
          break;
        case 'KeyS':
          this.moveBackward = false;
          break;
        case 'KeyD':
          this.moveRight = false;
          break;
        case 'Space':
          // Add this to handle space key release
          this.spacePressed = false;
          break;
       }
    });
  }

  // Set up the shooting mechanism
  setupShootingMechanism() {
    const ballShape = new CANNON.Sphere(0.2);
    const ballGeometry = new THREE.SphereGeometry(ballShape.radius, 32, 32);
    const ballMaterial = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    const shootVelocity = 15;

    // Add click event listener for shooting
    window.addEventListener('click', (event) => {
      if (!this.controls.enabled) {
        return;
      }
      return;  // pass shooting or throwing for now (implement later)
      // Create ball physics body
      const ballBody = new CANNON.Body({ mass: 1 });
      ballBody.addShape(ballShape);
      
      // Create ball visual mesh
      const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
      ballMesh.castShadow = true;
      ballMesh.receiveShadow = true;

      // Add to world and scene
      this.world.addBody(ballBody);
      this.scene.add(ballMesh);
      this.balls.push(ballBody);
      this.ballMeshes.push(ballMesh);

      // Calculate shooting direction and velocity
      const shootDirection = this.getShootDirection();
      ballBody.velocity.set(
        shootDirection.x * shootVelocity,
        shootDirection.y * shootVelocity,
        shootDirection.z * shootVelocity
      );

      // Position the ball outside the player sphere
      const x = this.sphereBody.position.x + shootDirection.x * (this.sphereShape.radius * 1.02 + ballShape.radius);
      const y = this.sphereBody.position.y + shootDirection.y * (this.sphereShape.radius * 1.02 + ballShape.radius);
      const z = this.sphereBody.position.z + shootDirection.z * (this.sphereShape.radius * 1.02 + ballShape.radius);
      ballBody.position.set(x, y, z);
      ballMesh.position.copy(ballBody.position);
      
      // Limit the number of balls to prevent performance issues
      if (this.balls.length > 20) {
        const oldBall = this.balls.shift();
        const oldMesh = this.ballMeshes.shift();
        this.world.removeBody(oldBall);
        this.scene.remove(oldMesh);
      }
    });
  }

  // Returns a vector pointing in the direction the camera is facing
  getShootDirection() {
    const vector = new THREE.Vector3(0, 0, 1);
    vector.unproject(this.camera);
    const ray = new THREE.Ray(
      this.sphereBody.position, 
      vector.sub(this.sphereBody.position).normalize()
    );
    return ray.direction;
  }
  
  // Simplified multi-ray ground detection without additional slope features
// Updated method to check ground contact with scaled player
checkGroundContact() {
  // We'll use multiple raycasts in a pattern to better detect ground on slopes
  const rayCount = 5; // Center + 4 directions
  let hitCount = 0;
  
  // Use the current sphere radius for ray length (plus a small buffer)
  const rayLength = this.sphereShape.radius + 0.3;
  
  // Starting point for rays - the sphere's center
  const center = new CANNON.Vec3(
    this.sphereBody.position.x,
    this.sphereBody.position.y,
    this.sphereBody.position.z
  );
  
  // Store ray directions - center and 4 diagonal directions
  const rayDirections = [
    // Center ray - straight down
    new CANNON.Vec3(0, -1, 0),
    // Four rays at 45-degree angles from center
    new CANNON.Vec3(-0.7, -0.7, 0).normalize(),
    new CANNON.Vec3(0.7, -0.7, 0).normalize(),
    new CANNON.Vec3(0, -0.7, -0.7).normalize(),
    new CANNON.Vec3(0, -0.7, 0.7).normalize()
  ];
  
  // Cast all rays
  for (let i = 0; i < rayCount; i++) {
    const direction = rayDirections[i];
    
    // Calculate ray end point
    const rayEnd = new CANNON.Vec3(
      center.x + direction.x * rayLength,
      center.y + direction.y * rayLength,
      center.z + direction.z * rayLength
    );
    
    // Create ray from center to end point
    const ray = new CANNON.Ray(center, rayEnd);
    const result = new CANNON.RaycastResult();
    
    // Cast the ray
    ray.intersectWorld(this.world, {
      mode: CANNON.Ray.CLOSEST,
      result: result,
      skipBackfaces: true
    });
    
    // If we hit something
    if (result.hasHit) {
      // Skip if we hit ourselves
      if (result.body === this.sphereBody) continue;
      
      // Otherwise, count the hit
      hitCount++;
    }
  }
  
  // Previous ground state
  const wasGrounded = this.isGrounded;
  
  // We're grounded if any ray hit
  this.isGrounded = hitCount > 0;
  
  // If we just landed, reset jump state
  if (!wasGrounded && this.isGrounded && this.isJumping) {
    this.isJumping = false;
    this.canJump = true;
  }
  
  // If we're on ground, always allow jumping
  if (this.isGrounded) {
    this.canJump = true;
  }
  
  return this.isGrounded;
}


  // Update method called on each animation frame
  update(dt, lightParams = null) {
    // First update controls for camera rotation
    if (this.controls) {
      this.controls.update(dt, true);  // Skip position update, we'll handle it separately
    }

    // Check ground contact
    this.checkGroundContact();

    // Apply WASD movement forces
    if (this.enabled) {
      this.applyMovementForces();
    }
    
    // Handle camera following with improved orbit approach
    this.updateCameraOrbit(dt);
    
    // Update ball positions
    for (let i = 0; i < this.balls.length; i++) {
      this.ballMeshes[i].position.copy(this.balls[i].position);
      this.ballMeshes[i].quaternion.copy(this.balls[i].quaternion);
    }
    
    // Update character position and animation
if (this.characterManager) {
  // Get camera direction vector for character orientation
  const cameraDirection = this.getCameraDirection();
  
  // Create a position vector for the character
  const characterPosition = new THREE.Vector3();
  characterPosition.copy(this.sphereBody.position);
  
  // Position the character in the center of the physics sphere
  // Remove the negative offset that was previously placing it at the bottom
  // No vertical offset is needed for centering
  
  this.characterManager.update(
    dt,
    characterPosition,
    this.sphereBody.velocity,
    cameraDirection,
    {
      isGrounded: this.isGrounded,
      isJumping: this.isJumping,
      jumpTime: this.isJumping ? performance.now() - this.jumpStartTime : 0
    },
    lightParams  // Pass the lighting parameters
  );

  // Check if player has fallen to death
  this.checkDeath();

 }


 // Update shadow
 if (this.shadow) {
   this.shadow.update(
     this.sphereBody.position,
     this.isJumping,
     this.isGrounded
   );
 }

}
  
  // Updated camera orbit method that accounts for both yaw and pitch
  // with collision detection to prevent camera clipping through objects
// Updated camera orbit method to account for player scale
updateCameraOrbit(dt) {
  if (!this.controls) return;
  
  // Get player position (target to orbit around)
  const playerPos = this.sphereBody.position.clone();
  
  // Get rotation angles from the controls
  const yawRotation = this.controls.getYawRotation();
  const pitchRotation = this.controls.getPitchRotation();
  
  // Calculate scale factor for camera adjustments
  const scaleFactor = this.sphereShape.radius / 0.57; // 0.57 is the default radius
  
  // Set up base orbit distance - scale with player size
  const idealOrbitDistance = 6 * Math.max(1, scaleFactor * 0.7);
  
  // Track current orbit distance with smooth transitions
  if (!this.currentOrbitDistance) {
    this.currentOrbitDistance = idealOrbitDistance;
  }
  
  // Calculate desired camera position based on spherical coordinates
  // Use both yaw and pitch for full 3D orbit
  const horizontalDistance = idealOrbitDistance * Math.cos(pitchRotation);
  
  // Calculate the desired camera position
  const desiredCameraPos = new THREE.Vector3(
    playerPos.x + Math.sin(yawRotation) * horizontalDistance,
    playerPos.y + idealOrbitDistance * Math.sin(pitchRotation) + (1.5 * scaleFactor), // Scale height offset
    playerPos.z + Math.cos(yawRotation) * horizontalDistance
  );
  
  // Check for collisions between player and desired camera position
  const adjustedDistance = this.checkCameraCollision(playerPos, desiredCameraPos, idealOrbitDistance);
  
  // Smooth interpolation for camera distance changes
  const interpolationSpeed = 5.0; // Adjust for faster/slower transitions
  this.currentOrbitDistance = THREE.MathUtils.lerp(
    this.currentOrbitDistance, 
    adjustedDistance, 
    Math.min(dt * interpolationSpeed, 1.0)
  );
  
  // Calculate the actual camera position with the adjusted distance
  const adjustedHorizontalDistance = this.currentOrbitDistance * Math.cos(pitchRotation);
  
  const newCameraPos = new THREE.Vector3(
    playerPos.x + Math.sin(yawRotation) * adjustedHorizontalDistance,
    playerPos.y + this.currentOrbitDistance * Math.sin(pitchRotation) + (1.5 * scaleFactor), // Scale height offset
    playerPos.z + Math.cos(yawRotation) * adjustedHorizontalDistance
  );
  
  // Set camera position
  this.controls.getObject().position.copy(newCameraPos);
  
  // Calculate look target (slightly above player for better framing)
  const lookTarget = new THREE.Vector3();
  lookTarget.copy(playerPos);
  lookTarget.y += 1.0 * scaleFactor; // Scale look height with player size
  
  // Make camera look at player
  this.camera.lookAt(lookTarget);
}  


  
  // Check for collisions between player and camera
  checkCameraCollision(playerPos, desiredCameraPos, maxDistance) {
    // Starting point for the ray (player's head position)
    const rayFrom = new CANNON.Vec3(
      playerPos.x,
      playerPos.y + 1.0, // Start at player's head level
      playerPos.z
    );
    
    // Direction to the desired camera position
    const rayTo = new CANNON.Vec3(
      desiredCameraPos.x,
      desiredCameraPos.y,
      desiredCameraPos.z
    );
    
    // Calculate ray direction and normalize
    const rayDirection = new CANNON.Vec3();
    rayDirection.copy(rayTo);
    rayDirection.vsub(rayFrom, rayDirection);
    const rayDistance = rayDirection.length();
    rayDirection.normalize();
    
    // Create a ray
    const ray = new CANNON.Ray(rayFrom, rayTo);
    ray.checkCollisionResponse = true; // Only detect objects with collision response
    ray.skipBackfaces = true; // Skip backfaces
    
    // Store hit information
    const result = new CANNON.RaycastResult();
    result.reset();
    
    // Test for intersections
    ray.intersectWorld(this.world, {
      mode: CANNON.Ray.CLOSEST,
      result: result,
      skipBackfaces: true
    });
    
    // If we hit something, and it's closer than our max distance
    if (result.hasHit && result.distance < rayDistance) {
      // Check if the hit object is marked as non-collidable for camera
      const hitBody = result.body;
      
      // If the body is explicitly marked as not camera collidable, ignore the hit
      if (hitBody && hitBody.cameraCollidable === false) {
        return maxDistance; // Return the full distance
      }
      
      // Otherwise, adjust the distance to the hit point minus a small buffer
      // to prevent camera clipping into objects
      const buffer = 0.3; 
      return Math.max(0.5, result.distance - buffer);
    }
    
    // No collision or collision with non-collidable object, return the max distance
    return maxDistance;
  }
  
  // Get camera's forward direction (in world space, flattened to xz plane)
  getCameraDirection() {
    // Get direction directly from controls
    const direction = this.controls.getDirection().clone();
    
    // Project to XZ plane (flatten y component) and normalize
    direction.y = 0;
    direction.normalize();
    
    // Add isMoving flag for animation control
    direction.isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
    
    return direction;
  }
  
  // Get the movement direction based on current key presses and camera orientation
  getMovementDirection() {
    // First get camera's facing direction regardless of movement
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(this.camera.quaternion);
    cameraDirection.y = 0;
    cameraDirection.normalize();
    
    // This will be returned as the character's facing direction even when not moving
    let direction = cameraDirection.clone();
    
    // Set the isMoving flag based on key presses
    const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight;
    
    // Attach isMoving property to the direction vector
    direction.isMoving = isMoving;
    
    // If there's actual movement input, calculate that direction
    if (isMoving) {
      // Reset the direction for movement calculation
      const movementDir = new THREE.Vector3(0, 0, 0);
      
      // Get right vector from camera
      const cameraRight = new THREE.Vector3(1, 0, 0);
      cameraRight.applyQuaternion(this.camera.quaternion);
      cameraRight.y = 0;
      cameraRight.normalize();
      
      // Combine directions based on key presses
      if (this.moveForward) movementDir.add(cameraDirection);
      if (this.moveBackward) movementDir.sub(cameraDirection);
      if (this.moveRight) movementDir.add(cameraRight);
      if (this.moveLeft) movementDir.sub(cameraRight);
      
      if (movementDir.lengthSq() > 0) {
        movementDir.normalize();
        direction = movementDir; // Use movement direction if moving
        direction.isMoving = isMoving; // Preserve the isMoving flag
      }
    }
    
    return direction;
  }
  

// Updated applyMovementForces with scaling based on player size
applyMovementForces() {
 if (!this.characterManager || !this.characterManager.character) return;

 // Get the character's current rotation (y-axis, yaw)
 const characterRotation = this.characterManager.character.rotation.y;

 // Calculate the forward direction based on character's rotation
 const forward = new THREE.Vector3(0, 0, 1);
 forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), characterRotation);
 forward.y = 0;
 forward.normalize();

 // Calculate the right direction (perpendicular to forward)
 const right = new THREE.Vector3(1, 0, 0);
 right.applyAxisAngle(new THREE.Vector3(0, 1, 0), characterRotation);
 right.y = 0;
 right.normalize();
 right.negate();

 // Calculate movement direction based on key states
 const moveDirection = new THREE.Vector3(0, 0, 0);

 // Apply movement based on key presses
 if (this.moveForward) moveDirection.add(forward);
 if (this.moveBackward) moveDirection.sub(forward);
 if (this.moveRight) moveDirection.add(right);
 if (this.moveLeft) moveDirection.sub(right);

 // Apply force if there's any movement input
 if (moveDirection.lengthSq() > 0.01) {
   moveDirection.normalize();

   // Base force magnitude
   let forceMagnitude = 3; // Regular ground movement force
   
   // Apply speed multiplier from portal data if available
   if (this.speedMultiplier) {
     forceMagnitude *= this.speedMultiplier;
   }
   
   // Calculate current horizontal speed
   const currentVelocity = new THREE.Vector3(
     this.sphereBody.velocity.x,
     0,
     this.sphereBody.velocity.z
   );
   const currentSpeed = currentVelocity.length();
   
   // Apply a start boost for responsiveness when starting from rest
   const startBoost = currentSpeed < 1.0 ? 40.0 : 1.0;
   
   // Calculate force multiplier based on player scale
   // Default radius is 0.57, so calculate current scale factor
   const playerScale = this.sphereShape.radius / 0.57;
   // Apply force scaling - stronger force for larger player
   const forceScaling = Math.pow(1.4, Math.log2(playerScale));
   
   // Apply scaling to the force magnitude
   forceMagnitude *= forceScaling;
   
   // Mid-air control adjustment
   if (!this.isGrounded) {
     // Mid-air control factor (0.0 = no control, 1.0 = full control)
     const airControlFactor = 1; // Adjust this value to taste (0.3-0.6 is typical)
     
     // Reduce force when in air, but keep some control
     forceMagnitude *= airControlFactor;
     
     // Only allow air control up to a reasonable speed limit
     // This prevents excessive air acceleration
     const maxAirSpeed = 10 * forceScaling; // Scale max air speed with player size
     
     // Calculate the dot product between current velocity and desired direction
     // This tells us if we're trying to speed up or change direction
     const velocityDirection = currentSpeed > 0.1 ? 
       new THREE.Vector3().copy(currentVelocity).normalize() : 
       new THREE.Vector3();
     
     const dotProduct = velocityDirection.dot(moveDirection);
     
     // If we're already moving fast in that direction, reduce force further
     if (dotProduct > 0.7 && currentSpeed > maxAirSpeed) {
       // We're already going fast in roughly the same direction - limit acceleration
       forceMagnitude *= 0.5;
     }
     
     // Increase air control for changing direction (lower dot product means bigger direction change)
     if (dotProduct < 0.3 && currentSpeed > 0.1) {
       // We're trying to change direction significantly - boost control
       forceMagnitude *= 1.5;
     }
   }

   // Final force calculation
   const force = new CANNON.Vec3(
     moveDirection.x * forceMagnitude * startBoost,
     0,
     moveDirection.z * forceMagnitude * startBoost
   );

   // Apply the force to the physics body
   this.sphereBody.applyForce(force, this.sphereBody.position);
 }
 // Apply active braking when on ground and no movement keys are pressed
 else if (this.isGrounded) {
   const velocity = this.sphereBody.velocity;
   const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
   
   // Only apply braking if we're moving
   if (horizontalSpeed > 0.5) {
     // Calculate braking force direction (opposite to current velocity)
     const brakingDirection = new THREE.Vector3(
       -velocity.x,
       0,
       -velocity.z
     ).normalize();
     
     // Calculate player scale for braking force
     const playerScale = this.sphereShape.radius / 0.57;
     // Stronger braking for larger player
     const brakeScaling = Math.pow(1.4, Math.log2(playerScale));
     
     // Strong braking force, scaled with player size
     const brakingMagnitude = 30 * brakeScaling;
     const brakingForce = new CANNON.Vec3(
       brakingDirection.x * brakingMagnitude,
       0,
       brakingDirection.z * brakingMagnitude
     );
     
     // Apply braking force
     this.sphereBody.applyForce(brakingForce, this.sphereBody.position);
   }
 }
} 



  // Get the controls
  getControls() {
    return this.controls;
  }
  
  // Utility method to mark an object as non-collidable for the camera
  // Can be called on objects that shouldn't block the camera (clouds, fog, etc.)
  setCameraCollidable(body, collidable = true) {
    if (body) {
      body.cameraCollidable = collidable;
    }
  }


// Method to check for collisions with mushrooms
checkMushroomCollisions(gameObjects) {
  if (!this.sphereBody || !gameObjects || !gameObjects.mushrooms) return;
  
  // Get player position
  const playerPos = this.sphereBody.position;
  
  // Get player radius (from the sphere shape)
  const playerRadius = this.sphereShape.radius;
  
  // Check each mushroom for collision
  const mushroomsToRemove = [];
  
  for (const mushroom of gameObjects.mushrooms) {
    const mushroomPos = mushroom.body.position;
    
    // Calculate distance between player and mushroom centers
    const dx = playerPos.x - mushroomPos.x;
    const dy = playerPos.y - mushroomPos.y;
    const dz = playerPos.z - mushroomPos.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    // Get mushroom radius from its body shape
    const mushroomRadius = mushroom.body.shapes[0].radius;
    
    // If the distance is less than the sum of radii, collision occurred
    if (distance < (playerRadius + mushroomRadius)) {
      // Add this mushroom to removal list
      mushroomsToRemove.push(mushroom.id);
      
      // Trigger any effects from eating mushroom
      this.onMushroomEaten(mushroom);
    }
  }
  
  // Remove all collected mushrooms
  mushroomsToRemove.forEach(id => {
    gameObjects.removeMushroom(id);
  });
  
  return mushroomsToRemove.length > 0;
}

// Updated method for mushroom consumption effects
onMushroomEaten(mushroom) {
  console.log('Mushroom eaten!', mushroom.id);
  
  // Scale the player by 1.5x when a mushroom is eaten
  this.scalePlayer(1.5);
}


// Updated method to handle player scaling with animation controller integration
scalePlayer(scaleFactor) {
  // Don't allow scaling if the player is already scaled beyond a certain point
  const maxScale = 25.7; // Maximum allowed scale
  
  // Get current scale
  const currentScale = this.sphereBody.shapes[0].radius / 0.57; // 0.57 is the default radius
  
  // Calculate new scale, but don't exceed max
  const newScale = Math.min(currentScale * scaleFactor, maxScale);
  
  console.log(`Scaling player from ${currentScale}x to ${newScale}x`);
  
  // Scale the physics body
  const originalRadius = 0.57; // Original sphere radius
  const newRadius = originalRadius * newScale;
  
  // Update the sphere shape's radius
  this.sphereShape.radius = newRadius;
  this.sphereBody.updateBoundingRadius();
  
  // Scale visual character if it exists
  if (this.characterManager && this.characterManager.character) {
    // Scale the character model
    this.characterManager.character.scale.set(
      0.6 * newScale, // Multiplying by 0.6 since that's the base scale used in characterManager
      0.6 * newScale,
      0.6 * newScale
    );
    
    // Update the animation controller's scale factor
    if (this.characterManager.animationController) {
      this.characterManager.animationController.setScaleFactor(newScale);
    }
  }
  
  // Update camera distance and position based on new player size
  if (this.controls) {
    // Get current camera position
    const cameraPos = this.controls.getObject().position;
    
    // Update camera height (y offset) based on new scale
    this.cameraOffset.y = 2 * newScale;
    
    // Position will be updated naturally in the next frame's updateCameraOrbit
  }
  
  // Optional: Add a visual effect to indicate scaling
  this.addScalingEffect();
}


// Add a visual effect when scaling
addScalingEffect() {
  // Create a simple expanding ring effect at player position
  if (!this.scene) return;
  
  const ringGeometry = new THREE.RingGeometry(0.5, 0.7, 32);
  const ringMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide
  });
  
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  
  // Position the ring at player position
  ring.position.copy(this.sphereBody.position);
  
  // Orient it to face upwards
  ring.rotation.x = -Math.PI / 2;
  
  // Add to scene
  this.scene.add(ring);
  
  // Animate the ring expansion and fade out
  const startTime = performance.now();
  const duration = 1000; // 1 second animation
  
  const expandRing = () => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Expand the ring
    const scale = 1 + progress * 5;
    ring.scale.set(scale, scale, scale);
    
    // Fade out
    ringMaterial.opacity = 0.7 * (1 - progress);
    
    if (progress < 1) {
      requestAnimationFrame(expandRing);
    } else {
      // Remove the ring when animation is complete
      this.scene.remove(ring);
      ringGeometry.dispose();
      ringMaterial.dispose();
    }
  };
  
  // Start the animation
  expandRing();
}

// Add this method to check if player has fallen below death threshold
checkDeath() {
  if (!this.isDead && this.sphereBody.position.y < this.deathY) {
    this.die();
  }
}

// Method to handle player death
die() {
  // Set dead state
  this.isDead = true;
  
  // Show death screen
  const deathScreen = document.getElementById('deathScreen');
  if (deathScreen) {
    deathScreen.style.display = 'flex';
    
    // Allow clicking anywhere to respawn
    deathScreen.addEventListener('click', () => this.respawn(), { once: true });
    
    // Also allow pressing any key to respawn
    const handleKeyDown = () => {
      this.respawn();
      document.removeEventListener('keydown', handleKeyDown);
    };
    document.addEventListener('keydown', handleKeyDown);
  }
  
  // Disable controls while dead
  if (this.controls) {
    this.controls.enabled = false;
    this.enabled = false;
  }
  
  // Optionally play death sound
  if (window.playSoundEffect) {
    window.playSoundEffect('death');
  }
}

// Method to respawn the player
respawn() {
  // Hide death screen
  const deathScreen = document.getElementById('deathScreen');
  if (deathScreen) {
    deathScreen.style.display = 'none';
  }
  
  // Reset player position
  this.sphereBody.position.copy(this.respawnPosition);
  this.sphereBody.velocity.set(0, 0, 0); // Reset velocity
  
  // Reset any growth scale from mushrooms
  if (this.sphereShape) {
    this.sphereShape.radius = 0.57; // Reset to default radius
    this.sphereBody.updateBoundingRadius();
  }
  
  // Reset character scale if it exists
  if (this.characterManager && this.characterManager.character) {
    this.characterManager.character.scale.set(0.6, 0.6, 0.6); // Reset to default scale
    
    // Reset animation controller scale if it exists
    if (this.characterManager.animationController) {
      this.characterManager.animationController.setScaleFactor(1.0);
    }
  }
  
  // Re-enable controls
  if (this.controls) {
    this.controls.enabled = true;
    this.enabled = true;
  }
  
  // Reset death state
  this.isDead = false;
  
  // Request pointer lock again
  setTimeout(() => {
    if (this.controls) {
      this.controls.lock();
    }
  }, 100);
}

}