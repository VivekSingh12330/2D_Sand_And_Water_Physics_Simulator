    // Enhanced physics engine for sand, water and stone
    const CELL_SIZE = 1;
    const GRAVITY = 0.5;
    const STONE_GRAVITY = 0.8; // Stones fall faster
    const MAX_COMPRESSION = 1.5;
    const WATER_SPREAD_RATE = 4;
    const SAND_FRICTION = 0.5;
    const WATER_VISCOSITY = 0.95;
    const STONE_DENSITY = 2.0;
    const SPLASH_PROBABILITY = 0.1;
    const MAX_WETNESS = 10;
    const WATER_ABSORPTION_RATE = 1; // Reduced absorption rate
    const STONE_IMPACT_FORCE = 0.3;
    const WETNESS_SPREAD_RADIUS = 10;
    
    let grid;
    let currentMaterial = 'sand';
    let isEraser = false;
    let brushSize = 3;
    let particleCount = 0;
    let lastFrameTime = 0;
    let splashParticles = [];
    
    class SplashParticle {
      constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.lifetime = 0;
        this.maxLifetime = random(10, 30);
        this.size = random(1, 3);
        this.color = color(30, 144, 255, 200);
      }
      
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += GRAVITY * 0.2;
        this.lifetime++;
        this.vx *= 0.95;
        this.vy *= 0.95;
      }
      
      draw() {
        const alpha = map(this.lifetime, 0, this.maxLifetime, 200, 0);
        fill(red(this.color), green(this.color), blue(this.color), alpha);
        noStroke();
        ellipse(this.x, this.y, this.size);
      }
      
      isDead() {
        return this.lifetime >= this.maxLifetime;
      }
    }
    
    class Particle {
      constructor(type, x, y) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.settled = false;
        this.lifetime = 0;
        this.pressure = 0;
        this.wetness = 0;
        this.updated = false;
        this.density = 1.0;
        this.inAir = false;
        
        if (type === 'sand') {
          this.color = color(244, 164, 96);
          this.mass = 1.5;
          this.friction = SAND_FRICTION;
          this.inertialResistance = 0.3;
          this.density = 1.5;
        } else if (type === 'water') {
          this.color = color(30, 144, 255, 200);
          this.mass = 1.0;
          this.friction = 0.05;
          this.inertialResistance = 0.1;
          this.density = 1.0;
        } else if (type === 'stone') {
          this.color = color(128, 128, 128);
          this.mass = 2.0;
          this.friction = 0.8;
          this.inertialResistance = 0.5;
          this.density = STONE_DENSITY;
        }
      }
      
      update() {
        this.lifetime++;
        this.updated = true;
        
        if (this.type === 'stone') {
          this.inAir = this.isInAir();
          
          if (this.inAir) {
            this.vy += STONE_GRAVITY * this.mass;
          } else {
            this.settled = true;
          }
        } else {
          this.vy += GRAVITY * this.mass;
          
          if (this.type === 'sand') {
            this.vx *= (1 - this.friction);
            this.vy *= (1 - this.friction * 0.5);
          } else if (this.type === 'water') {
            this.vx *= WATER_VISCOSITY;
            this.vy *= WATER_VISCOSITY;
          }
        }
        
        this.vx = constrain(this.vx, -5, 5);
        this.vy = constrain(this.vy, -5, 5);
        
        if (abs(this.vx) < 0.01 && abs(this.vy) < 0.01) {
          this.settled = true;
        } else {
          this.settled = false;
        }
        
        if (this.type === 'sand' && this.wetness > 0) {
          this.wetness = max(0, this.wetness - 0.001);
        }
      }
      
      isInAir() {
        if (this.y >= grid.height - 1) return false;
        return grid.isEmpty(this.x, this.y + 1);
      }
      
      applyPressure(pressure) {
        this.pressure = pressure;
        if (this.type === 'water') {
          this.vx += (random() - 0.5) * pressure * 0.1;
        }
      }
      
      getColor() {
        if (this.type === 'sand' && this.wetness > 0) {
          const wetnessAmount = min(this.wetness / MAX_WETNESS, 1);
          const dryColor = color(244, 164, 96);
          const wetColor = color(101, 67, 33);
          return lerpColor(dryColor, wetColor, pow(wetnessAmount, 0.7));
        }
        return this.color;
      }
      
      isImmovable() {
        return this.type === 'stone' && !this.inAir;
      }
    }
    
    class Grid {
      constructor(width, height) {
        this.width = width;
        this.height = height;
        this.cells = Array(height).fill().map(() => Array(width).fill(null));
        this.nextCells = Array(height).fill().map(() => Array(width).fill(null));
      }
      
      get(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          return this.cells[y][x];
        }
        return null;
      }
      
      set(x, y, particle) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          this.cells[y][x] = particle;
          if (particle) {
            particle.x = x;
            particle.y = y;
          }
        }
      }
      
      setNext(x, y, particle) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          this.nextCells[y][x] = particle;
          if (particle) {
            particle.x = x;
            particle.y = y;
          }
        }
      }
      
      clear() {
        this.cells = Array(this.height).fill().map(() => Array(this.width).fill(null));
        this.nextCells = Array(this.height).fill().map(() => Array(this.width).fill(null));
        particleCount = 0;
        splashParticles = [];
      }
      
      swap() {
        [this.cells, this.nextCells] = [this.nextCells, this.cells];
        this.nextCells = Array(this.height).fill().map(() => Array(this.width).fill(null));
      }
      
      isEmpty(x, y) {
        const particle = this.get(x, y);
        return particle === null || (particle.type === 'water' && currentMaterial === 'stone');
      }
      
      isImmovable(x, y) {
        const particle = this.get(x, y);
        return particle && particle.isImmovable();
      }
      
      countParticles() {
        let count = 0;
        for (let y = 0; y < this.height; y++) {
          for (let x = 0; x < this.width; x++) {
            if (this.cells[y][x]) count++;
          }
        }
        return count;
      }
      
      update() {
        for (let y = 0; y < this.height; y++) {
          for (let x = 0; x < this.width; x++) {
            if (this.cells[y][x]) {
              this.cells[y][x].updated = false;
            }
          }
        }
        
        for (let y = this.height - 1; y >= 0; y--) {
          if (y % 2 === 0) {
            for (let x = 0; x < this.width; x++) {
              this.updateParticle(x, y);
            }
          } else {
            for (let x = this.width - 1; x >= 0; x--) {
              this.updateParticle(x, y);
            }
          }
        }
        
        this.swap();
        this.updateSplashParticles();
      }
      
      updateSplashParticles() {
        splashParticles = splashParticles.filter(p => {
          p.update();
          return !p.isDead();
        });
      }
      
      updateParticle(x, y) {
        const particle = this.get(x, y);
        if (!particle || particle.updated) return;
        
        particle.update();
        
        let pressure = 0;
        for (let dy = -3; dy < 0; dy++) {
          if (this.get(x, y + dy)) pressure += 0.3;
        }
        particle.applyPressure(pressure);
        
        let targetX = x + Math.round(particle.vx);
        let targetY = y + Math.round(particle.vy);
        
        targetX = constrain(targetX, 0, this.width - 1);
        targetY = constrain(targetY, 0, this.height - 1);
        
        if (this.isEmpty(targetX, targetY) && !this.nextCells[targetY][targetX]) {
          this.setNext(targetX, targetY, particle);
          
          if (particle.type === 'water' && targetY > y && random() < SPLASH_PROBABILITY) {
            this.createSplash(targetX, targetY, particle.vx, particle.vy);
          }
          
          return;
        }
        
        if (particle.type === 'sand') {
          this.updateSand(particle, x, y);
        } else if (particle.type === 'water') {
          this.updateWater(particle, x, y);
        } else if (particle.type === 'stone') {
          this.updateStone(particle, x, y);
        }
      }
      
      createSplash(x, y, vx, vy) {
        const splashCount = floor(random(1, 4));
        for (let i = 0; i < splashCount; i++) {
          const angle = random(TWO_PI);
          const speed = random(0.5, 2);
          splashParticles.push(new SplashParticle(
            x * CELL_SIZE + CELL_SIZE/2,
            y * CELL_SIZE + CELL_SIZE/2,
            cos(angle) * speed,
            sin(angle) * speed - abs(vy) * 0.5
          ));
        }
      }
      
      updateStone(particle, x, y) {
        if (particle.inAir) {
          if (y < this.height - 1) {
            const below = this.get(x, y + 1);
            
            if (!below && !this.nextCells[y + 1][x]) {
              this.setNext(x, y + 1, particle);
              return;
            }
            
            if (below && !below.updated) {
              if (below.type === 'water') {
                this.createSplash(x, y + 1, 0, particle.vy);
                
                for (let dx = -1; dx <= 1; dx++) {
                  const nx = x + dx;
                  if (nx >= 0 && nx < this.width) {
                    const water = this.get(nx, y + 1);
                    if (water && water.type === 'water') {
                      water.vx = dx * STONE_IMPACT_FORCE;
                      water.vy = -STONE_IMPACT_FORCE;
                    }
                  }
                }
              }
              
              this.setNext(x, y, particle);
              return;
            }
          }
        }
        
        this.setNext(x, y, particle);
      }
      
      updateSand(particle, x, y) {
        if (y < this.height - 1) {
          const below = this.get(x, y + 1);
          
          if (!below && !this.nextCells[y + 1][x]) {
            particle.vy += GRAVITY;
            this.setNext(x, y + 1, particle);
            return;
          }
          
          if (below && below.type === 'water' && !below.updated) {
            this.setNext(x, y + 1, particle);
            this.setNext(x, y, below);
            particle.wetness = min(particle.wetness + 0.1, MAX_WETNESS);
            return;
          }
          
          if (below && below.type === 'stone') {
            this.setNext(x, y, particle);
            return;
          }
        }
        
        if (y < this.height - 1) {
          const angleOfRepose = particle.wetness > 0 ? 0.7 : 0.5;
          const sides = random() > 0.5 ? [-1, 1] : [1, -1];
          
          for (let dx of sides) {
            const nx = x + dx;
            if (nx >= 0 && nx < this.width) {
              const diagonal = this.get(nx, y + 1);
              const side = this.get(nx, y);
              
              if ((!diagonal && !this.nextCells[y + 1][nx]) && !side && !this.isImmovable(nx, y + 1)) {
                let supportCount = 0;
                for (let checkX = nx - 1; checkX <= nx + 1; checkX++) {
                  if (this.get(checkX, y + 2)) supportCount++;
                }
                
                if (supportCount < 3 || random() < angleOfRepose) {
                  particle.vx = dx * 0.5;
                  particle.vy = 1;
                  this.setNext(nx, y + 1, particle);
                  return;
                }
              }
            }
          }
        }
        
        this.setNext(x, y, particle);
      }
      
      updateWater(particle, x, y) {
        if (y < this.height - 1) {
          const below = this.get(x, y + 1);
          
          if (!below && !this.nextCells[y + 1][x] && !this.isImmovable(x, y + 1)) {
            particle.vy += GRAVITY;
            this.setNext(x, y + 1, particle);
            return;
          }
          
          // Stone interaction - push water aside
          if (below && below.type === 'stone') {
            const sides = random() > 0.5 ? [-1, 1] : [1, -1];
            for (let dx of sides) {
              const nx = x + dx;
              if (nx >= 0 && nx < this.width) {
                if (this.isEmpty(nx, y) && !this.nextCells[y][nx]) {
                  this.setNext(nx, y, particle);
                  return;
                }
              }
            }
            this.setNext(x, y, particle);
            return;
          }
          
          const sides = random() > 0.5 ? [-1, 1] : [1, -1];
          for (let dx of sides) {
            const nx = x + dx;
            if (nx >= 0 && nx < this.width) {
              if (this.isEmpty(nx, y + 1) && !this.nextCells[y + 1][nx] && !this.isImmovable(nx, y + 1)) {
                particle.vx = dx;
                particle.vy = 1;
                this.setNext(nx, y + 1, particle);
                return;
              }
            }
          }
          
          // Updated water absorption section - only with sand, partial absorption
          if (below && below.type === 'sand') {
            // Only absorb some of the water (not all)
            if (random() < 0.02) {
              // Increase wetness of nearby sand
              for (let dy = 0; dy <= 1; dy++) {
                for (let dx = -WETNESS_SPREAD_RADIUS; dx <= WETNESS_SPREAD_RADIUS; dx++) {
                  const nx = x + dx;
                  const ny = y + dy;
                  if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    const neighbor = this.get(nx, ny);
                    if (neighbor && neighbor.type === 'sand' && neighbor.wetness < MAX_WETNESS) {
                      const distanceFactor = 1 - (abs(dx) / (WETNESS_SPREAD_RADIUS + 1));
                      neighbor.wetness = min(neighbor.wetness + WATER_ABSORPTION_RATE * distanceFactor, MAX_WETNESS);
                    }
                  }
                }
              }
              
              // Only remove water occasionally (most water remains)
              if (random() < 0.1) {
                this.setNext(x, y, null);
              } else {
                this.setNext(x, y, particle);
              }
              return;
            }
          }
        }
        
        const spreadDistance = floor(WATER_SPREAD_RATE * (1 + particle.pressure));
        const direction = random() > 0.5 ? 1 : -1;
        
        for (let d = 1; d <= spreadDistance; d++) {
          const nx = x + (d * direction);
          if (nx >= 0 && nx < this.width && !this.isImmovable(nx, y)) {
            const neighbor = this.get(nx, y);
            
            if (!neighbor && !this.nextCells[y][nx]) {
              particle.vx = direction * 2;
              this.setNext(nx, y, particle);
              return;
            }
            
            if (neighbor && neighbor.type === 'water' && !neighbor.updated) {
              if (particle.pressure > neighbor.pressure) {
                continue;
              }
            }
            
            if (neighbor) break;
          }
        }
        
        for (let d = 1; d <= spreadDistance; d++) {
          const nx = x - (d * direction);
          if (nx >= 0 && nx < this.width && !this.isImmovable(nx, y)) {
            if (this.isEmpty(nx, y) && !this.nextCells[y][nx]) {
              particle.vx = -direction * 2;
              this.setNext(nx, y, particle);
              return;
            }
            if (this.get(nx, y)) break;
          }
        }
        
        this.setNext(x, y, particle);
      }
    }
    
    function setup() {
      const canvas = createCanvas(800, 600);
      canvas.parent('canvas-container');
      
      grid = new Grid(width, height);
      
      document.getElementById('sandButton').addEventListener('click', () => {
        currentMaterial = 'sand';
        isEraser = false;
        updateButtonStates();
        updateCurrentMaterialDisplay();
      });
      
      document.getElementById('waterButton').addEventListener('click', () => {
        currentMaterial = 'water';
        isEraser = false;
        updateButtonStates();
        updateCurrentMaterialDisplay();
      });
      
      document.getElementById('stoneButton').addEventListener('click', () => {
        currentMaterial = 'stone';
        isEraser = false;
        updateButtonStates();
        updateCurrentMaterialDisplay();
      });
      
      document.getElementById('eraserButton').addEventListener('click', () => {
        isEraser = true;
        updateButtonStates();
        updateCurrentMaterialDisplay();
      });
      
      document.getElementById('clearButton').addEventListener('click', () => {
        grid.clear();
      });
      
      document.getElementById('brushSize').addEventListener('change', (e) => {
        brushSize = parseInt(e.target.value);
      });
      
      updateButtonStates();
      updateCurrentMaterialDisplay();
    }
    
    function updateButtonStates() {
      document.getElementById('sandButton').classList.toggle('active', currentMaterial === 'sand' && !isEraser);
      document.getElementById('waterButton').classList.toggle('active', currentMaterial === 'water' && !isEraser);
      document.getElementById('stoneButton').classList.toggle('active', currentMaterial === 'stone' && !isEraser);
      document.getElementById('eraserButton').classList.toggle('active', isEraser);
    }
    
    function updateCurrentMaterialDisplay() {
      let materialName = '';
      if (isEraser) {
        materialName = 'Eraser';
      } else {
        switch(currentMaterial) {
          case 'sand': materialName = 'Sand'; break;
          case 'water': materialName = 'Water'; break;
          case 'stone': materialName = 'Stone'; break;
        }
      }
      document.getElementById('currentMaterial').textContent = materialName;
    }
    
    function draw() {
      background(30);
      
      grid.update();
      
      noStroke();
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          const particle = grid.get(x, y);
          if (particle) {
            fill(particle.getColor());
            rect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          }
        }
      }
      
      for (const splash of splashParticles) {
        splash.draw();
      }
      
      if (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height) {
        noFill();
        stroke(255, 100);
        strokeWeight(1);
        ellipse(mouseX, mouseY, brushSize * 2 * CELL_SIZE);
        
        if (!isEraser) {
          fill(getMaterialPreviewColor());
          ellipse(mouseX, mouseY, CELL_SIZE * 2);
        }
      }
      
      if (frameCount % 10 === 0) {
        particleCount = grid.countParticles();
        document.getElementById('particleCount').textContent = particleCount;
        document.getElementById('fps').textContent = Math.round(frameRate());
      }
    }
    
    function getMaterialPreviewColor() {
      switch(currentMaterial) {
        case 'sand': return color(244, 164, 96);
        case 'water': return color(30, 144, 255, 200);
        case 'stone': return color(128, 128, 128);
        default: return color(255);
      }
    }
    
    function mouseDragged() {
      placeMaterial();
    }
    
    function mousePressed() {
      placeMaterial();
    }
    
    function placeMaterial() {
      if (mouseX < 0 || mouseX >= width || mouseY < 0 || mouseY >= height) return;
      
      const gridX = floor(mouseX / CELL_SIZE);
      const gridY = floor(mouseY / CELL_SIZE);
      
      for (let dy = -brushSize; dy <= brushSize; dy++) {
        for (let dx = -brushSize; dx <= brushSize; dx++) {
          if (dist(0, 0, dx, dy) <= brushSize) {
            const x = gridX + dx;
            const y = gridY + dy;
            
            if (x >= 0 && x < grid.width && y >= 0 && y < grid.height) {
              if (isEraser) {
                grid.set(x, y, null);
              } else if (grid.isEmpty(x, y) || (currentMaterial === 'stone' && grid.get(x, y)?.type === 'water')) {
                const particle = new Particle(currentMaterial, x, y);
                if (currentMaterial !== 'stone') {
                  particle.vx = (random() - 0.5) * 0.5;
                  particle.vy = random() * 0.5;
                }
                grid.set(x, y, particle);
                
                if (currentMaterial === 'water' && y > 0 && grid.get(x, y-1)?.type === 'water' && random() < 0.3) {
                  grid.createSplash(x, y, particle.vx, particle.vy);
                }
              }
            }
          }
        }
      }
    }
    
    function keyPressed() {
      switch(key.toLowerCase()) {
        case 's':
          currentMaterial = 'sand';
          isEraser = false;
          updateButtonStates();
          updateCurrentMaterialDisplay();
          break;
        case 'w':
          currentMaterial = 'water';
          isEraser = false;
          updateButtonStates();
          updateCurrentMaterialDisplay();
          break;
        case 't':
          currentMaterial = 'stone';
          isEraser = false;
          updateButtonStates();
          updateCurrentMaterialDisplay();
          break;
        case 'e':
          isEraser = true;
          updateButtonStates();
          updateCurrentMaterialDisplay();
          break;
        case 'c':
          grid.clear();
          break;
      }
    }
 