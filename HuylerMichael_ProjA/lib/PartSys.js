/**
 * Classes used to implement a Particle Systems.
 *
 * @author Michael Huyler
 */

/**
 * Types of particle systems.
 *
 * @enum {number}
 */
const PARTICLE_SYSTEM = {
  BOUNCY_BALL: 0,
  CLOTH: 1,
  BOIDS: 2,
};
const PARTICLE_SYSTEM_STRINGS = ["Bouncy Ball", "Cloth Simulation", "Boids"];

/**
 * States stored in a state array.
 *
 * @enum {number}
 */
const STATE = {
  P_X: 0,
  P_Y: 1,
  P_Z: 2,
  V_X: 3,
  V_Y: 4,
  V_Z: 5,
  F_X: 6,
  F_Y: 7,
  F_Z: 8,
  R: 9,
  G: 10,
  B: 11,
  A: 12,
  MASS: 13,
  DIAMETER: 14,
  AGE: 15,
};
const STATE_SIZE = 16;

/**
 * Types of solvers.
 *
 * @enum {number}
 */
const SOLVER = {
  EULER: 0,
  MIDPOINT: 1,
  RUNGA_KUTTA: 2,
  ITER_BACK: 3,
  VERLET: 4,
};

/**
 * Abstract Particle System.
 */
class PartSys {
  /**
   * @param {number} BBALL_PARTICLE_COUNT The number of particles to initialize.
   */
  constructor(BBALL_PARTICLE_COUNT) {
    this._type = -1;
    this._BBALL_PARTICLE_COUNT = BBALL_PARTICLE_COUNT;
    this._vbo = null;
    this._c_vbo = -1;
    this._s1 = new Float32Array(BBALL_PARTICLE_COUNT * STATE_SIZE);
    for (var i = 0; i < BBALL_PARTICLE_COUNT * STATE_SIZE; i += STATE_SIZE) {
      this._s1[i + STATE.P_X] = Math.random() * 2 - 1;
      this._s1[i + STATE.P_Y] = Math.random() * 2 - 1;
      this._s1[i + STATE.P_Z] = Math.random() * 2;
      this._s1[i + STATE.MASS] = 1;
      this._s1[i + STATE.R] = Math.random();
      this._s1[i + STATE.G] = Math.random();
      this._s1[i + STATE.B] = Math.random();
      this._s1[i + STATE.A] = 1;
    }
    this._s1dot = this._s1.slice();
    this._s2 = this._s1.slice();
    this._sM = this._s1.slice();
    this._sMdot = this._s1.slice();
    this._force_set = [];
    this._constraint_set = [];
  }

  get type() {
    return this._type;
  }
  get s1() {
    return this._s1;
  }
  get s1dot() {
    return this._s1dot;
  }
  get s2() {
    return this._s2;
  }
  get sM() {
    return this._sM;
  }
  get sMdot() {
    return this._sMdot;
  }
  get force_set() {
    return this._force_set;
  }
  get constraint_set() {
    return this._constraint_set;
  }

  set s1(s) {
    this._s1 = s;
  }
  set s1dot(s) {
    this._s1dot = s;
  }
  set s2(s) {
    this._s2 = s;
  }
  set sM(s) {
    this._sM = s;
  }
  set sMdot(s) {
    this._sMdot = s;
  }
  set force_set(f) {
    if (f instanceof Force) {
      this._force_set.push(f);
    } else if (Array.isArray(f)) {
      this._force_set = f;
    } else {
      console.error("improper force: " + typeof(f));
    }
  }
  set constraint_set(c) {
    this._constraint_set = c;
  }

  /**
   * Sets up a particular particle system, influencing its general behavior.
   *
   * @param {!PARTICLE_SYSTEM} part_sys_type The type of particle system to create.
   * @param {VBOBox} my_vbo The VBO to render this particle system in.
   * @param {VBOBox} constraint_vbo The VBO to render constraints in.
   * @param {Array<Force>} force_set The set of initial forces acting on this particle system.
   * @param {Array<Constraint>} constraint_set The set of initial constraints limiting this particle system.
   */
  init(part_sys_type, my_vbo, constraint_vbo, force_set, constraint_set, initial_conditions) {
    this._type = part_sys_type;
    this.force_set = force_set;
    this.constraint_set = constraint_set;
    this._vbo = my_vbo;
    this._c_vbo = constraint_vbo;
    this._boid_radius = 0.5;
    this.blink(initial_conditions);
    this.insertGui();
  }

  /**
   * Instantaneously applys a state to this particle system.
   *
   * Calling this function will instantaneously transition this particle system
   * to the state passed in (in the *blink* of an eye). This clears the
   * previous state variables too, to prevent any weird effects caused by the
   * retention of a previous (and potentially wildly different) state.
   *
   * @param {Float32Array} state The state to "blink" to.
   */
  blink(state) {
    if (state != undefined) {
      this._s1 = state.slice();
      this._s1dot = state.slice();
      this._s2 = state.slice();
      this._sM = state.slice();
      this._sMdot = state.slice();
    }
  }

  /**
   * Applys all forces in forceArray, modifying state array s.
   *
   * @param {!Float32Array} s The state array to be modified.
   */
  applyAllForces(s) {
    for (var i = 0; i < s.length; i += STATE_SIZE) {
      s[i + STATE.F_X] = 0;
      s[i + STATE.F_Y] = 0;
      s[i + STATE.F_Z] = 0;
    }
    this.force_set.forEach((force, _) => force.apply(s));
  }

