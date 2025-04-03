// Add this class to a new file (PhysicsDebugger.js)
import * as CANNON from '/dist/cannon-es.js';
import * as THREE from '/static/three.module.min.js';

export class PhysicsDebugger {
  constructor(scene) {
    this.scene = scene;
    this.debugObjects = {};
    this.enabled = false; // Set to false to hide all debug objects
  }

  // Create or update visualization for a physics body
  visualizeBody(body, name, options = {}) {
    if (!this.enabled) return;
    
    // Default options
    const defaultOptions = {
      showBody: true,
      bodyColor: 0xff0000,
      bodyOpacity: 0.3,
      showAxes: true,
      axisLength: 2,
      showVelocity: true,
      velocityColor: 0x00ff00,
      velocityScale: 0.2,
      showNormals: false,
      normalColor: 0x0000ff,
      normalLength: 1
    };
    
    const config = { ...defaultOptions, ...options };
    
    // Create debug group if it doesn't exist
    if (!this.debugObjects[name]) {
      this.debugObjects[name] = {
        group: new THREE.Group(),
        body: null,
        axes: null,
        velocity: null,
        normals: []
      };
      this.scene.add(this.debugObjects[name].group);
    }
    
    const debugObj = this.debugObjects[name];
    
    // Update position and rotation from physics body
    debugObj.group.position.copy(body.position);
    debugObj.group.quaternion.copy(body.quaternion);
    
    // Create/update body visualization
    if (config.showBody) {
      if (!debugObj.body) {
        // Create body representation based on shape type
        if (body.shapes[0].type === CANNON.Shape.types.SPHERE) {
          const radius = body.shapes[0].radius;
          const geometry = new THREE.SphereGeometry(radius, 16, 16);
          const material = new THREE.MeshBasicMaterial({ 
            color: config.bodyColor, 
            transparent: true, 
            opacity: config.bodyOpacity,
            wireframe: true
          });
          debugObj.body = new THREE.Mesh(geometry, material);
          debugObj.group.add(debugObj.body);
        } 
        // Add other shape types here as needed
      }
    }
    
    // Create/update axes visualization
    if (config.showAxes) {
      if (!debugObj.axes) {
        debugObj.axes = new THREE.Group();
        
        // X-axis (red) - right
        const xAxis = new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 0, 0),
          config.axisLength,
          0xff0000
        );
        
        // Y-axis (green) - up
        const yAxis = new THREE.ArrowHelper(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 0),
          config.axisLength,
          0x00ff00
        );
        
        // Z-axis (blue) - forward
        const zAxis = new THREE.ArrowHelper(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, 0),
          config.axisLength,
          0x0000ff
        );
        
        debugObj.axes.add(xAxis);
        debugObj.axes.add(yAxis);
        debugObj.axes.add(zAxis);
        debugObj.group.add(debugObj.axes);
      }
    }
    
    // Create/update velocity visualization
    if (config.showVelocity && body.velocity) {
      if (!debugObj.velocity) {
        debugObj.velocity = new THREE.ArrowHelper(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 0),
          1,
          config.velocityColor
        );
        debugObj.group.add(debugObj.velocity);
      }
      
      // Update velocity arrow
      const vel = new THREE.Vector3(body.velocity.x, body.velocity.y, body.velocity.z);
      const velLength = vel.length();
      
      if (velLength > 0.1) {
        const velDir = vel.normalize();
        debugObj.velocity.setDirection(velDir);
        debugObj.velocity.setLength(velLength * config.velocityScale);
        debugObj.velocity.visible = true;
      } else {
        debugObj.velocity.visible = false;
      }
    }
    
    return debugObj;
  }
  
  // Add a visual debug arrow to represent any vector
  addDebugVector(position, direction, length, color, name) {
    if (!this.enabled) return null;
    
    const arrowName = `vector_${name}`;
    
    if (!this.debugObjects[arrowName]) {
      const arrowHelper = new THREE.ArrowHelper(
        direction.normalize(),
        position,
        length,
        color
      );
      
      this.debugObjects[arrowName] = {
        arrow: arrowHelper
      };
      
      this.scene.add(arrowHelper);
    } else {
      const arrow = this.debugObjects[arrowName].arrow;
      arrow.position.copy(position);
      arrow.setDirection(direction.normalize());
      arrow.setLength(length);
    }
    
    return this.debugObjects[arrowName].arrow;
  }
  
  // Update the debug vector
  updateDebugVector(position, direction, length, name) {
    if (!this.enabled) return;
    
    const arrowName = `vector_${name}`;
    if (this.debugObjects[arrowName]) {
      const arrow = this.debugObjects[arrowName].arrow;
      arrow.position.copy(position);
      
      if (direction.lengthSq() > 0) {
        arrow.setDirection(direction.normalize());
        arrow.setLength(length);
        arrow.visible = true;
      } else {
        arrow.visible = false;
      }
    }
  }
  
  // Show the "front" direction of the player
  showPlayerFrontDirection(player, camera) {
    if (!this.enabled || !player || !player.sphereBody) return;
    
    // Get player position
    const position = new THREE.Vector3().copy(player.sphereBody.position);
    
    // Calculate front direction based on camera yaw
    const cameraYawRotation = player.controls.getYawRotation();
    const frontDir = new THREE.Vector3(0, 0, -1); // Forward is -Z in camera space
    frontDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraYawRotation);
    
    // Add or update the arrow
    this.addDebugVector(position, frontDir, 3, 0xffff00, "player_front");
  }
  
  // Visualize the ground normal at player's position
  visualizeGroundNormal(player) {
    if (!this.enabled || !player || !player.sphereBody) return;
    
    const rayFrom = new CANNON.Vec3(
      player.sphereBody.position.x,
      player.sphereBody.position.y,
      player.sphereBody.position.z
    );
    
    const rayTo = new CANNON.Vec3(
      player.sphereBody.position.x,
      player.sphereBody.position.y - 10, // Ray length
      player.sphereBody.position.z
    );
    
    const ray = new CANNON.Ray(rayFrom, rayTo);
    const result = new CANNON.RaycastResult();
    ray.intersectWorld(player.world, {
      mode: CANNON.Ray.CLOSEST,
      result: result
    });
    
    if (result.hasHit) {
      const hitPos = new THREE.Vector3(
        result.hitPointWorld.x,
        result.hitPointWorld.y,
        result.hitPointWorld.z
      );
      
      const normal = new THREE.Vector3(
        result.hitNormalWorld.x,
        result.hitNormalWorld.y,
        result.hitNormalWorld.z
      );
      
      this.addDebugVector(hitPos, normal, 2, 0xff00ff, "ground_normal");
    }
  }
  
  // Clean up and remove all debug objects
  clear() {
    for (const name in this.debugObjects) {
      if (this.debugObjects[name].group) {
        this.scene.remove(this.debugObjects[name].group);
      }
      if (this.debugObjects[name].arrow) {
        this.scene.remove(this.debugObjects[name].arrow);
      }
    }
    this.debugObjects = {};
  }
  
  // Toggle debug visualization on/off
  toggle() {
    this.enabled = !this.enabled;
    for (const name in this.debugObjects) {
      if (this.debugObjects[name].group) {
        this.debugObjects[name].group.visible = this.enabled;
      }
      if (this.debugObjects[name].arrow) {
        this.debugObjects[name].arrow.visible = this.enabled;
      }
    }
  }
}