import * as CANNON from '/dist/cannon-es.js';
import * as THREE from '/static/three.module.min.js';

//import { VertexNormalsHelper } from 'https://unpkg.com/three@0.174.0/examples/jsm/helpers/VertexNormalsHelper.js?module';

import { CloudManager } from './cloud-manager.js'; 

export class WorldManager {
  constructor(scene) {
    this.scene = scene;
    this.world = null;
    this.materials = {
      physics: null,
      flat: null,
      pit: null,
      mountain: null // Add mountain material
    };
    this.terrainMeshes = {
      flat: null,
      pit: null,
      mountain: null // Add mountain mesh reference
    };
    this.sunLight = null;
    this.sunMesh = null;
    this.cloudManager = new CloudManager(scene);
  }

  // Initialize the physics world
  initPhysics() {
    this.world = new CANNON.World();

    // Tweak contact properties
    this.world.defaultContactMaterial.contactEquationStiffness = 1e9;
    this.world.defaultContactMaterial.contactEquationRelaxation = 4;

    const solver = new CANNON.GSSolver();
    solver.iterations = 4; // Increase solver iterations for better stability
    solver.tolerance = 0.01;
    this.world.solver = new CANNON.SplitSolver(solver);

    this.world.gravity.set(0, -20, 0);
    
    // Better broadphase for complex terrain
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    // Create physics materials
    this.materials.physics = new CANNON.Material('physics');
    this.materials.flat = new CANNON.Material('flat');
    this.materials.pit = new CANNON.Material('pit');
    this.materials.mountain = new CANNON.Material('mountain'); // Add mountain material
    
    // Set up material contacts
    this.setupMaterialContacts();

    this.terrainYOffset = 21; // "lift" every object up by this offset (16)
    
    return this.world;
  }

  // Set up material contacts
  setupMaterialContacts() {
    // Physics-physics contact
    const physics_physics = new CANNON.ContactMaterial(
      this.materials.physics, this.materials.physics, {
        friction: 0.5,
        restitution: 0,
      }
    );
    
    // Flat terrain contact materials
    const flatMaterial_flatMaterial = new CANNON.ContactMaterial(
      this.materials.flat, this.materials.flat, {
        friction: 0.5,
        restitution: 0  //0.3
      }
    );
    
    // Pit terrain contact materials
    const pitMaterial_pitMaterial = new CANNON.ContactMaterial(
      this.materials.pit, this.materials.pit, {
        friction: 0.1, // More slippery
        restitution: 0  //0.2
      }
    );
    
    // Mountain terrain contact materials
    const mountainMaterial_mountainMaterial = new CANNON.ContactMaterial(
      this.materials.mountain, this.materials.mountain, {
        friction: 0.5, // As specified
        restitution: 0  // As specified
      }
    );
    
    // Player interaction with different terrains
    const physics_flat = new CANNON.ContactMaterial(
      this.materials.physics, this.materials.flat, {
        friction: 0.5,
        restitution: 0,
      }
    );
    
    const physics_pit = new CANNON.ContactMaterial(
      this.materials.physics, this.materials.pit, {
        friction: 0.1,
        restitution: 0,
      }
    );
    
    // Add physics-mountain contact material
    const physics_mountain = new CANNON.ContactMaterial(
      this.materials.physics, this.materials.mountain, {
        friction: 0.5,
        restitution: 0,
      }
    );
    
    // Add contact materials to world
    this.world.addContactMaterial(physics_physics);
    this.world.addContactMaterial(flatMaterial_flatMaterial);
    this.world.addContactMaterial(pitMaterial_pitMaterial);
    this.world.addContactMaterial(mountainMaterial_mountainMaterial);
    this.world.addContactMaterial(physics_flat);
    this.world.addContactMaterial(physics_pit);
    this.world.addContactMaterial(physics_mountain);
  }