  /**
   * Finds the derivative w.r.t. time of state s.
   *
   * @param {!Float32Array} s The state array to apply the derivative to.
   */
  dotFinder(s) {
    var dot = s.slice();
    var inverse_mass = 0;
    for (var i = 0; i < s.length; i += STATE_SIZE) {
      inverse_mass = 1.0 / s[i + STATE.MASS];
      dot[i + STATE.P_X] = s[i + STATE.V_X];
      dot[i + STATE.P_Y] = s[i + STATE.V_Y];
      dot[i + STATE.P_Z] = s[i + STATE.V_Z];
      dot[i + STATE.V_X] = s[i + STATE.F_X] * inverse_mass;
      dot[i + STATE.V_Y] = s[i + STATE.F_Y] * inverse_mass;
      dot[i + STATE.V_Z] = s[i + STATE.F_Z] * inverse_mass;
      dot[i + STATE.F_X] = 0;
      dot[i + STATE.F_Y] = 0;
      dot[i + STATE.F_Z] = 0;
      dot[i + STATE.R] = 0;
      dot[i + STATE.G] = 0;
      dot[i + STATE.B] = 0;
      dot[i + STATE.A] = 0;
      dot[i + STATE.MASS] = 0;
      dot[i + STATE.DIAMETER] = 0;
      dot[i + STATE.AGE] = 0;
    }
    return dot;
  }

  /**
   * Creates s2 by approximating integration of s1 over a single timestep.
   *
   * @param {!SOLVER} solver_type The type of solver to use.
   */
  solver(solver_type) {
    switch (solver_type) {
      case SOLVER.EULER:
      case 0:
        for (var i = 0; i < this.s2.length; i++) {
          this.s2[i] = this.s1[i] + this.s1dot[i] * (tracker.ms * 0.001);
        }
        break;
      case SOLVER.MIDPOINT:
        for (var i = 0; i < this.s2.length; i++) {
          this.sM[i] = this.s1[i] + this.s1dot[i] * (tracker.ms * 0.0005);
        }
        this.sMdot = this.dotFinder(this.sM);
        for (var i = 0; i < this.s2.length; i++) {
          this.s2[i] = this.s1[i] + this.sMdot[i] * (tracker.ms * 0.001);
        }
        break;
      case SOLVER.ITER_BACK:

        break;
      default:
        console.log('unknown solver: ' + solver_type);
        break;
    }
  }

  /**
   * Applies all constraints for a given system.
   */
  doConstraints() {
    this.constraint_set.forEach((constraint, _) => {
      constraint.constrain(this.s1, this.s2);
    });
  }

  /**
   * Updates values for transferring to the GPU.
   *
   * @param {number=} index The index to start substituting data at.
   */
  render(index = 0) {
    // Send to the VBO box to call WebGLRenderingContext.bufferSubData()
    vbo_boxes[this._vbo].vbo = this.s2;
    vbo_boxes[this._vbo].reload(vbo_boxes[this._vbo].vbo, index);
  }

  /**
   * Swaps two state vectors.
   *
   * @param {?Float32Array} s1 The previous state vector.
   * @param {?Float32Array} s2 The current state vector.
   */
  swap(s1, s2) {
    s1.set(s2);
  }

  /**
   * Adds a new force to the particle system, or replaces the set of forces
   * with a new set if an array is passed in.
   *
   * @param {?Force} f The force to be added to this particle system.
   */
  addForce(f) {
    this.force_set = f;
  }

  /**
   * Enables a force.
   *
   * @param {number} i The index of the force to be enabled.
   */
  enableForce(i) {
    this.force_set[i].enable();
  }

  /**
   * Disables a force.
   *
   * @param {number} i The index of the force to be disabled.
   */
  disableForce(i) {
    this.force_set[i].disable();
  }

  /**
   * Adds a new constraint to the particle system, or replaces the set of
   * constraints with a new set if an array is passed in.
   *
   * @param {?Constraint} c The constraint to be added to this particle system.
   */
  addConstraint(c) {
    this.constraint_set.push(c);
  }

  /**
   * Enables a constraint.
   *
   * @param {number} i The index of the constraint to be enabled.
   */
  enableConstraint(i) {
    this.constraint_set[i].enable();
  }

  /**
   * Disables a constraint.
   *
   * @param {number} i The index of the constraint to be disabled.
   */
  disableConstraint(i) {
    this.constraint_set[i].disable();
  }

  /**
   * Creates a string representation of a particle system.
   *
   * Concatinates the particle count with the set of constraints.
   *
   * @return {string} This particle system's text representation.
   */
  toString() {
    var partSysString = "" + this._BBALL_PARTICLE_COUNT;
    for (var constraint in this.constraint_set) {
      partSysString += constraint.toString();
    }
    return partSysString;
  }

