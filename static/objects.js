import * as CANNON from '/dist/cannon-es.js';
import * as THREE from '/static/three.module.min.js';
import { Portal } from './Portal.js';

export class GameObjects {
  constructor(scene, world, physicsMaterial) {
    this.scene = scene;
    this.world = world;
    this.physicsMaterial = physicsMaterial;

    // Mushroom-related properties
    this.mushrooms = [];
    this.maxMushrooms = 3;
    this.mushroomGeometries = {};
    this.mushroomMaterials = {};

    // Portal-related properties
    this.portals = [];
    this.exitPortal = null;
    this.entryPortal = null;
  }

  // Method to initialize any game objects
  init() {
    console.log("GameObjects initialized");

    // Initialize mushroom geometries and materials
    this.initMushroomAssets();

    // Setup portals
    this.setupPortals();
    
    // Create sign post
    this.createSignPost();
    console.log("Sign post created");
  }

  // Initialize mushroom geometries and materials
  initMushroomAssets() {
    // Cap geometry - half sphere
    const capGeometry = new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);

    // Stem geometry - scaled cylinder
    const stemGeometry = new THREE.CylinderGeometry(0.2, 0.3, 0.5, 12);

    // Store geometries for later use
    this.mushroomGeometries.cap = capGeometry;
    this.mushroomGeometries.stem = stemGeometry;