  // Load terrain data and create physics bodies and visual meshes
  async loadTerrain() {
    try {
      const response = await fetch('/static/terrain_separate_r128_d18_rad20.json');
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      
      const terrainData = await response.json();
      console.log("Terrain data loaded, processing with separate vertex arrays...");
      
      // Create separate vertex arrays for flat, pit, and mountain parts
      const flatVertices = [];
      const pitVertices = [];
      let mountainVertices = []; // Add mountain vertices array
      
      const flatIndicesMap = new Map(); // Maps original vertex index to new flat vertex index
      const pitIndicesMap = new Map();  // Maps original vertex index to new pit vertex index
      const mountainIndicesMap = new Map(); // Maps original vertex index to new mountain vertex index
      
      // Process flat terrain indices
      const newFlatIndices = [];
      
      for (let i = 0; i < terrainData.flatIndices.length; i += 3) {
        const i1 = terrainData.flatIndices[i];
        const i2 = terrainData.flatIndices[i + 1];
        const i3 = terrainData.flatIndices[i + 2];
        
        // For each vertex in this triangle, add it to the flat vertices array if not already added
        for (const idx of [i1, i2, i3]) {
          if (!flatIndicesMap.has(idx)) {
            // Get original vertex position
            const x = terrainData.vertices[idx * 3];
            const y = terrainData.vertices[idx * 3 + 1];
            const z = terrainData.vertices[idx * 3 + 2];
            
            // Add to flat vertices array
            flatVertices.push(x, y, z);
            flatIndicesMap.set(idx, flatVertices.length / 3 - 1);
          }
        }
        
        // Add remapped indices to new flat indices array
        newFlatIndices.push(
          flatIndicesMap.get(i1),
          flatIndicesMap.get(i2),
          flatIndicesMap.get(i3)
        );
      }
      
      // Process pit terrain indices
      const newPitIndices = [];
      
      for (let i = 0; i < terrainData.pitIndices.length; i += 3) {
        const i1 = terrainData.pitIndices[i];
        const i2 = terrainData.pitIndices[i + 1];
        const i3 = terrainData.pitIndices[i + 2];
        
        // For each vertex in this triangle, add it to the pit vertices array if not already added
        for (const idx of [i1, i2, i3]) {
          if (!pitIndicesMap.has(idx)) {
            // Get original vertex position
            const x = terrainData.vertices[idx * 3];
            const y = terrainData.vertices[idx * 3 + 1];
            const z = terrainData.vertices[idx * 3 + 2];
            
            // Add to pit vertices array
            pitVertices.push(x, y, z);
            pitIndicesMap.set(idx, pitVertices.length / 3 - 1);
          }
        }
        
        // Add remapped indices to new pit indices array
        newPitIndices.push(
          pitIndicesMap.get(i1),
          pitIndicesMap.get(i2),
          pitIndicesMap.get(i3)
        );
      }
      
      // Process mountain terrain indices and handle decimated vertices
      let newMountainIndices = [];
      let hasMountainData = false;
      
      // Check for decimated mountain vertices and indices first
      if (terrainData.mountainVertices && terrainData.mountainIndices) {
        console.log("Loading decimated mountain mesh data");
        // Directly use the provided decimated vertices and indices
        mountainVertices = terrainData.mountainVertices;
        newMountainIndices = terrainData.mountainIndices;
        hasMountainData = true;
      }
      // Fallback to original mountain indices if decimated data is not available
      else if (terrainData.mountainIndices && terrainData.mountainIndices.length > 0) {
        console.log("Loading standard mountain mesh data (non-decimated)");
        
        for (let i = 0; i < terrainData.mountainIndices.length; i += 3) {
          const i1 = terrainData.mountainIndices[i];
          const i2 = terrainData.mountainIndices[i + 1];
          const i3 = terrainData.mountainIndices[i + 2];
          
          // For each vertex in this triangle, add it to the mountain vertices array if not already added
          for (const idx of [i1, i2, i3]) {
            if (!mountainIndicesMap.has(idx)) {
              // Get original vertex position
              const x = terrainData.vertices[idx * 3];
              const y = terrainData.vertices[idx * 3 + 1];
              const z = terrainData.vertices[idx * 3 + 2];
              
              // Add to mountain vertices array
              mountainVertices.push(x, y, z);
              mountainIndicesMap.set(idx, mountainVertices.length / 3 - 1);
            }
          }
          
          // Add remapped indices to new mountain indices array
          newMountainIndices.push(
            mountainIndicesMap.get(i1),
            mountainIndicesMap.get(i2),
            mountainIndicesMap.get(i3)
          );
        }
        
        hasMountainData = true;
      }
      
      console.log("Generated separate vertex arrays:");
      console.log("- Flat: " + flatVertices.length / 3 + " vertices, " + newFlatIndices.length / 3 + " triangles");
      console.log("- Pit: " + pitVertices.length / 3 + " vertices, " + newPitIndices.length / 3 + " triangles");
      
      if (hasMountainData) {
        console.log("- Mountain: " + mountainVertices.length / 3 + " vertices, " + newMountainIndices.length / 3 + " triangles");
        
        // Log additional mountain metadata
        if (terrainData.metadata) {
          console.log("- Mountain Y Decimation: " + 
            (terrainData.metadata.mountainYDecimation || "Not specified"));
          console.log("- Mountain Base Z Noise: " + 
            (terrainData.metadata.baseZNoiseAmount || "Not specified"));
        }
      } else {
        console.log("- Mountain: No mountain data found in terrain file");
      }
      
      // Create physics bodies using separate vertex arrays
      this.createTerrainPhysics({
        flatVertices,
        flatIndices: newFlatIndices,
        pitVertices,
        pitIndices: newPitIndices,
        mountainVertices,
        mountainIndices: newMountainIndices,
        hasMountainData
      });
      
      // Create visual representation using separate vertex arrays
      this.createTerrainVisuals({
        flatVertices,
        flatIndices: newFlatIndices,
        pitVertices,
        pitIndices: newPitIndices,
        mountainVertices,
        mountainIndices: newMountainIndices,
        hasMountainData
      });
      
      // Store mountain parameters from metadata if available
      if (terrainData.metadata && terrainData.metadata.mountainEnabled) {
        this.mountainParameters = {
          enabled: terrainData.metadata.mountainEnabled,
          roughness: terrainData.metadata.mountainRoughness,
          height: terrainData.metadata.mountainHeight,
          width: terrainData.metadata.mountainWidth,
          position: terrainData.metadata.mountainPosition,
          detail: terrainData.metadata.mountainDetail,
          seed: terrainData.metadata.mountainSeed,
          yDecimation: terrainData.metadata.mountainYDecimation || 1,
          baseZNoise: terrainData.metadata.baseZNoiseAmount || 0
        };
        console.log("Mountain parameters loaded:", this.mountainParameters);

        // Generate clouds based on terrain size and mountain position
        const terrainSize = terrainData.metadata.size || 150;
        this.initClouds(terrainSize, this.mountainParameters.position);
      }
      
      console.log("Terrain setup complete with separate vertex arrays");
      return true;
    } catch (error) {
      console.error("Error loading terrain:", error);
      throw error;
    }
  }

  
// Add this new method to initialize clouds
  initClouds(terrainSize, mountainPosition) {
    console.log("Generating clouds around terrain...");
    this.cloudManager.initClouds(terrainSize, mountainPosition);
    console.log("Cloud generation complete");
  }


