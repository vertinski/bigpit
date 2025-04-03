// PlayerShadow.js
import * as THREE from '/static/three.module.min.js';
import * as CANNON from '/dist/cannon-es.js';

export class PlayerShadow {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.shadowMesh = null;
    this.maxDistance = 4.0;  // Maximum distance to render shadow
    this.shadowSize = 1.2;   // Base size of shadow plane
    
    // Delay shadow creation to ensure it doesn't interfere with initial physics
    setTimeout(() => {
      // Create the shadow texture
      this.createShadowTexture();
      
      // Create the shadow mesh
      this.createShadowMesh();
    }, 1000); // Delay by 1 second
  }
  
  createShadowTexture() {
    // Create a canvas for the shadow texture
    const canvas = document.createElement('canvas');
    canvas.width = 256; // High resolution for smooth gradient
    canvas.height = 256;
    const context = canvas.getContext('2d');
    
    // Clear the canvas with transparent color
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Create a radial gradient for a soft-edged shadow
    const gradient = context.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    
    // Set gradient colors with more stops for smoother transition
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.5)');    // Center
    gradient.addColorStop(0.2, 'rgba(0, 0, 0, 0.45)');  // Near center
    gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.3)');   // Mid-inner
    gradient.addColorStop(0.6, 'rgba(0, 0, 0, 0.15)');  // Mid-outer
    gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.05)');  // Near edge
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');       // Edge (transparent)
    
    // Fill the canvas with the gradient
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Create texture from the canvas
    this.shadowTexture = new THREE.CanvasTexture(canvas);
    this.shadowTexture.needsUpdate = true;
    
    // Use correct filtering for better appearance
    this.shadowTexture.minFilter = THREE.LinearFilter;
    this.shadowTexture.magFilter = THREE.LinearFilter;
  }
  
  createShadowMesh() {
    // Create a plane geometry for the shadow
    const geometry = new THREE.PlaneGeometry(this.shadowSize, this.shadowSize);
    
    // Create material with the shadow texture
    const material = new THREE.MeshBasicMaterial({
      map: this.shadowTexture,
      transparent: true,
      depthWrite: false,  // Don't write to the depth buffer
      blending: THREE.NormalBlending,  // Use normal blending instead of multiply
      side: THREE.DoubleSide  // Render both sides of the plane
    });
    
    // Create the mesh
    this.shadowMesh = new THREE.Mesh(geometry, material);
    
    // Rotate to lie flat on the ground (facing up)
    this.shadowMesh.rotation.x = -Math.PI / 2;
    
    // Slightly above ground to prevent z-fighting
    this.shadowMesh.position.y = 0.01;
    
    // Add to scene
    this.scene.add(this.shadowMesh);
  }
  
  update(playerPosition, isJumping, isGrounded) {
    if (!this.shadowMesh) return;
    
    // Don't block physics calculations with shadow ray casting
    // Skip all shadow calculations if player is too high above starting position
    if (playerPosition.y > 25) {
      this.shadowMesh.visible = false;
      return;
    }
    
    // Cast a ray downward from the player to find ground
    const rayStart = new CANNON.Vec3(
      playerPosition.x,
      playerPosition.y,
      playerPosition.z
    );
    
    // Cast ray far enough to hit ground even during jumps
    const rayEnd = new CANNON.Vec3(
      playerPosition.x,
      playerPosition.y - this.maxDistance * 1.5, // Cast farther than our max distance
      playerPosition.z
    );
    
    const ray = new CANNON.Ray(rayStart, rayEnd);
    const result = new CANNON.RaycastResult();
    
    // Use direct world intersection for simplicity and performance
    ray.intersectWorld(this.world, {
      mode: CANNON.Ray.CLOSEST,
      result: result,
      skipBackfaces: true
    });
    
    if (result.hasHit) {
      // Make sure we didn't hit the player's own body
      if (result.body.id !== playerPosition.id) {
        const distance = result.distance;
        
        // Only show shadow if within maxDistance
        if (distance <= this.maxDistance) {
          // Calculate opacity based on distance (1.0 at ground level, 0.0 at maxDistance)
          const opacity = 1.0 - (distance / this.maxDistance);
          
          // Calculate shadow scale (inverse relationship with height)
          // Higher = smaller shadow, closer = larger shadow
          const scale = 1.0 - (0.5 * distance / this.maxDistance);
          
          // Update shadow position
          this.shadowMesh.position.x = playerPosition.x;
          this.shadowMesh.position.z = playerPosition.z;
          this.shadowMesh.position.y = result.hitPointWorld.y + 0.01; // Slightly above ground
          
          // Update shadow opacity
          this.shadowMesh.material.opacity = opacity;
          
          // Update shadow scale
          this.shadowMesh.scale.set(scale, scale, 1);
          
          // Make shadow visible
          this.shadowMesh.visible = true;
        } else {
          // Hide shadow if too far
          this.shadowMesh.visible = false;
        }
      } else {
        // Hide shadow if we hit the player's own body
        this.shadowMesh.visible = false;
      }
    } else {
      // No ground detected, hide shadow
      this.shadowMesh.visible = false;
    }
    
    // If player is not jumping and is grounded, ensure shadow is visible and at full opacity
    if (!isJumping && isGrounded) {
      this.shadowMesh.visible = true;
      this.shadowMesh.material.opacity = 0.9; // Increased opacity for ground shadow
      this.shadowMesh.scale.set(1, 1, 1);     // Full shadow scale
      
      // Position directly below player with a fixed offset
      this.shadowMesh.position.x = playerPosition.x;
      this.shadowMesh.position.z = playerPosition.z;
      
      // Use raycast result for more accurate ground positioning when available
      // Otherwise use a fixed offset
      if (result.hasHit) {
        this.shadowMesh.position.y = result.hitPointWorld.y + 0.02; // Slightly higher to prevent z-fighting
      } else {
        this.shadowMesh.position.y = playerPosition.y - 0.6 + 0.02; // Player radius + slight offset
      }
    }
  }
  
  // Clean up method
  dispose() {
    if (this.shadowMesh) {
      this.scene.remove(this.shadowMesh);
      this.shadowMesh.geometry.dispose();
      this.shadowMesh.material.dispose();
      if (this.shadowTexture) {
        this.shadowTexture.dispose();
      }
    }
  }
}