  /**
   * Automatically creates controls for this particle system.
   */
  insertGui() {
    // Compute hash to distinguish this particle system
    const hash = hex_sha1(this.toString());
    var partSysFolder = gui.addFolder(PARTICLE_SYSTEM_STRINGS[this.type] + ' Particle System [' + hash.substring(0, 8) + ']');

    if (this._type == PARTICLE_SYSTEM.BOIDS) {
      tracker[hash + "_radius"] = this._boid_radius;
      partSysFolder.add(tracker, hash + "_radius").name("Boid Radius").onChange(function(value) {
        this._boid_radius = Math.max(value, 0);
      }.bind(this));
    }

    // Add a master toggle to hide all of this particle system's constraints
    tracker[hash + "_drawn"] = true;
    partSysFolder.add(tracker, hash + "_drawn").name("Show constraints").onChange(function(value) {
      this.constraint_set.forEach((constraint, i) => {
        if (VISIBLE_CONSTRAINTS.includes(constraint.type))
          constraint.draw(this._c_vbo, value && tracker["c_" + hash + "_" + hex_sha1(this.constraint_set[i].toString()) + "_drawn"]);
      });
    }.bind(this));

    // Add controls for each constraint individually
    for (var index in this.constraint_set) {
      if (VISIBLE_CONSTRAINTS.includes(this.constraint_set[index].type)) {
        const i = index;
        // Create unique attributes in the tracker object
        var constraintSubFolder = partSysFolder.addFolder('Constraint ' + i + ': ' + CONSTRAINT_STRINGS[this.constraint_set[index].type]);
        const c_hash = hex_sha1(this.constraint_set[i].toString());
        const attr = "c_" + hash + "_" + c_hash;

        // Toggle drawing this constraint
        var redraw = function(value) {
          this.constraint_set[i].draw(this._c_vbo, value && tracker[hash + "_drawn"], ...[...tracker[attr + "_color"].map(c => c / 255.0)]);
        };
        tracker[attr + "_drawn"] = true;
        partSysFolder.add(tracker, attr + "_drawn").name("Visible").onChange(redraw.bind(this));

        switch (this.constraint_set[i].type) {
          case CONSTRAINT_TYPE.VOLUME_IMPULSIVE:
          case CONSTRAINT_TYPE.VOLUME_VELOCITY_REVERSE:
            // Adjust this constraint's bounds
            tracker[attr + "_x_min"] = this.constraint_set[i].bounds[0];
            constraintSubFolder.add(tracker, attr + "_x_min").name("x-min").onChange(function() {
              if (tracker[attr + "_x_min"] >= tracker[attr + "_x_max"]) {
                tracker[attr + "_x_min"] = tracker[attr + "_x_max"] - 0.1;
              }
              this.constraint_set[i].x_min = tracker[attr + "_x_min"];
              this.constraint_set[i].draw(this._c_vbo, tracker[attr + "_drawn"] && tracker[hash + "_drawn"]);
            }.bind(this));
            tracker[attr + "_x_max"] = this.constraint_set[i].bounds[1];
            constraintSubFolder.add(tracker, attr + "_x_max").name("x-max").onChange(function() {
              if (tracker[attr + "_x_max"] <= tracker[attr + "_x_min"]) {
                tracker[attr + "_x_max"] = tracker[attr + "_x_min"] + 0.1;
              }
              this.constraint_set[i].x_max = tracker[attr + "_x_max"];
              this.constraint_set[i].draw(this._c_vbo, tracker[attr + "_drawn"] && tracker[hash + "_drawn"]);
            }.bind(this));
            tracker[attr + "_y_min"] = this.constraint_set[i].bounds[2];
            constraintSubFolder.add(tracker, attr + "_y_min").name("y-min").onChange(function() {
              if (tracker[attr + "_y_min"] >= tracker[attr + "_y_max"]) {
                tracker[attr + "_y_min"] = tracker[attr + "_y_max"] - 0.1;
              }
              this.constraint_set[i].y_min = tracker[attr + "_y_min"];
              this.constraint_set[i].draw(this._c_vbo, tracker[attr + "_drawn"] && tracker[hash + "_drawn"]);
            }.bind(this));
            tracker[attr + "_y_max"] = this.constraint_set[i].bounds[3];
            constraintSubFolder.add(tracker, attr + "_y_max").name("y-max").onChange(function() {
              if (tracker[attr + "_y_max"] <= tracker[attr + "_y_min"]) {
                tracker[attr + "_y_max"] = tracker[attr + "_y_min"] + 0.1;
              }
              this.constraint_set[i].y_max = tracker[attr + "_y_max"];
              this.constraint_set[i].draw(this._c_vbo, tracker[attr + "_drawn"] && tracker[hash + "_drawn"]);
            }.bind(this));
            tracker[attr + "_z_min"] = this.constraint_set[i].bounds[4];
            constraintSubFolder.add(tracker, attr + "_z_min").name("z-min").onChange(function() {
              if (tracker[attr + "_z_min"] >= tracker[attr + "_z_max"]) {
                tracker[attr + "_z_min"] = tracker[attr + "_z_max"] - 0.1;
              }
              this.constraint_set[i].z_min = tracker[attr + "_z_min"];
              this.constraint_set[i].draw(this._c_vbo, tracker[attr + "_drawn"] && tracker[hash + "_drawn"]);
            }.bind(this));
            tracker[attr + "_z_max"] = this.constraint_set[i].bounds[5];
            constraintSubFolder.add(tracker, attr + "_z_max").name("z-max").onChange(function() {
              if (tracker[attr + "_z_max"] <= tracker[attr + "_z_min"]) {
                tracker[attr + "_z_max"] = tracker[attr + "_z_min"] + 0.1;
              }
              this.constraint_set[i].z_max = tracker[attr + "_z_max"];
              this.constraint_set[i].draw(this._c_vbo, tracker[attr + "_drawn"] && tracker[hash + "_drawn"]);
            }.bind(this));
            tracker[attr + "_enabled"] = true;
            constraintSubFolder.add(tracker, attr + "_enabled").name("Enabled").onChange(function(value) {
              value ? this.constraint_set[i].enable() : this.constraint_set[i].disable();
            }.bind(this));
            break;
          case CONSTRAINT_TYPE.SPHERE:
            tracker[attr + "_x"] = this.constraint_set[i].bounds[0];
            constraintSubFolder.add(tracker, attr + "_x", -2, 2, 0.125).name("x").onChange(function() {
              this.constraint_set[i].x = tracker[attr + "_x"];
              this.constraint_set[i].draw(
                this._c_vbo,
                tracker[attr + "_drawn"] && tracker[hash + "_drawn"],
                ...[...tracker[attr + "_color"].map(c => c / 255.0)]);
            }.bind(this));
            tracker[attr + "_y"] = this.constraint_set[i].bounds[1];
            constraintSubFolder.add(tracker, attr + "_y", -2, 2, 0.125).name("y").onChange(function() {
              this.constraint_set[i].y = tracker[attr + "_y"];
              this.constraint_set[i].draw(
                this._c_vbo,
                tracker[attr + "_drawn"] && tracker[hash + "_drawn"],
                ...[...tracker[attr + "_color"].map(c => c / 255.0)]);
            }.bind(this));
            tracker[attr + "_z"] = this.constraint_set[i].bounds[2];
            constraintSubFolder.add(tracker, attr + "_z", -2, 2, 0.125).name("z").onChange(function() {
              this.constraint_set[i].z = tracker[attr + "_z"];
              this.constraint_set[i].draw(
                this._c_vbo,
                tracker[attr + "_drawn"] && tracker[hash + "_drawn"],
                ...[...tracker[attr + "_color"].map(c => c / 255.0)]);
            }.bind(this));
            tracker[attr + "_r"] = this.constraint_set[i].bounds[3];
            constraintSubFolder.add(tracker, attr + "_r", 0.125, 4, 0.125).name("radius").onChange(function() {
              this.constraint_set[i].r = tracker[attr + "_r"];
              this.constraint_set[i].draw(
                this._c_vbo,
                tracker[attr + "_drawn"] && tracker[hash + "_drawn"],
                ...[...tracker[attr + "_color"].map(c => c / 255.0)]);
            }.bind(this));
            break;
          default:
            break;
        }
        tracker[attr + "_color"] = [255, 255, 255];
        constraintSubFolder.addColor(tracker, attr + "_color").name("Color").onChange(redraw.bind(this));
      }
    }
  }
}