  // Create terrain physics bodies
  createTerrainPhysics(terrainData) {
    // Create the flat terrain part with its own vertices
    console.log("Creating flat terrain trimesh with separate vertex array");
    const flatShape = new CANNON.Trimesh(
      terrainData.flatVertices,
      terrainData.flatIndices
    );
    
    const flatBody = new CANNON.Body({
      mass: 0,
      material: this.materials.flat
    });
    flatBody.addShape(flatShape);

    flatBody.position.set(0, this.terrainYOffset, 0);
    this.world.addBody(flatBody);
    
    // Create the pit terrain part with its own vertices
    console.log("Creating pit terrain trimesh with separate vertex array");
    const pitShape = new CANNON.Trimesh(
      terrainData.pitVertices,
      terrainData.pitIndices
    );
    
    const pitBody = new CANNON.Body({
      mass: 0,
      material: this.materials.pit
    });
    pitBody.addShape(pitShape);

    // Add debug collision detection for the pit
    if (window.physicsDebugger) {
      // Store references for collision handling
      this.pitBody = pitBody;
      this.setupCollisionEvents();
    }

    pitBody.position.set(0, this.terrainYOffset, 0);
    this.world.addBody(pitBody);
    
    // Create the mountain terrain part if data is available
    if (terrainData.hasMountainData && terrainData.mountainIndices.length > 0) {
      console.log("Creating mountain terrain trimesh with" + 
        (terrainData.mountainVertices ? " decimated" : " standard") + " vertex array");
      
      const mountainShape = new CANNON.Trimesh(
        terrainData.mountainVertices,
        terrainData.mountainIndices
      );
      
      const mountainBody = new CANNON.Body({
        mass: 0,
        material: this.materials.mountain
      });
      mountainBody.addShape(mountainShape);
      
      // Store reference to mountain body (but no collision events for now as specified)
      this.mountainBody = mountainBody;
      
      mountainBody.position.set(0, this.terrainYOffset, 0);
      this.world.addBody(mountainBody);
      
      console.log("Mountain physics body created");
    }
  }

