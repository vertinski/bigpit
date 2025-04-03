import * as THREE from '/static/three.module.min.js';

export class AudioManager {
  constructor(camera) {
    // Store reference to the camera for positioning audio listener
    this.camera = camera;

    // Create audio listener
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);

    // Sound objects collection
    this.sounds = new Map();
    
    // Background music properties
    this.backgroundMusic = null;
    this.musicVolume = 0.5;
    this.isMusicMuted = false;
    
    // Sound effects volume
    this.effectsVolume = 0.7;
    this.isEffectsMuted = false;
    
    // Create audio loader
    this.audioLoader = new THREE.AudioLoader();
  }
  
  // Load and set up background music
  loadBackgroundMusic(url, options = {}) {
    // Create a new audio object for music
    this.backgroundMusic = new THREE.Audio(this.listener);
    
    // Default options
    const defaultOptions = {
      volume: this.musicVolume,
      loop: true,
      autoplay: true,
      fadeIn: true,
      fadeInDuration: 2 // seconds
    };
    
    // Merge with provided options
    const config = { ...defaultOptions, ...options };
    
    // Load audio file
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        url,
        (buffer) => {
          // Set the audio buffer to the music object
          this.backgroundMusic.setBuffer(buffer);
          this.backgroundMusic.setLoop(config.loop);
          
          // Set volume (respecting mute state)
          if (this.isMusicMuted) {
            this.backgroundMusic.setVolume(0);
          } else {
            // Apply fade in if requested
            if (config.fadeIn) {
              this.backgroundMusic.setVolume(0);
              this.fadeInMusic(config.volume, config.fadeInDuration);
            } else {
              this.backgroundMusic.setVolume(config.volume);
            }
          }
          
          // Store the configured volume
          this.musicVolume = config.volume;
          
          // Play if autoplay is set
          if (config.autoplay) {
            this.backgroundMusic.play();
          }
          
          this.sounds.set('backgroundMusic', this.backgroundMusic);
          resolve(this.backgroundMusic);
        },
        // Progress callback
        (xhr) => {
          const percent = (xhr.loaded / xhr.total) * 100;
          console.log(`Loading music: ${Math.round(percent)}% loaded`);
        },
        // Error callback
        (error) => {
          console.error('Error loading background music:', error);
          reject(error);
        }
      );
    });
  }
  
  // Load a sound effect
  loadSoundEffect(name, url, options = {}) {
    // Create a new audio object for the sound effect
    const sound = new THREE.Audio(this.listener);
    
    // Default options
    const defaultOptions = {
      volume: this.effectsVolume,
      loop: false,
      autoplay: false
    };
    
    // Merge with provided options
    const config = { ...defaultOptions, ...options };
    
    // Load audio file
    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        url,
        (buffer) => {
          // Set the audio buffer to the sound object
          sound.setBuffer(buffer);
          sound.setLoop(config.loop);
          
          // Set volume (respecting mute state)
          if (this.isEffectsMuted) {
            sound.setVolume(0);
          } else {
            sound.setVolume(config.volume);
          }
          
          // Play if autoplay is set
          if (config.autoplay) {
            sound.play();
          }
          
          this.sounds.set(name, sound);
          resolve(sound);
        },
        // Progress callback
        (xhr) => {
          const percent = (xhr.loaded / xhr.total) * 100;
          console.log(`Loading sound ${name}: ${Math.round(percent)}% loaded`);
        },
        // Error callback
        (error) => {
          console.error(`Error loading sound ${name}:`, error);
          reject(error);
        }
      );
    });
  }
  
  // Play a sound effect by name
  playSoundEffect(name) {
    const sound = this.sounds.get(name);
    if (sound) {
      // If sound is already playing, stop it first to restart
      if (sound.isPlaying) {
        sound.stop();
      }
      sound.play();
      return true;
    }
    return false;
  }
  
  // Fade in music gradually
  fadeInMusic(targetVolume, duration = 2) {
    if (!this.backgroundMusic) return;
    
    const startVolume = this.backgroundMusic.getVolume();
    const volumeDiff = targetVolume - startVolume;
    const startTime = performance.now();
    
    const fadeInterval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000; // Convert to seconds
      const t = Math.min(elapsed / duration, 1);
      
      // Calculate new volume with easing
      const easedT = this.easeInOutQuad(t);
      const newVolume = startVolume + volumeDiff * easedT;
      
      // Apply volume if not muted
      if (!this.isMusicMuted) {
        this.backgroundMusic.setVolume(newVolume);
      }
      
      // Stop interval when fade is complete
      if (t >= 1) {
        clearInterval(fadeInterval);
      }
    }, 50); // Update every 50ms
  }
  
  // Fade out music gradually
  fadeOutMusic(duration = 2) {
    if (!this.backgroundMusic) return Promise.resolve();
    
    return new Promise((resolve) => {
      const startVolume = this.backgroundMusic.getVolume();
      const startTime = performance.now();
      
      const fadeInterval = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000; // Convert to seconds
        const t = Math.min(elapsed / duration, 1);
        
        // Calculate new volume with easing
        const easedT = this.easeInOutQuad(t);
        const newVolume = startVolume * (1 - easedT);
        
        this.backgroundMusic.setVolume(newVolume);
        
        // Stop interval when fade is complete
        if (t >= 1) {
          clearInterval(fadeInterval);
          resolve();
        }
      }, 50); // Update every 50ms
    });
  }
  
  // Toggle music mute state
  toggleMuteMusic() {
    this.isMusicMuted = !this.isMusicMuted;
    
    if (this.backgroundMusic) {
      if (this.isMusicMuted) {
        this.backgroundMusic.setVolume(0);
      } else {
        this.backgroundMusic.setVolume(this.musicVolume);
      }
    }
    
    return this.isMusicMuted;
  }
  
  // Toggle sound effects mute state
  toggleMuteEffects() {
    this.isEffectsMuted = !this.isEffectsMuted;
    
    // Update all sound effects
    this.sounds.forEach((sound, name) => {
      if (name !== 'backgroundMusic') {
        if (this.isEffectsMuted) {
          sound.setVolume(0);
        } else {
          sound.setVolume(this.effectsVolume);
        }
      }
    });
    
    return this.isEffectsMuted;
  }
  
  // Set music volume
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    
    if (this.backgroundMusic && !this.isMusicMuted) {
      this.backgroundMusic.setVolume(this.musicVolume);
    }
    
    return this.musicVolume;
  }
  
  // Set effects volume
  setEffectsVolume(volume) {
    this.effectsVolume = Math.max(0, Math.min(1, volume));
    
    // Update all sound effects
    this.sounds.forEach((sound, name) => {
      if (name !== 'backgroundMusic' && !this.isEffectsMuted) {
        sound.setVolume(this.effectsVolume);
      }
    });
    
    return this.effectsVolume;
  }
  
  // Pause all audio
  pauseAll() {
    this.sounds.forEach((sound) => {
      if (sound.isPlaying) {
        sound.pause();
      }
    });
  }
  
  // Resume all paused audio
  resumeAll() {
    this.sounds.forEach((sound) => {
      if (sound.source && !sound.isPlaying) {
        sound.play();
      }
    });
  }
  
  // Stop all audio
  stopAll() {
    this.sounds.forEach((sound) => {
      if (sound.isPlaying) {
        sound.stop();
      }
    });
  }
  
  // Clean up audio resources
  dispose() {
    this.stopAll();
    this.sounds.clear();
    
    if (this.listener) {
      this.camera.remove(this.listener);
      this.listener = null;
    }
  }
  
  // Easing function for smooth transitions
  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}