/**
 * Types of Forces.
 *
 * @enum {number}
 */
const FORCE_TYPE = {
  FORCE_SIMP_GRAVITY: 0,
  FORCE_DRAG: 1,
  FORCE_WIND: 2,
  FORCE_SPRING: 3,
  FORCE_CHARGE: 4,
  FORCE_FLOCK: 5,
  FORCE_GRAVITY: 6,
};

// How long the force should stay active
var TIMEOUT_NO_TIMEOUT = -1;
var TIMEOUT_INSTANT = 1;

/**
 * Creates a force in a particular direction for a specific duration.
 */
class Force {
  /**
   * @param {!FORCE_TYPE} type The type of force to implement.
   * @param {Array<number>} affected_particles The list of affected particles.
   * @param {number} timeout How long the force should last.
   */
  constructor(type, affected_particles) {
    this._type = type;
    this._p = affected_particles;
    this._enabled = true;
  }

  get x() {
    return this._x;
  }
  get y() {
    return this._y;
  }
  get z() {
    return this._z;
  }
  get magnitude() {
    return this._magnitude;
  }
  get type() {
    return this._type;
  }
  get particles() {
    return this._p;
  }

  set x(new_x) {
    this._x = new_x;
  }
  set y(new_y) {
    this._y = new_y;
  }
  set z(new_z) {
    this._z = new_z;
  }
  set magnitude(new_mag) {
    this._magnitude = new_mag;
  }

  /**
   * @param {number} magnitude The magnitude of the force vector.
   * @param {number} x The x component of the force vector.
   * @param {number} y The y component of the force vector.
   * @param {number} z The z component of the force vector.
   */
  init_vectored(magnitude = 1, x = 1, y = 1, z = 1) {
    this._magnitude = magnitude;
    this._x = x;
    this._y = y;
    this._z = z;
    return this;
  }

  /**
   * @param {number} k The spring constant.
   * @param {number} length The natural length of this spring.
   * @param {number} damp The damping of this spring.
   */
  init_spring(k, length, damp) {
    this._k = k;
    this._lr = length;
    this._d = damp;
    return this;
  }

  /**
   */
  init_boid() {
    return this;
  }

  /**
   * Enables this force.
   */
  enable() {
    this._enabled = true;
  }

  /**
   * Disables this force.
   */
  disable() {
    this._enabled = false;
  }

