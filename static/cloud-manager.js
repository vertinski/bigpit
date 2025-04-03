import * as THREE from '/static/three.module.min.js';

export class CloudManager {
  constructor(scene) {
    this.scene = scene;
    this.clouds = [];
    this.material = new THREE.MeshLambertMaterial({ color: 0xffffff });
    // Increased polygon count for smoother clouds
    this.baseGeometry = new THREE.SphereGeometry(1, 12, 12);
  }

  // Initialize clouds around the terrain
  initClouds(terrainSize, mountainPosition) {
    // Clear any existing clouds
    this.removeAllClouds();
    
    // Calculate the opposite direction from the mountain
    const oppositeDirection = Math.sign(mountainPosition) * -1;
    
    // Number of cloud clusters for main ring
    const numClusters = 15;
    
    // Number of distant cloud clusters
    const numDistantClusters = 10;
    
    // Height level for clouds - significantly higher
    const cloudHeight = 40;
    
    // Distance from center where clouds are placed - increased for bigger clouds
    const cloudDistance = terrainSize * 0.85;
    
    // Distance for the second, more distant layer of clouds
    const farCloudDistance = terrainSize * 1.3;
    
    // Generate cloud clusters in a semi-circular pattern (main ring)
    for (let i = 0; i < numClusters; i++) {
      // Generate angle (in radians) for this cloud cluster
      // We'll generate clouds in a 270-degree arc, leaving the side opposite to the mountain clear
      const startAngle = (oppositeDirection < 0) ? -Math.PI / 2 : Math.PI / 2;
      const angleRange = Math.PI * 1.5; // 270 degrees
      const angle = startAngle + (angleRange * i / (numClusters - 1));
      
      // Widened the clear path further to account for much larger clouds
      const angleFromOpposite = Math.abs(angle - (Math.PI * oppositeDirection));
      if (angleFromOpposite < Math.PI / 2.5) {
        continue; // Skip this cloud as it's in the cleared zone
      }
      
      // Calculate position based on angle and distance
      const x = Math.cos(angle) * cloudDistance;
      const z = Math.sin(angle) * cloudDistance;
      
      // Vary cluster size more dramatically for the nearest side of playfield
      // Check if this is on the nearest side (roughly opposite to mountain)
      const isNearSide = Math.abs(angle) < Math.PI / 4; // Front quarter
      
      // Create a cloud cluster at this position with appropriate size variation
      if (isNearSide) {
        // Create multiple varied clusters for the nearest side
        const numVariations = 2 + Math.floor(Math.random() * 2); // 2-3 clusters
        
        for (let j = 0; j < numVariations; j++) {
          // Vary position slightly for each cluster
          const offsetDist = 25 + Math.random() * 30;
          const offsetAngle = angle + (Math.random() * 0.3 - 0.15);
          
          const offsetX = Math.cos(offsetAngle) * (cloudDistance - offsetDist * j);
          const offsetZ = Math.sin(offsetAngle) * (cloudDistance - offsetDist * j);
          
          // Create a cluster with random size (small, medium, or large)
          const sizeVariant = Math.floor(Math.random() * 3); // 0=small, 1=medium, 2=large
          this.createCloudCluster(offsetX, cloudHeight, offsetZ, sizeVariant);
        }
      } else {
        // For other sides, use normal varied clusters
        this.createCloudCluster(x, cloudHeight, z);
      }
    }
    
    // Add more distant clusters for depth
    for (let i = 0; i < numDistantClusters; i++) {
      // Use a more complete circle for distant clouds
      const angle = Math.random() * Math.PI * 2;
      
      // But still respect the clear zone
      const angleFromOpposite = Math.abs(angle - (Math.PI * oppositeDirection));
      if (angleFromOpposite < Math.PI / 3) {
        continue; // Skip this cloud as it's in the cleared zone
      }
      
      // Calculate position with variation
      const distance = farCloudDistance + Math.random() * (terrainSize * 0.5);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      
      // Vary height slightly for distant clouds
      const yOffset = (Math.random() - 0.5) * 15;
      
      // Create a distant cloud cluster (slightly smaller for perspective)
      this.createCloudCluster(x, cloudHeight + yOffset, z, 0); // Use size variant 0 (smaller)
    }
  }
  
  // Create a single cloud cluster made of multiple spheres
  createCloudCluster(x, y, z, sizeVariant = -1) {
    // If size variant is -1, randomly choose
    if (sizeVariant === -1) {
      sizeVariant = Math.floor(Math.random() * 3);
    }
    
    // Determine cluster parameters based on size variant
    let clusterSize, clusterWidth, clusterHeight, clusterDepth, scaleMultiplier;
    
    switch(sizeVariant) {
      case 0: // Small
        clusterSize = 4 + Math.floor(Math.random() * 4); // 4-7 spheres
        clusterWidth = 25 + Math.random() * 25; // Smaller width
        clusterHeight = 8 + Math.random() * 12; // Lower height
        clusterDepth = 20 + Math.random() * 20; // Smaller depth
        scaleMultiplier = 0.7;
        break;
      case 1: // Medium
        clusterSize = 6 + Math.floor(Math.random() * 5); // 6-10 spheres
        clusterWidth = 35 + Math.random() * 35; // Medium width
        clusterHeight = 12 + Math.random() * 15; // Medium height
        clusterDepth = 30 + Math.random() * 25; // Medium depth
        scaleMultiplier = 1.0;
        break;
      case 2: // Large
        clusterSize = 7 + Math.floor(Math.random() * 7); // 7-13 spheres
        clusterWidth = 45 + Math.random() * 40; // Larger width
        clusterHeight = 15 + Math.random() * 20; // Taller height
        clusterDepth = 40 + Math.random() * 30; // Larger depth
        scaleMultiplier = 1.3;
        break;
      default:
        // Default to medium if something goes wrong
        clusterSize = 6 + Math.floor(Math.random() * 5);
        clusterWidth = 35 + Math.random() * 35;
        clusterHeight = 12 + Math.random() * 15;
        clusterDepth = 30 + Math.random() * 25;
        scaleMultiplier = 1.0;
    }
    
    // Create a group for this cloud cluster
    const cloudGroup = new THREE.Group();
    cloudGroup.position.set(x, y, z);
    
    // Generate spheres for this cluster
    for (let i = 0; i < clusterSize; i++) {
      // Create a cloud sphere with random position within the cluster bounds
      const sphere = new THREE.Mesh(this.baseGeometry, this.material);
      
      // Set random position within the cluster
      sphere.position.set(
        (Math.random() - 0.5) * clusterWidth,
        (Math.random() - 0.5) * clusterHeight,
        (Math.random() - 0.5) * clusterDepth
      );
      
      // Set random scale for each sphere to create much larger oval shapes
      const scaleX = (10 + Math.random() * 8) * scaleMultiplier;
      const scaleY = (7 + Math.random() * 5) * scaleMultiplier;
      const scaleZ = (10 + Math.random() * 8) * scaleMultiplier;
      sphere.scale.set(scaleX, scaleY, scaleZ);
      
      // Add sphere to the cloud group
      cloudGroup.add(sphere);
    }
    
    // Add the cloud group to the scene and track it
    this.scene.add(cloudGroup);
    this.clouds.push(cloudGroup);
    
    return cloudGroup;
  }
  
  // Remove all clouds from the scene
  removeAllClouds() {
    for (const cloud of this.clouds) {
      this.scene.remove(cloud);
      // Clean up geometries/materials if needed
      cloud.children.forEach(child => {
        child.geometry.dispose();
      });
    }
    this.clouds = [];
  }
}