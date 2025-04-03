// Portal.js
import * as THREE from '/static/three.module.min.js';
import * as CANNON from '/dist/cannon-es.js';

export class Portal {
  constructor(scene, world, params = {}) {
    this.scene = scene;
    this.world = world;

    // Default parameters
    this.params = {
      type: 'exit', // 'exit' or 'entry'
      position: new THREE.Vector3(-20, 25, -35), // Default position
      rotation: new THREE.Euler(0, 0, 0),
      color: params.type === 'entry' ? 0xff0000 : 0x00ff00, // Red for entry, Green for exit
      radius: 5,
      destination: 'https://portal.pieter.com',
      label: params.type === 'entry' ? 'RETURN PORTAL' : 'VIBEVERSE PORTAL',
      refUrl: '', // For entry portals: the URL to return to
      ...params
    };

    // Portal group to contain all elements
    this.portalGroup = new THREE.Group();
    this.portalGroup.position.copy(this.params.position);
    this.portalGroup.rotation.copy(this.params.rotation);

    // Collision detection
    this.collisionShape = null;
    this.boundingBox = null;
    this.collisionBody = null;

    // Create portal visuals and collision
    this.createPortal();
  }

  createPortal() {
    const { radius, color, label } = this.params;

    // Create torus (ring)
    const ringGeometry = new THREE.TorusGeometry(radius, radius * 0.2, 16, 100);
    const ringMaterial = new THREE.MeshPhongMaterial({
      color: color,
      emissive: color,
      transparent: true,
      opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    this.portalGroup.add(ring);

    // Create inner surface
    const innerGeometry = new THREE.CircleGeometry(radius * 0.85, 32);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const inner = new THREE.Mesh(innerGeometry, innerMaterial);
    this.portalGroup.add(inner);

    // Create label
    if (label) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 512;
      canvas.height = 64;
      context.fillStyle = color === 0xff0000 ? '#ff0000' : '#00ff00';
      context.font = 'bold 32px Arial';
      context.textAlign = 'center';
      context.fillText(label, canvas.width/2, canvas.height/2);

      const texture = new THREE.CanvasTexture(canvas);
      const labelGeometry = new THREE.PlaneGeometry(radius * 2.5, radius * 0.5);
      const labelMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide
      });

      const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
      labelMesh.position.y = radius * 1.5;
      this.portalGroup.add(labelMesh);
    }

    // Create particles
    this.createParticles(color);

    // Add to scene
    this.scene.add(this.portalGroup);

    // Set up collision detection
    this.setupCollision();

    // Start animation
    this.animate();
  }

  createParticles(color) {
    const particleCount = 500;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const radius = this.params.radius;

    for (let i = 0; i < particleCount * 3; i += 3) {
      // Create particles in a ring pattern
      const angle = Math.random() * Math.PI * 2;
      const r = radius + (Math.random() - 0.5) * (radius * 0.5);

      particlePositions[i] = Math.cos(angle) * r;
      particlePositions[i + 1] = Math.sin(angle) * r;
      particlePositions[i + 2] = (Math.random() - 0.5) * 2;

      // Set color based on portal type
      if (color === 0xff0000) { // Red (entry portal)
        particleColors[i] = 0.8 + Math.random() * 0.2;
        particleColors[i + 1] = 0;
        particleColors[i + 2] = 0;
      } else { // Green (exit portal)
        particleColors[i] = 0;
        particleColors[i + 1] = 0.8 + Math.random() * 0.2;
        particleColors[i + 2] = 0;
      }
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.6
    });

    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.portalGroup.add(this.particles);
  }

  setupCollision() {
    // Create a simple spherical collision shape for the portal
    this.collisionShape = new CANNON.Sphere(this.params.radius * 0.8);

    // Create a body with zero mass (static)
    this.collisionBody = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(
        this.params.position.x,
        this.params.position.y,
        this.params.position.z
      ),
      shape: this.collisionShape,
      collisionResponse: false, // Don't respond physically to collisions
      cameraCollidable: false // Don't block camera
    });

    // Mark as a portal for collision filtering
    this.collisionBody.portalType = this.params.type;
    this.collisionBody.destination = this.params.destination;
    this.collisionBody.refUrl = this.params.refUrl;

    // Add to physics world
    this.world.addBody(this.collisionBody);

    // Create bounding box for Three.js intersection tests
    this.boundingBox = new THREE.Box3().setFromObject(this.portalGroup);
  }

  animate() {
    // We'll call this method from the main animation loop
    if (!this.particles) return;

    const positions = this.particles.geometry.attributes.position.array;

    for (let i = 0; i < positions.length; i += 3) {
      // Create flowing motion for particles
      positions[i + 1] += 0.03 * Math.sin(Date.now() * 0.001 + i);
    }

    this.particles.geometry.attributes.position.needsUpdate = true;

    // Update bounding box
    this.boundingBox.setFromObject(this.portalGroup);
  }

  // Check if a player is inside this portal
  checkPlayerCollision(playerPosition, playerRadius) {
    if (!this.collisionBody) return false;

    const distance = new THREE.Vector3(
      playerPosition.x - this.params.position.x,
      playerPosition.y - this.params.position.y,
      playerPosition.z - this.params.position.z
    ).length();

    // Return true if player is inside portal (with some margin)
    return distance < (this.params.radius * 0.7 + playerRadius);
  }

  // Get destination URL for this portal with appropriate parameters
  getDestinationUrl(playerData) {
    const baseUrl = this.params.destination;

    // Create URL params
    const urlParams = new URLSearchParams();
    urlParams.append('portal', 'true');

    // Add player data
    if (playerData) {
      if (playerData.username) urlParams.append('username', playerData.username);
      if (playerData.color) urlParams.append('color', playerData.color);
      if (playerData.speed) urlParams.append('speed', playerData.speed);
    }

    // For exit portals, add current page as ref
    if (this.params.type === 'exit') {
      urlParams.append('ref', window.location.hostname + window.location.pathname);
    } 
    // For entry portals, use the stored refUrl
    else if (this.params.type === 'entry' && this.params.refUrl) {
      urlParams.append('ref', this.params.refUrl);
    }

    // Build full URL
    return baseUrl + '?' + urlParams.toString();
  }

  dispose() {
    // Remove from physics world
    if (this.collisionBody) {
      this.world.removeBody(this.collisionBody);
    }

    // Remove from scene
    if (this.portalGroup) {
      this.scene.remove(this.portalGroup);

      // Dispose geometries and materials
      this.portalGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
  }
}