  /**
   * Applies this force to a given state vector.
   *
   * @param {!Float32Array} s The state vector to apply this force to.
   */
  apply(s) {
    if (!this._enabled)
      return;
    switch (this._type) {
      case FORCE_TYPE.FORCE_SIMP_GRAVITY:
        for (var i = 0; i < this._p.length; i++) {
          s[(this._p[i] * STATE_SIZE) + STATE.F_Z] += s[(this._p[i] * STATE_SIZE) + STATE.MASS] * this.magnitude;
        }
        break;
      case FORCE_TYPE.FORCE_DRAG:
        for (var i = 0; i < this._p.length; i++) {
          s[(this._p[i] * STATE_SIZE) + STATE.F_X] -= s[(this._p[i] * STATE_SIZE) + STATE.V_X] * (this.x * this.magnitude);
          s[(this._p[i] * STATE_SIZE) + STATE.F_Y] -= s[(this._p[i] * STATE_SIZE) + STATE.V_Y] * (this.y * this.magnitude);
          s[(this._p[i] * STATE_SIZE) + STATE.F_Z] -= s[(this._p[i] * STATE_SIZE) + STATE.V_Z] * (this.z * this.magnitude);
        }
        break;
      case FORCE_TYPE.FORCE_WIND:
        for (var i = 0; i < this._p.length; i++) {
          s[(this._p[i] * STATE_SIZE) + STATE.F_X] += this.x * this.magnitude * Math.random();
          s[(this._p[i] * STATE_SIZE) + STATE.F_Y] += this.y * this.magnitude * Math.random();
          s[(this._p[i] * STATE_SIZE) + STATE.F_Z] += this.z * this.magnitude * Math.random();
        }
        break;
      case FORCE_TYPE.FORCE_SPRING:
        // Find the distance between pairs of points
        var Lx = s[(this._p[1] * STATE_SIZE) + STATE.P_X] - s[(this._p[0] * STATE_SIZE) + STATE.P_X];
        var Ly = s[(this._p[1] * STATE_SIZE) + STATE.P_Y] - s[(this._p[0] * STATE_SIZE) + STATE.P_Y];
        var Lz = s[(this._p[1] * STATE_SIZE) + STATE.P_Z] - s[(this._p[0] * STATE_SIZE) + STATE.P_Z];
        var distance = Math.sqrt(Math.pow(Lx, 2) + Math.pow(Ly, 2) + Math.pow(Lz, 2));
        // Find L, the spring displacement length
        var L = distance - this._lr;
        // Apply Hook's Law
        // Normalize the vector [Lx, Ly, Lz], multiply L by the spring constant
        var Fx = this._k * L * Lx / distance;
        var Fy = this._k * L * Ly / distance;
        var Fz = this._k * L * Lz / distance;
        // Dampen the forces
        // Multiply damping coeff. by difference in velocities of particles and by the square of the normalized L vector
        // TODO Figure out why this skews to the +y direction
        // Fx += -1 * this._d * s[(this._p[0] * STATE_SIZE) + STATE.V_X] - s[(this._p[1] * STATE_SIZE) + STATE.V_X] * Math.pow(Lx / distance, 2);
        // Fy += -1 * this._d * s[(this._p[0] * STATE_SIZE) + STATE.V_Y] - s[(this._p[1] * STATE_SIZE) + STATE.V_Y] * Math.pow(Ly / distance, 2);
        // Fz += -1 * this._d * s[(this._p[0] * STATE_SIZE) + STATE.V_Z] - s[(this._p[1] * STATE_SIZE) + STATE.V_Z] * Math.pow(Lz / distance, 2);
        // Apply force to P0, and inverse force to P1
        s[(this._p[0] * STATE_SIZE) + STATE.F_X] += Fx;
        s[(this._p[0] * STATE_SIZE) + STATE.F_Y] += Fy;
        s[(this._p[0] * STATE_SIZE) + STATE.F_Z] += Fz;
        s[(this._p[1] * STATE_SIZE) + STATE.F_X] += -Fx;
        s[(this._p[1] * STATE_SIZE) + STATE.F_Y] += -Fy;
        s[(this._p[1] * STATE_SIZE) + STATE.F_Z] += -Fz;
        break;
      default:
        console.log("Unimplemented force type: " + this._type);
        return;
    }
  }

  /**
   * Toggles drawing of this constraint, and updates vertices when bounds change.
   *
   * @param {!VBOBox} vbo The VBO to update.
   * @param {number} index The index of this constraint.
   * @param {boolean} enabled Whether this constraint should be drawn.
   */
  draw(vbo, index, enabled, p0, p1) {
    var r = Math.random();
    var g = Math.random();
    var b = Math.random();
    var epsilon = 0.01;
    enabled = enabled && this._enabled;
    switch (this._type) {
      case FORCE_TYPE.FORCE_SPRING:
        var len = Math.sqrt(Math.pow(p1[0] - p0[0], 2) + Math.pow(p1[1] - p0[1], 2) + Math.pow(p1[2] - p0[2], 2));
        if (Math.abs(len - this._lr) < epsilon) {
          // Approximately natural length
          r = g = b = 1;
        } else {
          var delta = 1 - Math.abs(len - this._lr) / this._lr;
          if (delta <= 0.33) {
            g = b = delta;
            r = 1;
          } else {
            r = g = delta;
            b = 1;
          }
        }
        vbo.reload(
          new Float32Array([
            p0[0], p0[1], p0[2], r, g, b, enabled | 0,
            p1[0], p1[1], p1[2], r, g, b, enabled | 0,
          ]),
          index * 7 * 2);
        break;
      default:
        break;
    }
  }

}