  // Create visual meshes for terrain
  createTerrainVisuals(terrainData) {
    console.log("Creating terrain visual meshes with separate vertex arrays");
    
    // Materials for terrain
    const flatMaterial = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
    const pitMaterial = new THREE.MeshLambertMaterial({ color: 0xE6C78F });
    //const mountainMaterial = new THREE.MeshLambertMaterial({ color: 0x9D711B }); // Brown color for mountain
    
const mountainMaterial = new THREE.MeshPhongMaterial({ 
  color: 0x826B40,  //0x9D711B,
  shininess: 3,
  flatShading: true 
}); // Changed to Phong material with flatShading

    // Create geometries using separate vertex arrays
    const flatGeometry = new THREE.BufferGeometry();
    flatGeometry.setAttribute('position', 
      new THREE.Float32BufferAttribute(terrainData.flatVertices, 3));
    flatGeometry.setIndex(terrainData.flatIndices);
    flatGeometry.computeVertexNormals();
    
    const pitGeometry = new THREE.BufferGeometry();
    pitGeometry.setAttribute('position', 
      new THREE.Float32BufferAttribute(terrainData.pitVertices, 3));
    pitGeometry.setIndex(terrainData.pitIndices);
    pitGeometry.computeVertexNormals();
    
    // Create meshes with materials
    this.terrainMeshes.flat = new THREE.Mesh(flatGeometry, flatMaterial);
    this.terrainMeshes.pit = new THREE.Mesh(pitGeometry, pitMaterial);
    
    // Setup shadows
    this.terrainMeshes.flat.castShadow = true;
    this.terrainMeshes.flat.receiveShadow = true;
    this.terrainMeshes.pit.castShadow = true;
    this.terrainMeshes.pit.receiveShadow = true;
    
    // Add to scene
    this.terrainMeshes.flat.position.y = this.terrainYOffset;
    this.terrainMeshes.pit.position.y = this.terrainYOffset;
    this.scene.add(this.terrainMeshes.flat);
    this.scene.add(this.terrainMeshes.pit);
    
    // Create mountain mesh if data is available
    if (terrainData.hasMountainData && terrainData.mountainIndices.length > 0) {
      const mountainGeometry = new THREE.BufferGeometry();
      mountainGeometry.setAttribute('position', 
        new THREE.Float32BufferAttribute(terrainData.mountainVertices, 3));
      mountainGeometry.setIndex(terrainData.mountainIndices);
      mountainGeometry.computeVertexNormals();
      
      this.terrainMeshes.mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
      this.terrainMeshes.mountain.castShadow = true;
      this.terrainMeshes.mountain.receiveShadow = true;
      
      this.terrainMeshes.mountain.position.y = this.terrainYOffset;
      this.scene.add(this.terrainMeshes.mountain);
      
      console.log("Mountain visual mesh created");
    }
  }

