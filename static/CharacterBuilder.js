import * as THREE from '/static/three.module.min.js';

export class CharacterBuilder {
  constructor(scene, params) {
    this.scene = scene;
    this.params = params;
    this.character = null;
    this.shaderMaterial = null;
    
    // Default lighting parameters
    this.lightingParams = {
      lightPosition: new THREE.Vector3(50, 80, 50),  // Default sun position
      lightColor: new THREE.Color(0xffffaa),         // Default sun color
      lightIntensity: 1.0,                           // Default sun intensity
      ambientColor: new THREE.Color(0x404040),       // Default ambient color
      ambientIntensity: 0.5                          // Default ambient intensity
    };
    
    this.createShaderMaterial();
  }
  
  // Create shader material for matte body parts with dynamic lighting
  createShaderMaterial() {
    // Vertex shader for body parts - inflates along normals and passes lighting info
    const vertexShader = `
      uniform float blobbiness;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        
        // Inflate vertices along normals for blobby effect
        vec3 inflatedPosition = position + normal * blobbiness * 0.2;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(inflatedPosition, 1.0);
      }
    `;

    // Fragment shader with dynamic lighting for matte parts
    const fragmentShader = `
      uniform vec3 color;
      uniform vec3 lightPosition;
      uniform vec3 lightColor;
      uniform float lightIntensity;
      uniform vec3 ambientColor;
      uniform float ambientIntensity;
      
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        // Calculate light direction
        vec3 lightDir = normalize(lightPosition - vPosition);
        
        // Diffuse lighting
        float diff = max(dot(vNormal, lightDir), 0.0);
        
        // Matte appearance with softer diffuse lighting
        vec3 diffuseLight = lightColor * lightIntensity * diff;
        vec3 ambientLight = ambientColor * ambientIntensity;
        
        // Calculate final color with softer shadows for matte look
        vec3 finalColor = color * (diffuseLight + ambientLight);
        
        // Apply gamma correction for more realistic lighting
        finalColor = pow(finalColor, vec3(1.0/2.2));
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    // Create shader material with lighting uniforms
    this.shaderMaterial = new THREE.ShaderMaterial({
      uniforms: {
        blobbiness: { value: this.params.blobbiness || 0.0 },
        color: { value: new THREE.Color(0x0000ff) },
        lightPosition: { value: this.lightingParams.lightPosition },
        lightColor: { value: this.lightingParams.lightColor },
        lightIntensity: { value: this.lightingParams.lightIntensity },
        ambientColor: { value: this.lightingParams.ambientColor },
        ambientIntensity: { value: this.lightingParams.ambientIntensity }
      },
      vertexShader,
      fragmentShader,
      vertexColors: false
    });
  }
  
  // Update lighting uniforms for all character materials
  updateLighting(lightParams) {
    if (!this.character) return;
    
    // Update our stored lighting parameters
    if (lightParams.lightPosition) this.lightingParams.lightPosition.copy(lightParams.lightPosition);
    if (lightParams.lightColor) this.lightingParams.lightColor.copy(lightParams.lightColor);
    if (lightParams.lightIntensity !== undefined) this.lightingParams.lightIntensity = lightParams.lightIntensity;
    if (lightParams.ambientColor) this.lightingParams.ambientColor.copy(lightParams.ambientColor);
    if (lightParams.ambientIntensity !== undefined) this.lightingParams.ambientIntensity = lightParams.ambientIntensity;
    
    // Update all character materials
    this.character.traverse((child) => {
      if (child.isMesh && child.material && child.material.uniforms) {
        // Update common lighting uniforms for all materials
        if (child.material.uniforms.lightPosition) 
          child.material.uniforms.lightPosition.value.copy(this.lightingParams.lightPosition);
        if (child.material.uniforms.lightColor) 
          child.material.uniforms.lightColor.value.copy(this.lightingParams.lightColor);
        if (child.material.uniforms.lightIntensity) 
          child.material.uniforms.lightIntensity.value = this.lightingParams.lightIntensity;
        if (child.material.uniforms.ambientColor) 
          child.material.uniforms.ambientColor.value.copy(this.lightingParams.ambientColor);
        if (child.material.uniforms.ambientIntensity) 
          child.material.uniforms.ambientIntensity.value = this.lightingParams.ambientIntensity;
      }
    });
  }
  
  createCharacter() {
    // Remove existing character if any
    this.removeCharacter();
    
    // Create a group for the entire character
    this.character = new THREE.Group();
    
    // Extract parameters
    const { height, armLength, legLength, thickness, blobbiness } = this.params;
    const { torso: torsoColor, head: headColor, arms: armsColor, legs: legsColor } = this.params.colors;
    
    // Higher segment counts for smoother geometry
    const radialSegments = 16;
    const heightSegments = 1;
    
    // Create torso with shader material (using sphere for oval shape)
    const torsoGeometry = new THREE.SphereGeometry(
      thickness * 1.2, radialSegments, heightSegments * 8
    );
    const torsoMaterial = this.shaderMaterial.clone();
    torsoMaterial.uniforms.color.value = new THREE.Color(torsoColor);
    torsoMaterial.uniforms.blobbiness.value = blobbiness;
    this.character.torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    
    // Scale the sphere to create an oval shape
    const torsoWidth = this.params.torsoWidth || 0.7;
    // Scale y-axis to match desired height
    this.character.torso.scale.set(torsoWidth, height / (thickness * 2.4), torsoWidth);
    
    this.character.add(this.character.torso);
    
    // Create head with enhanced PBR shader for shininess
    const headGeometry = new THREE.SphereGeometry(thickness * 1.5, radialSegments, 12);
    
    // Create a special shader for the head with PBR lighting
    const headVertexShader = `
      uniform float blobbiness;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewPosition;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        
        // Inflate vertices along normals for blobby effect
        vec3 inflatedPosition = position + normal * blobbiness * 0.2;
        vec4 mvPosition = modelViewMatrix * vec4(inflatedPosition, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        // Pass view-space position for specular calculation
        vViewPosition = -mvPosition.xyz;
      }
    `;

    const headFragmentShader = `
      uniform vec3 color;
      uniform float metalness;
      uniform float roughness;
      uniform vec3 lightPosition;
      uniform vec3 lightColor;
      uniform float lightIntensity;
      uniform vec3 ambientColor;
      uniform float ambientIntensity;
      
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewPosition;
      
      // Constants
      const float PI = 3.14159265359;
      
      // GGX/Trowbridge-Reitz normal distribution function
      float DistributionGGX(vec3 N, vec3 H, float roughness) {
        float a = roughness * roughness;
        float a2 = a * a;
        float NdotH = max(dot(N, H), 0.0);
        float NdotH2 = NdotH * NdotH;
        
        float nom = a2;
        float denom = (NdotH2 * (a2 - 1.0) + 1.0);
        denom = PI * denom * denom;
        
        return nom / denom;
      }
      
      // Schlick's approximation for Fresnel
      vec3 FresnelSchlick(float cosTheta, vec3 F0) {
        return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
      }
      
      // Schlick-GGX geometry function
      float GeometrySchlickGGX(float NdotV, float roughness) {
        float r = (roughness + 1.0);
        float k = (r * r) / 8.0;
        
        float nom = NdotV;
        float denom = NdotV * (1.0 - k) + k;
        
        return nom / denom;
      }
      
      // Smith's method for geometry obstruction
      float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
        float NdotV = max(dot(N, V), 0.0);
        float NdotL = max(dot(N, L), 0.0);
        float ggx2 = GeometrySchlickGGX(NdotV, roughness);
        float ggx1 = GeometrySchlickGGX(NdotL, roughness);
        
        return ggx1 * ggx2;
      }
      