/**
 * Types of Constraints.
 *
 * @enum {number}
 */
const CONSTRAINT_TYPE = {
  VOLUME_IMPULSIVE: 0,
  VOLUME_VELOCITY_REVERSE: 1,
  SPHERE: 2,
  ABSOLUTE: 3,
};
const CONSTRAINT_STRINGS = [
  "Volume [Impulsive]",
  "Volume [Velocity Reverse]",
  "Sphere",
  "Absolute Position",
];

/**
 * Shortcut values for enabling only particular walls in a volume constraint.
 *
 * @enum {number}
 */
const WALL = {
  ALL: 0b111111,
  NONE: 0b000000,
  TOP: 0b000001,
  BOTTOM: 0b000010,
  FRONT: 0b000100,
  BACK: 0b001000,
  LEFT: 0b010000,
  RIGHT: 0b100000,
};

const VISIBLE_CONSTRAINTS = [CONSTRAINT_TYPE.VOLUME_IMPULSIVE, CONSTRAINT_TYPE.VOLUME_VELOCITY_REVERSE, CONSTRAINT_TYPE.SPHERE];
// Used to keep track of what index this constraint is in the VBO
var __constraint_volume_index = 0;

/**
 * Creates rules for a constraint, and a function to be called to fix the
 * state vector if a constraint is not met.
 */
class Constraint {
  /**
   * @param {!CONSTRAINT_TYPE} type The type of constraint to represent.
   * @param {Array<number>} affected_particles The list of particles to constrain.
   * @param {!WALL=} enabled_walls The walls to enable for this constraint.
   * @param {...number} bounds The rest of the arguments are all numbers which bound the constraint.
   */
  constructor(type, affected_particles, enabled_walls = WALL.NONE, ...bounds) {
    this._type = type;
    this._index = -1;
    switch (this._type) {
      case CONSTRAINT_TYPE.VOLUME_IMPULSIVE:
      case CONSTRAINT_TYPE.VOLUME_VELOCITY_REVERSE:
        this._x_min = bounds[0];
        this._x_max = bounds[1];
        this._y_min = bounds[2];
        this._y_max = bounds[3];
        this._z_min = bounds[4];
        this._z_max = bounds[5];
        this._index = __constraint_volume_index;
        __constraint_volume_index++;
        break;
      case CONSTRAINT_TYPE.SPHERE:
        this._c = glMatrix.vec3.fromValues(bounds[0], bounds[1], bounds[2]);
        this._r = bounds[3];
        this._index = __constraint_volume_index;
        __constraint_volume_index += 2;
        break;
      case CONSTRAINT_TYPE.ABSOLUTE:
        this._x = bounds[0];
        this._y = bounds[1];
        this._z = bounds[2];
        break;
      default:
        console.log("invalid constraint type: " + type);
        break;
    }
    this._p = affected_particles;
    this._walls = enabled_walls;
    this._enabled = true;
  }

  get type() {
    return this._type;
  }
  get bounds() {
    var out;
    switch (this.type) {
      case CONSTRAINT_TYPE.VOLUME_IMPULSIVE:
      case CONSTRAINT_TYPE.VOLUME_VELOCITY_REVERSE:
        out = [this._x_min, this._x_max, this._y_min, this._y_max, this._z_min, this._z_max];
        break;
      case CONSTRAINT_TYPE.SPHERE:
        out = [this._c[0], this._c[1], this._c[2], this._r];
        break;
      default:
        out = [];
        break;
    }
    return out;
  }

  set x(new_x) {
    switch (this._type) {
      case CONSTRAINT_TYPE.SPHERE:
        this._c[0] = new_x;
        break;
      default:
        break;
    }
  }
  set y(new_y) {
    switch (this._type) {
      case CONSTRAINT_TYPE.SPHERE:
        this._c[1] = new_y;
        break;
      default:
        break;
    }
  }
  set z(new_z) {
    switch (this._type) {
      case CONSTRAINT_TYPE.SPHERE:
        this._c[2] = new_z;
        break;
      default:
        break;
    }
  }
  set r(new_r) {
    this._r = new_r;
  }
  set x_min(x) {
    this._x_min = x;
  }
  set x_max(x) {
    this._x_max = x;
  }
  set y_min(y) {
    this._y_min = y;
  }
  set y_max(y) {
    this._y_max = y;
  }
  set z_min(z) {
    this._z_min = z;
  }
  set z_max(z) {
    this._z_max = z;
  }

  /**
   * Enables this constraint.
   */
  enable() {
    this._enabled = true;
  }

  /**
   * Disables this constraint.
   */
  disable() {
    this._enabled = false;
  }