  // Add this method to handle collision events
  setupCollisionEvents() {
    // Add world collision event listener
    this.world.addEventListener('beginContact', (event) => {
      if (!window.physicsDebugger || !window.physicsDebugger.enabled) return;
      
      // Check if the collision involves the pit body and player body
      const bodyA = event.bodyA;
      const bodyB = event.bodyB;
      
      const isPitInvolved = (bodyA === this.pitBody || bodyB === this.pitBody);
      const isPlayerInvolved = (bodyA === this.playerBody || bodyB === this.playerBody);
      
      if (isPitInvolved && isPlayerInvolved) {
        // Get the contact points and normals
        const contacts = event.contacts;
        
        if (contacts && contacts.length > 0) {
          // Use the first contact point
          const contact = contacts[0];
          
          // Determine which body is which
          const isPitBodyA = bodyA === this.pitBody;
          
          // Get the contact position
          const contactPoint = new THREE.Vector3(
            contact.ri.x + (isPitBodyA ? bodyA.position.x : bodyB.position.x),
            contact.ri.y + (isPitBodyA ? bodyA.position.y : bodyB.position.y),
            contact.ri.z + (isPitBodyA ? bodyA.position.z : bodyB.position.z)
          );
          
          // Get the contact normal
          const contactNormal = new THREE.Vector3(
            contact.ni.x,
            contact.ni.y,
            contact.ni.z
          );
          
          // Visualize the contact
          window.physicsDebugger.addDebugVector(
            contactPoint,
            contactNormal,
            2,
            0xff0000, // Red for pit collisions
            `pit_collision_${Date.now()}` // Unique name
          );
        }
      }
    });
  }

  // Set up lighting including sun
  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.99);
    this.scene.add(ambientLight);

    // Spotlight
    const spotlight = new THREE.SpotLight(0xffffff, 0.9, 0, Math.PI / 4, 1);
    spotlight.position.set(10, 30, 20);
    spotlight.target.position.set(0, 0, 0);
    spotlight.castShadow = true;
    spotlight.shadow.camera.near = 10;
    spotlight.shadow.camera.far = 100;
    spotlight.shadow.camera.fov = 30;
    spotlight.shadow.mapSize.width = 2048;
    spotlight.shadow.mapSize.height = 2048;
    this.scene.add(spotlight);
    
    // Calculate new sun position (twice as far but same angle)
    const oldSunPos = new THREE.Vector3(50, 80, 50);
    const sunDistance = oldSunPos.length();
    const newSunPos = oldSunPos.clone().normalize().multiplyScalar(sunDistance * 2);
    
    // Directional light (sun)
    this.sunLight = new THREE.DirectionalLight(0xffffaa, 2.5);
    this.sunLight.position.set(newSunPos.x, newSunPos.y, newSunPos.z);
    this.sunLight.castShadow = true;
    
    const targetObject = new THREE.Object3D();
    this.scene.add(targetObject);
    targetObject.position.set(0, 0, 0);
    this.sunLight.target = targetObject;
    
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    
    // Adjust shadow camera params for the increased distance
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 400; // Increased from 200 to account for greater distance
    this.sunLight.shadow.camera.left = -100; // Increased from -50
    this.sunLight.shadow.camera.right = 100; // Increased from 50
    this.sunLight.shadow.camera.top = 100; // Increased from 50
    this.sunLight.shadow.camera.bottom = -100; // Increased from -50
    
    this.scene.add(this.sunLight);
    
    // Visual sun
    const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sunMesh.position.copy(this.sunLight.position);
    this.scene.add(this.sunMesh);
    
    // Log the new sun position
    console.log("Sun moved to position:", newSunPos);
  }

  // Get the physics world
  getWorld() {
    return this.world;
  }

  // Get physics materials
  getMaterial(type) {
    return this.materials[type];
  }

  // Step the physics world
  step(timeStep, dt) {
    if (this.world) {
      this.world.step(timeStep, dt);
    }
  }
}