      void main() {
        // Base parameters
        vec3 N = normalize(vNormal);
        vec3 V = normalize(vViewPosition);
        
        // Light position and direction from uniform
        vec3 L = normalize(lightPosition - vPosition);
        vec3 H = normalize(V + L);
        
        // Base reflectivity for dielectrics (non-metals) is 0.04, for metals we use the color
        vec3 F0 = vec3(0.04);
        F0 = mix(F0, color, metalness);
        
        // Cook-Torrance BRDF terms
        float NDF = DistributionGGX(N, H, roughness);
        vec3 F = FresnelSchlick(max(dot(H, V), 0.0), F0);
        float G = GeometrySmith(N, V, L, roughness);
        
        // Calculate specular component
        vec3 numerator = NDF * G * F;
        float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
        vec3 specular = numerator / denominator;
        
        // Energy conservation - metals don't have diffuse
        vec3 kS = F;
        vec3 kD = vec3(1.0) - kS;
        kD *= 1.0 - metalness;
        
        // Calculate outgoing radiance
        float NdotL = max(dot(N, L), 0.0);
        
        // Apply light color and intensity
        vec3 radiance = lightColor * lightIntensity;
        
        // Combine diffuse and specular with ambient occlusion
        vec3 ambient = ambientColor * ambientIntensity * color;
        vec3 diffuse = kD * color / PI;

        //vec3 boostedAmbient = ambient * 2.0; // Increase ambient by 2x
        
        // Final color with light energy and ambient
        vec3 finalColor = (diffuse + specular) * radiance * NdotL + ambient;
        
        // Gamma correction
        finalColor = pow(finalColor, vec3(1.0/2.2));
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    // Create head material with PBR properties
    const headMaterial = new THREE.ShaderMaterial({
      uniforms: {
        blobbiness: { value: blobbiness },
        color: { value: new THREE.Color(headColor) },
        metalness: { value: 0.7 },  // Higher metalness for shiny appearance
        roughness: { value: 0.3 },  // Lower roughness for shinier surface
        lightPosition: { value: this.lightingParams.lightPosition },
        lightColor: { value: this.lightingParams.lightColor },
        lightIntensity: { value: this.lightingParams.lightIntensity },
        ambientColor: { value: this.lightingParams.ambientColor },
        ambientIntensity: { value: this.lightingParams.ambientIntensity }
      },
      vertexShader: headVertexShader,
      fragmentShader: headFragmentShader,
      vertexColors: false
    });
    
    this.character.head = new THREE.Mesh(headGeometry, headMaterial);
    this.character.head.position.y = height/2 + thickness*1.1; // Slightly overlap with torso
    this.character.add(this.character.head);
    
    // Create neck joint (small sphere to smooth transition)
    const neckGeometry = new THREE.SphereGeometry(thickness * 1.1, radialSegments, 8);
    const neckMaterial = this.shaderMaterial.clone();
    neckMaterial.uniforms.color.value = new THREE.Color(headColor);
    neckMaterial.uniforms.blobbiness.value = blobbiness;
    const neck = new THREE.Mesh(neckGeometry, neckMaterial);
    neck.position.y = height/2 - thickness * 0.1; // Slightly overlap with torso
    this.character.add(neck);
    
    // Create arms with smoother geometry
    const armGeometry = new THREE.CylinderGeometry(
      thickness*0.8, thickness*0.8, armLength, radialSegments, heightSegments, false
    );
    const armMaterial = this.shaderMaterial.clone();
    armMaterial.uniforms.color.value = new THREE.Color(armsColor);
    armMaterial.uniforms.blobbiness.value = blobbiness;
    
    // Left arm - A-pose (arms angled down 30 degrees from horizontal)
    this.character.leftArm = new THREE.Mesh(armGeometry, armMaterial);
    
    // Set initial A-pose - arms angled 30 degrees down from horizontal
    this.character.leftArm.rotation.z = Math.PI/2 + Math.PI/6; // 90 + 30 degrees
    this.character.leftArm.position.set(
      -thickness - armLength/2 * Math.cos(Math.PI/6), 
      height/4 - armLength/2 * Math.sin(Math.PI/6), 
      0
    );
    
    // Left arm end cap (sphere at the end of arm) - make it a child of the arm
    const leftArmCapGeometry = new THREE.SphereGeometry(thickness*0.8, radialSegments, 8);
    const leftArmCapMaterial = armMaterial.clone();
    const leftArmCap = new THREE.Mesh(leftArmCapGeometry, leftArmCapMaterial);
    // Position at the TOP of the cylinder in local space (since rotation will flip it)
    leftArmCap.position.set(0, armLength/2, 0);
    this.character.leftArm.add(leftArmCap); // Add as child of arm
    
    // Apply counter-rotation to align with arm's orientation
    leftArmCap.rotation.z = -(Math.PI/2 + Math.PI/6);
    
    this.character.add(this.character.leftArm);
    
    // Left shoulder joint
    const leftShoulderGeometry = new THREE.SphereGeometry(thickness, radialSegments, 8);
    const leftShoulderMaterial = this.shaderMaterial.clone();
    leftShoulderMaterial.uniforms.color.value = new THREE.Color(armsColor);
    leftShoulderMaterial.uniforms.blobbiness.value = blobbiness;
    const leftShoulder = new THREE.Mesh(leftShoulderGeometry, leftShoulderMaterial);
    leftShoulder.position.set(-thickness, height/4, 0);
    this.character.add(leftShoulder);
    
    // Right arm - A-pose (arms angled down 30 degrees from horizontal)
    this.character.rightArm = new THREE.Mesh(armGeometry.clone(), armMaterial.clone());
    this.character.rightArm.rotation.z = -Math.PI/2 - Math.PI/6; // -90 - 30 degrees
    this.character.rightArm.position.set(
      thickness + armLength/2 * Math.cos(Math.PI/6), 
      height/4 - armLength/2 * Math.sin(Math.PI/6), 
      0
    );
    
    // Right arm end cap (sphere at the end of arm) - make it a child of the arm
    const rightArmCapGeometry = new THREE.SphereGeometry(thickness*0.8, radialSegments, 8);
    const rightArmCapMaterial = armMaterial.clone();
    const rightArmCap = new THREE.Mesh(rightArmCapGeometry, rightArmCapMaterial);
    // Position at the TOP of the cylinder in local space (since rotation will flip it)
    rightArmCap.position.set(0, armLength/2, 0);
    this.character.rightArm.add(rightArmCap); // Add as child of arm
    
    // Apply counter-rotation to align with arm's orientation
    rightArmCap.rotation.z = -(-Math.PI/2 - Math.PI/6);
    
    this.character.add(this.character.rightArm);
    
    // Right shoulder joint
    const rightShoulderGeometry = new THREE.SphereGeometry(thickness, radialSegments, 8);
    const rightShoulderMaterial = this.shaderMaterial.clone();
    rightShoulderMaterial.uniforms.color.value = new THREE.Color(armsColor);
    rightShoulderMaterial.uniforms.blobbiness.value = blobbiness;
    const rightShoulder = new THREE.Mesh(rightShoulderGeometry, rightShoulderMaterial);
    rightShoulder.position.set(thickness, height/4, 0);
    this.character.add(rightShoulder);
    
    // Create legs
    const legGeometry = new THREE.CylinderGeometry(
      thickness*0.8, thickness*0.8, legLength, radialSegments, heightSegments, false
    );
    const legMaterial = this.shaderMaterial.clone();
    legMaterial.uniforms.color.value = new THREE.Color(legsColor);
    legMaterial.uniforms.blobbiness.value = blobbiness;
    
    // Left leg
    this.character.leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    this.character.leftLeg.position.set(-thickness, -height/2-legLength/2, 0);
    
    // Left leg end cap (foot) - make it a child of the leg
    const leftFootGeometry = new THREE.SphereGeometry(thickness*0.8, radialSegments, 8);
    const leftFootMaterial = legMaterial.clone();
    const leftFoot = new THREE.Mesh(leftFootGeometry, leftFootMaterial);
    // Position at the bottom of the leg in local space
    leftFoot.position.set(0, -legLength/2, 0);
    this.character.leftLeg.add(leftFoot); // Add as child of leg
    
    this.character.add(this.character.leftLeg);
    
    // Left hip joint
    const leftHipGeometry = new THREE.SphereGeometry(thickness, radialSegments, 8);
    const leftHipMaterial = this.shaderMaterial.clone();
    leftHipMaterial.uniforms.color.value = new THREE.Color(legsColor);
    leftHipMaterial.uniforms.blobbiness.value = blobbiness;
    const leftHip = new THREE.Mesh(leftHipGeometry, leftHipMaterial);
    leftHip.position.set(-thickness, -height/2, 0);
    this.character.add(leftHip);
    
    // Right leg
    this.character.rightLeg = new THREE.Mesh(legGeometry.clone(), legMaterial.clone());
    this.character.rightLeg.position.set(thickness, -height/2-legLength/2, 0);
    
    // Right leg end cap (foot) - make it a child of the leg
    const rightFootGeometry = new THREE.SphereGeometry(thickness*0.8, radialSegments, 8);
    const rightFootMaterial = legMaterial.clone();
    const rightFoot = new THREE.Mesh(rightFootGeometry, rightFootMaterial);
    // Position at the bottom of the leg in local space
    rightFoot.position.set(0, -legLength/2, 0);
    this.character.rightLeg.add(rightFoot); // Add as child of leg
    
    this.character.add(this.character.rightLeg);
    
    // Right hip joint
    const rightHipGeometry = new THREE.SphereGeometry(thickness, radialSegments, 8);
    const rightHipMaterial = this.shaderMaterial.clone();
    rightHipMaterial.uniforms.color.value = new THREE.Color(legsColor);
    rightHipMaterial.uniforms.blobbiness.value = blobbiness;
    const rightHip = new THREE.Mesh(rightHipGeometry, rightHipMaterial);
    rightHip.position.set(thickness, -height/2, 0);
    this.character.add(rightHip);
    
    // Also modify pelvis to match oval shape
    const pelvisGeometry = new THREE.SphereGeometry(thickness * 1.2, radialSegments, 8);
    const pelvisMaterial = this.shaderMaterial.clone();
    pelvisMaterial.uniforms.color.value = new THREE.Color(torsoColor);
    pelvisMaterial.uniforms.blobbiness.value = blobbiness;
    const pelvis = new THREE.Mesh(pelvisGeometry, pelvisMaterial);
    pelvis.position.y = -height/2;
    
    // Scale pelvis to match oval torso
    pelvis.scale.set(torsoWidth * 1.2, 0.5, torsoWidth * 1.2);
    
    this.character.add(pelvis);
    
    // Store references to the limbs for animation
    this.character.leftArmCap = this.character.leftArm.children[0];
    this.character.rightArmCap = this.character.rightArm.children[0];
    this.character.leftFoot = this.character.leftLeg.children[0];
    this.character.rightFoot = this.character.rightLeg.children[0];
    
    // Add backpack
    this.addBackpack();

    // Add to scene
    this.scene.add(this.character);
    
    return this.character;
  }
  