  /**
   * Ensures the current state vector meets this constraint.
   *
   * @param {!Float32Array} s1 The previous state vector.
   * @param {!Float32Array} s2 The current state vector.
   */
  constrain(s1, s2) {
    if (!this._enabled)
      return;
    switch (this._type) {
      case CONSTRAINT_TYPE.VOLUME_IMPULSIVE:
        for (var i = 0; i < this._p.length; i++) {
          // bounce on left wall
          if ((this._walls & WALL.LEFT) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X] < this._x_min &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] <= 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X] = this._x_min;
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] =
              Math.abs(s1[(this._p[i] * STATE_SIZE) + STATE.V_X]) * tracker.drag * tracker.restitution;
          }
          // bounce on right wall
          if ((this._walls & WALL.RIGHT) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X] > this._x_max &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] >= 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X] = this._x_max;
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] = Math.abs(s1[(this._p[i] * STATE_SIZE) + STATE.V_X]) * tracker.drag * tracker.restitution * -1;
          }
          // bounce on front wall
          if ((this._walls & WALL.FRONT) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] < this._y_min &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] <= 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] = this._y_min;
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] =
              Math.abs(s1[(this._p[i] * STATE_SIZE) + STATE.V_Y]) * tracker.drag * tracker.restitution;
          }
          // bounce on back wall
          if ((this._walls & WALL.BACK) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] > this._y_max &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] >= 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] = this._y_max;
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] =
              Math.abs(s1[(this._p[i] * STATE_SIZE) + STATE.V_Y]) * tracker.drag * tracker.restitution * -1;
          }
          // bounce on floor
          if ((this._walls & WALL.BOTTOM) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] < this._z_min &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] <= 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] = this._z_min;
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] =
              Math.abs(s1[(this._p[i] * STATE_SIZE) + STATE.V_Z]) * tracker.drag * tracker.restitution;
          }
          // bounce on ceiling
          if ((this._walls & WALL.TOP) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] > this._z_max &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] >= 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] = this._z_max;
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] =
              Math.abs(s1[(this._p[i] * STATE_SIZE) + STATE.V_Z]) * tracker.drag * tracker.restitution * -1;
          }

        }
        break;
      case CONSTRAINT_TYPE.VOLUME_VELOCITY_REVERSE:
        for (var i = 0; i < this._p.length; i++) {
          // bounce on left wall
          if (s2[(this._p[i] * STATE_SIZE) + STATE.P_X] < this._x_min && s2[(this._p[i] * STATE_SIZE) + STATE.V_X] < 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] = -tracker.restitution * s2[(this._p[i] * STATE_SIZE) + STATE.V_X];
          }
          // bounce on right wall
          if (s2[(this._p[i] * STATE_SIZE) + STATE.P_X] > this._x_max && s2[(this._p[i] * STATE_SIZE) + STATE.V_X] > 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] = -tracker.restitution * s2[(this._p[i] * STATE_SIZE) + STATE.V_X];
          }
          // bounce on front wall
          if (s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] < this._y_min && s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] < 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] = -tracker.restitution * s2[(this._p[i] * STATE_SIZE) + STATE.V_Y];
          }
          // bounce on back wall
          if (s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] > this._y_max && s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] > 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] = -tracker.restitution * s2[(this._p[i] * STATE_SIZE) + STATE.V_Y];
          }
          // bounce on floor
          if (s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] < this._z_min && s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] < 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] = -tracker.restitution * s2[(this._p[i] * STATE_SIZE) + STATE.V_Z];
          }
          // bounce on ceiling
          if (s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] > this._z_max && s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] > 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] = -tracker.restitution * s2[(this._p[i] * STATE_SIZE) + STATE.V_Z];
          }
          // hard limit on 'floor' keeps z position >= 0;
          if (s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] < this._z_min) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] = this._z_min;
          }
        }
        break;
      case CONSTRAINT_TYPE.SPHERE:
        var part_pos = glMatrix.vec3.create();
        var part_vel = glMatrix.vec3.create();
        for (var i = 0; i < this._p.length; i++) {
          part_pos = glMatrix.vec3.fromValues(
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X],
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y],
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z]);
          // Particle is inside the sphere
          if (glMatrix.vec3.dist(part_pos, this._c) < this._r) {
            // Place particle on the sphere's surface
            glMatrix.vec3.subtract(part_pos, part_pos, this._c);
            glMatrix.vec3.normalize(part_pos, part_pos);
            glMatrix.vec3.scale(part_pos, part_pos, this._r);
            glMatrix.vec3.add(part_pos, part_pos, this._c);
            // Make the particle's velocity normal to the sphere's surface
            glMatrix.vec3.subtract(part_vel, part_pos, this._c);
            glMatrix.vec3.normalize(part_vel, part_vel);
            glMatrix.vec3.scale(part_vel, part_vel, glMatrix.vec3.len(glMatrix.vec3.fromValues(
              s2[(this._p[i] * STATE_SIZE) + STATE.V_X],
              s2[(this._p[i] * STATE_SIZE) + STATE.V_Y],
              s2[(this._p[i] * STATE_SIZE) + STATE.V_Z]
            )));
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X] = part_pos[0];
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] = part_pos[1];
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] = part_pos[2];
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] = part_vel[0];
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] = part_vel[1];
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] = part_vel[2];
          }
        }
        break;
      case CONSTRAINT_TYPE.ABSOLUTE:
        for (var i = 0; i < this._p.length; i++) {
          s2[(this._p[i] * STATE_SIZE) + STATE.P_X] = this._x;
          s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] = this._y;
          s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] = this._z;
          s2[(this._p[i] * STATE_SIZE) + STATE.V_X] = 0;
          s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] = 0;
          s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] = 0;
        }
        break;
      default:
        return;
    }
  }

  /**
   * Toggles drawing of this constraint, and updates vertices when bounds change.
   *
   * @param {!VBOBox} vbo The VBO to update.
   * @param {boolean} enabled Whether this constraint should be drawn.
   */
  draw(vbo, visible, r, g, b) {
    visible = visible && this._enabled;
    switch (this._type) {
      case CONSTRAINT_TYPE.VOLUME_IMPULSIVE:
      case CONSTRAINT_TYPE.VOLUME_VELOCITY_REVERSE:
        vbo_boxes[vbo].reload(
          new Float32Array([
            this._x_min, this._y_min, this._z_min, r, g, b, visible | 0, // 1
            this._x_min, this._y_max, this._z_min, r, g, b, visible | 0, // 2

            this._x_min, this._y_max, this._z_min, r, g, b, visible | 0, // 2
            this._x_max, this._y_max, this._z_min, r, g, b, visible | 0, // 3

            this._x_max, this._y_max, this._z_min, r, g, b, visible | 0, // 3
            this._x_max, this._y_min, this._z_min, r, g, b, visible | 0, // 4

            this._x_max, this._y_min, this._z_min, r, g, b, visible | 0, // 4
            this._x_min, this._y_min, this._z_min, r, g, b, visible | 0, // 1

            this._x_max, this._y_min, this._z_max, r, g, b, visible | 0, // 5
            this._x_max, this._y_max, this._z_max, r, g, b, visible | 0, // 6

            this._x_max, this._y_max, this._z_max, r, g, b, visible | 0, // 6
            this._x_min, this._y_max, this._z_max, r, g, b, visible | 0, // 7

            this._x_min, this._y_max, this._z_max, r, g, b, visible | 0, // 7
            this._x_min, this._y_min, this._z_max, r, g, b, visible | 0, // 8

            this._x_min, this._y_min, this._z_max, r, g, b, visible | 0, // 8
            this._x_max, this._y_min, this._z_max, r, g, b, visible | 0, // 5

            this._x_min, this._y_min, this._z_min, r, g, b, visible | 0, // 1
            this._x_min, this._y_min, this._z_max, r, g, b, visible | 0, // 8

            this._x_min, this._y_max, this._z_min, r, g, b, visible | 0, // 2
            this._x_min, this._y_max, this._z_max, r, g, b, visible | 0, // 7

            this._x_max, this._y_max, this._z_min, r, g, b, visible | 0, // 3
            this._x_max, this._y_max, this._z_max, r, g, b, visible | 0, // 6

            this._x_max, this._y_min, this._z_min, r, g, b, visible | 0, // 4
            this._x_max, this._y_min, this._z_max, r, g, b, visible | 0, // 5
          ]),
          this._index * 7 * 24);
        break;
      case CONSTRAINT_TYPE.SPHERE:
        var out = glMatrix.vec3.create();
        var corner = Math.sqrt(2) / 2;
        vbo_boxes[vbo].reload(
          new Float32Array([
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(this._r, 0, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(this._r * corner, 0, this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(this._r * corner, 0, this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, 0, this._r))], r, g, b, visible | 0,

            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, 0, this._r))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(-this._r * corner, 0, this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(-this._r * corner, 0, this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(-this._r, 0, 0))], r, g, b, visible | 0,

            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(-this._r, 0, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(-this._r * corner, 0, -this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(-this._r * corner, 0, -this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, 0, -this._r))], r, g, b, visible | 0,

            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, 0, -this._r))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(this._r * corner, 0, -this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(this._r * corner, 0, -this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(this._r, 0, 0))], r, g, b, visible | 0,

            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(this._r, 0, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(this._r * corner, this._r * corner, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(this._r * corner, this._r * corner, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, this._r, 0))], r, g, b, visible | 0,

            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, this._r, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(-this._r * corner, this._r * corner, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(-this._r * corner, this._r * corner, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(-this._r, 0, 0))], r, g, b, visible | 0,

            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(-this._r, 0, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(-this._r * corner, -this._r * corner, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(-this._r * corner, -this._r * corner, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, -this._r, 0))], r, g, b, visible | 0,

            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, -this._r, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(this._r * corner, -this._r * corner, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(this._r * corner, -this._r * corner, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(this._r, 0, 0))], r, g, b, visible | 0,

            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, this._r, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, this._r * corner, this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, this._r * corner, this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, 0, this._r))], r, g, b, visible | 0,

            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, 0, this._r))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, -this._r * corner, this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, -this._r * corner, this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, -this._r, 0))], r, g, b, visible | 0,

            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, -this._r, 0))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, -this._r * corner, -this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, -this._r * corner, -this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, 0, -this._r))], r, g, b, visible | 0,

            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, 0, -this._r))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, this._r * corner, -this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, this._r * corner, -this._r * corner))], r, g, b, visible | 0,
            ...[...glMatrix.vec3.add(out, this._c, glMatrix.vec3.fromValues(0, this._r, 0))], r, g, b, visible | 0,
          ]),
          this._index * 7 * 24);
        break;
      default:
        break;
    }
  }

  /**
   * Returns a string representation of this constraint.
   *
   * @return {string} A concatination of the constraint's type and bounds.
   */
  toString() {
    return "" + this._index + "" + this.type + "" + this.bounds;
  }
}