    // Create materials with some subsurface scattering effect for the mushroom
    this.mushroomMaterials.cap = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 30,
      specular: 0x333333
    });

    this.mushroomMaterials.stem = new THREE.MeshPhongMaterial({
      color: 0xdddddd,
      shininess: 10,
      specular: 0x222222
    });
  }

  // Setup portals based on URL parameters
  setupPortals() {
    // Check URL for portal parameters
    const urlParams = new URLSearchParams(window.location.search);
    const cameFromPortal = urlParams.has('portal') && urlParams.get('portal') === 'true';
    const refUrl = urlParams.get('ref');

    // Always create an exit portal
    this.createExitPortal();

    // If player came through a portal, create an entry portal back to where they came from
    if (cameFromPortal && refUrl) {
      this.createEntryPortal(refUrl);
    }
  }

  // Create exit portal (to portal.pieter.com)
  createExitPortal() {
    // Create exit portal in a good location
    const portalParams = {
      type: 'exit',
      position: new THREE.Vector3(-20, 25, -35), // Choose appropriate position
      rotation: new THREE.Euler(0, Math.PI / 6, 0), // Slightly angled
      radius: 5,
      destination: 'https://portal.pieter.com',
      label: 'VIBEVERSE PORTAL'
    };

    this.exitPortal = new Portal(this.scene, this.world, portalParams);
    this.portals.push(this.exitPortal);

    console.log("Exit portal created");
    return this.exitPortal;
  }

  // Create entry portal (to return to the previous game)
  createEntryPortal(refUrl) {
    // Get spawn point parameters - typically near where player starts
    const spawnPosition = new THREE.Vector3(15, 25, 15); // Position near starting area

    // Format the ref URL properly
    let destination = refUrl;
    if (!destination.startsWith('http://') && !destination.startsWith('https://')) {
      destination = 'https://' + destination;
    }

    const portalParams = {
      type: 'entry',
      position: spawnPosition,
      rotation: new THREE.Euler(0, -Math.PI / 4, 0),
      radius: 5,
      destination: destination,
      refUrl: refUrl,
      label: 'RETURN PORTAL'
    };

    this.entryPortal = new Portal(this.scene, this.world, portalParams);
    this.portals.push(this.entryPortal);

    console.log("Entry portal created with destination:", destination);
    return this.entryPortal;
  }

  // Check if player has entered any portal
  checkPortalCollisions(player) {
    if (!player || !player.sphereBody) return null;

    // Get player position and radius
    const playerPosition = player.sphereBody.position;
    const playerRadius = player.sphereShape.radius;

    // Check each portal
    for (const portal of this.portals) {
      if (portal.checkPlayerCollision(playerPosition, playerRadius)) {
        // Player is in a portal - return the portal
        return portal;
      }
    }

    return null;
  }

  // Create a mushroom at a specific position
  createMushroom(position) {
    // Create a group to hold all parts of the mushroom
    const mushroom = new THREE.Group();

    // Create cap
    const cap = new THREE.Mesh(this.mushroomGeometries.cap, this.mushroomMaterials.cap);
    cap.position.y = 0.5; // Position cap above stem
    mushroom.add(cap);

    // Create stem
    const stem = new THREE.Mesh(this.mushroomGeometries.stem, this.mushroomMaterials.stem);
    stem.position.y = 0.25; // Position stem at half its height
    mushroom.add(stem);

    // Position the entire mushroom
    mushroom.position.copy(position);

    // Add some random rotation around Y axis
    mushroom.rotation.y = Math.random() * Math.PI * 2;

    // Add some random scale variation (0.7 to 1.3)
    const scale = 0.7 + Math.random() * 0.6;
    mushroom.scale.set(scale, scale, scale);

    // Create physics body for collision detection
    const mushroomShape = new CANNON.Sphere(0.4 * scale); // Simplify collision to a sphere
    const mushroomBody = new CANNON.Body({
      mass: 0, // Static body
      position: new CANNON.Vec3(position.x, position.y, position.z),
      material: this.physicsMaterial
    });
    mushroomBody.addShape(mushroomShape);

    // Store reference to the mesh in the body for easy access during collision
    mushroomBody.userData = { type: 'mushroom', mesh: mushroom, id: Date.now() };

    // Add to physics world
    this.world.addBody(mushroomBody);

    // Add to scene
    this.scene.add(mushroom);

    // Store mushroom data
    this.mushrooms.push({
      mesh: mushroom,
      body: mushroomBody,
      id: mushroomBody.userData.id,
      createdAt: Date.now()
    });

    return mushroom;
  }

  // Find a valid position to spawn a mushroom on terrain surface
  findMushroomPosition(terrainMeshes) {
    // Try to find a valid position, with a maximum number of attempts
    const maxAttempts = 50;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Pick a random position within terrain bounds (assuming terrain is roughly centered at origin)
      const terrainSize = 80; // Approximate terrain size
      const randomX = (Math.random() - 0.5) * terrainSize;
      const randomZ = (Math.random() - 0.5) * terrainSize;

      // Start from a high position and raytrace down to find the surface
      const rayStart = new THREE.Vector3(randomX, 100, randomZ);
      const rayDir = new THREE.Vector3(0, -1, 0);
      const raycaster = new THREE.Raycaster(rayStart, rayDir);

      // Check for intersections with terrain
      const terrains = [terrainMeshes.flat, terrainMeshes.pit];
      if (terrainMeshes.mountain) {
        terrains.push(terrainMeshes.mountain);
      }

      // Filter out null values
      const validTerrains = terrains.filter(terrain => terrain !== null);

      // Get intersections with terrains
      const intersects = raycaster.intersectObjects(validTerrains);

      if (intersects.length > 0) {
        // Found a valid position on terrain
        const intersectionPoint = intersects[0].point;

        // Add a small offset to avoid z-fighting
        intersectionPoint.y += 0.05;

        // Check if this point is too close to other mushrooms
        const tooClose = this.mushrooms.some(mushroom => {
          const distance = mushroom.mesh.position.distanceTo(intersectionPoint);
          return distance < 5; // Minimum distance between mushrooms
        });

        // Also check if too close to portals
        const tooCloseToPortal = this.portals.some(portal => {
          const distance = portal.portalGroup.position.distanceTo(intersectionPoint);
          return distance < 10; // Minimum distance from portals
        });

        if (!tooClose && !tooCloseToPortal) {
          return intersectionPoint;
        }
      }
    }

    // If we couldn't find a valid position after max attempts, return null
    return null;
  }

  // Spawn a mushroom at a random position on terrain
  spawnRandomMushroom(terrainMeshes) {
    // Check if we're already at max mushrooms
    if (this.mushrooms.length >= this.maxMushrooms) {
      return null;
    }

    // Find a valid position
    const position = this.findMushroomPosition(terrainMeshes);

    if (position) {
      // Create and return the mushroom
      return this.createMushroom(position);
    }

    return null;
  }

  // Remove a mushroom from the scene and physics world
  removeMushroom(mushroomId) {
    const index = this.mushrooms.findIndex(m => m.id === mushroomId);

    if (index !== -1) {
      const mushroom = this.mushrooms[index];

      // Remove from scene
      this.scene.remove(mushroom.mesh);

      // Remove from physics world
      this.world.removeBody(mushroom.body);

      // Remove from our array
      this.mushrooms.splice(index, 1);

      return true;
    }

    return false;
  }

  // Update method called on each animation frame
  update() {
    // Update portal animations
    for (const portal of this.portals) {
      portal.animate();
    }
  }

  // Create sign post with text "EAT THE MUSHROOMS!"
  // Create sign post with text "EAT THE MUSHROOMS!"
  createSignPost() {
    // Create geometries from the JSON specification
    const plankGeometry = new THREE.BoxGeometry(2.5, 1.0, 0.1);
    const postGeometry = new THREE.BoxGeometry(0.2, 1.5, 0.2);

    // Create materials
    const brownMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });

    // Create the sign post group
    const signPost = new THREE.Group();

    // Create the post
    const post = new THREE.Mesh(postGeometry, brownMaterial);
    post.position.set(0, -0.75, 0);
    signPost.add(post);

    // Create the plank
    const plank = new THREE.Mesh(plankGeometry, brownMaterial);
    plank.position.set(0, 0.5, 0);
    plank.rotation.x = 0.1; // Slight tilt
    signPost.add(plank);

    // Create a fixed text plane on the back side with three lines
    const createTextPlane = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 512;
      canvas.height = 256; // Taller for three lines

      // Draw background (transparent)
      context.fillStyle = 'rgba(0, 0, 0, 0)';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Draw text in three lines
      context.font = 'Bold 60px Arial';
      context.fillStyle = 'white';
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      // Draw each line of text
      context.fillText("EAT", canvas.width / 2, canvas.height / 4);
      context.fillText("THE", canvas.width / 2, canvas.height / 2);
      context.fillText("MUSHROOMS!", canvas.width / 2, 3 * canvas.height / 4);

      // Create texture
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;

      // Create material - only visible from front side (default)
      const textMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true
      });

      // Create a plane for the text (taller for three lines)
      const textGeometry = new THREE.PlaneGeometry(2.2, 0.9);
      const textPlane = new THREE.Mesh(textGeometry, textMaterial);

      return textPlane;
    };

    // Create text plane and place it on the back side of the plank
    const textPlane = createTextPlane();
    // Position slightly behind the plank, facing backward (negative z direction)
    textPlane.position.set(0, 0, -0.06);
    // Rotate 180 degrees around y-axis to face the back side
    textPlane.rotation.y = Math.PI;
    plank.add(textPlane);

    // Create collision body for the sign post
    const signShape = new CANNON.Box(new CANNON.Vec3(0.1, 0.75, 0.1));
    const signBody = new CANNON.Body({
      mass: 0, // Static body
      material: this.physicsMaterial
    });
    signBody.addShape(signShape);

    // Position the sign in the game world
    signPost.position.set(70, 22, -70); // Positioned further away on X and Z axes
    signBody.position.copy(signPost.position);

    // Rotate the sign by 120 degrees clockwise (which is -120 degrees in Three.js)
    // Convert to radians: degrees * (Math.PI / 180)
    const rotationAngle = -170 * (Math.PI / 180);
    signPost.rotation.y = rotationAngle;

    // Add to physics world and scene
    this.world.addBody(signBody);
    this.scene.add(signPost);

    // Store reference to the sign post
    this.signPost = {
      mesh: signPost,
      body: signBody,
      textPlane: textPlane
    };

    return signPost;
  }

  // Update method called on each animation frame
  update() {
    // Will handle updating object positions and rotations
    // Mushrooms are static, so no need to update positions

    // Rotate sign text to face camera if needed
    if (this.signPost && this.signPost.mesh) {
      // Animation could be added here
    }
  }

  // Clean up all objects
  dispose() {
    // Clear all mushrooms
    while (this.mushrooms.length > 0) {
      this.removeMushroom(this.mushrooms[0].id);
    }

    // Clean up portals
    for (const portal of this.portals) {
      portal.dispose();
    }
    this.portals = [];
    this.exitPortal = null;
    this.entryPortal = null;
  }
}