  updateBlobbiness(value) {
    // Update blobbiness value for all materials in the character
    if (!this.character) return;
    
    this.character.traverse((child) => {
      if (child.isMesh && child.material && child.material.uniforms) {
        child.material.uniforms.blobbiness.value = value;
      }
    });
  }
  
  removeCharacter() {
    if (this.character) {
      this.scene.remove(this.character);
      
      // Dispose all meshes and materials
      this.character.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      
      this.character = null;
    }
  }
  
  // Method to update head PBR properties
  updateHeadPBR(metalness, roughness) {
    if (!this.character || !this.character.head || !this.character.head.material || !this.character.head.material.uniforms) return;
    
    if (metalness !== null && metalness !== undefined) {
      this.character.head.material.uniforms.metalness.value = metalness;
    }
    
    if (roughness !== null && roughness !== undefined) {
      this.character.head.material.uniforms.roughness.value = roughness;
    }
  }

  // Add method to create and add the backpack with lighting-aware shaders
  addBackpack() {
    if (!this.character || !this.character.torso) return;
    
    // Create backpack geometry - vertical cuboid with larger proportions
    const backpackWidth = this.params.thickness * 2;
    const backpackHeight = this.params.height * 1;
    const backpackDepth = this.params.thickness * 0.7;
    
    const backpackGeometry = new THREE.BoxGeometry(
      backpackWidth, 
      backpackHeight, 
      backpackDepth, 
      8, 8, 8 // More segments for smoother look with shader
    );
    
    // Create custom shader material for backpack with lighting
    const backpackMaterial = this.shaderMaterial.clone();
    backpackMaterial.uniforms.color.value = new THREE.Color(0xA0A0A0); // Lighter grey color
    backpackMaterial.uniforms.blobbiness.value = this.params.blobbiness;
    
    // Create backpack mesh
    this.character.backpack = new THREE.Mesh(backpackGeometry, backpackMaterial);
    this.character.backpack.name = 'backpack'; // Set name for easy reference
    
    // Position backpack on the back of the torso
    // Adjust Z position for better placement
    this.character.backpack.position.set(
      0, 
      0, // Center vertically on the torso
      -this.params.thickness * 1.2 // Negative Z to place on the correct side
    );
    
    // Add backpack as a child of the torso so it follows torso movement
    this.character.torso.add(this.character.backpack);
    
    // Add rounded corners to the backpack (small spheres at corners)
    this.addBackpackCorners(backpackWidth, backpackHeight, backpackDepth, backpackMaterial);
  }
  
  // Method to add rounded corners to the backpack
  addBackpackCorners(width, height, depth, material) {
    if (!this.character || !this.character.backpack) return;
    
    // Smaller corner radius relative to the backpack size
    const cornerRadius = this.params.thickness * 0.05; // Reduced from 0.15
    const cornerGeometry = new THREE.SphereGeometry(cornerRadius, 8, 8);
    
    // Calculate corner positions
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const halfDepth = depth / 2;
    
    // Create corner positions array (8 corners of cuboid)
    const cornerPositions = [
      // Top corners
      [-halfWidth, halfHeight, -halfDepth],
      [halfWidth, halfHeight, -halfDepth],
      [-halfWidth, halfHeight, halfDepth],
      [halfWidth, halfHeight, halfDepth],
      // Bottom corners
      [-halfWidth, -halfHeight, -halfDepth],
      [halfWidth, -halfHeight, -halfDepth],
      [-halfWidth, -halfHeight, halfDepth],
      [halfWidth, -halfHeight, halfDepth]
    ];
    
    // Add corners
    cornerPositions.forEach(pos => {
      const corner = new THREE.Mesh(cornerGeometry, material.clone());
      corner.position.set(pos[0], pos[1], pos[2]);
      this.character.backpack.add(corner);
    });
  }
}