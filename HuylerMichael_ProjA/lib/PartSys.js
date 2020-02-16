/**
 * The Particle System class.
 *
 * @author Michael Huyler
 */

/**
 * Types of particle systems.
 *
 * @enum {number}
 */
const PARTICLE_SYSTEM = {
  SNOW: 0,
  CLOTH: 1,
  BOIDS: 2,
  REEVES_FIRE: 3,
};
const PARTICLE_SYSTEM_STRINGS = ["Snow", "Cloth Simulation", "Boids", "Reeve's Fire"];

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
  RADIUS: 14,
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
  QUADRATIC_MIDPOINT_INVERSE: 2,
  ADAMS_BASHFORTH: 3,
  VERLET: 4,
};

/**
 * Abstract Particle System.
 */
class PartSys {
  /**
   * @param {number} FIRE_PARTICLE_COUNT The number of particles to initialize.
   */
  constructor(FIRE_PARTICLE_COUNT) {
    this._type = -1;
    this._FIRE_PARTICLE_COUNT = FIRE_PARTICLE_COUNT;
    this._vbo = null;
    this._c_vbo = -1;
    this._s1 = new Float32Array(FIRE_PARTICLE_COUNT * STATE_SIZE);
    for (var i = 0; i < FIRE_PARTICLE_COUNT * STATE_SIZE; i += STATE_SIZE) {
      this._s1[i + STATE.P_X] = Math.random() * 2 - 1;
      this._s1[i + STATE.P_Y] = Math.random() * 2 - 1;
      this._s1[i + STATE.P_Z] = Math.random() * 2;
      this._s1[i + STATE.MASS] = 1;
      this._s1[i + STATE.R] = Math.random();
      this._s1[i + STATE.G] = Math.random();
      this._s1[i + STATE.B] = Math.random();
      this._s1[i + STATE.A] = 1;
    }
    this._s0 = this._s1.slice();
    this._s0dot = this._s1.slice();
    this._s1dot = this._s1.slice();
    this._s2 = this._s1.slice();
    this._s2dot = this._s1.slice();
    this._sM = this._s1.slice();
    this._sMdot = this._s1.slice();
    this._s3 = this._s1.slice();
    this._sErr = this._s1.slice();
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
  get s2dot() {
    return this._s2dot;
  }
  get sM() {
    return this._sM;
  }
  get sMdot() {
    return this._sMdot;
  }
  get s3() {
    return this._s3;
  }
  get sErr() {
    return this._sErr;
  }
  get s0() {
    return this._s0;
  }
  get s0dot() {
    return this._s0dot;
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
  set s2dot(s) {
    this._s2dot = s;
  }
  set sM(s) {
    this._sM = s;
  }
  set sMdot(s) {
    this._sMdot = s;
  }
  set s3(s) {
    this._s3 = s;
  }
  set sErr(s) {
    this._sErr = s;
  }
  set s0(s) {
    this._s0 = s;
  }
  set s0dot(s) {
    this._s0dot = s;
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
      dot[i + STATE.RADIUS] = 0;
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
        this.s2.map((v, i) => {
          this.s2[i] = this.s1[i] + this.s1dot[i] * (tracker.ms * 0.001);
        });
        break;
      case SOLVER.MIDPOINT:
        this.sM.map((v, i) => {
          this.sM[i] = this.s1[i] + this.s1dot[i] * (tracker.ms * 0.0005);
        });
        this.sMdot = this.dotFinder(this.sM);
        this.s2.map((v, i) => {
          this.s2[i] = this.s1[i] + this.sMdot[i] * (tracker.ms * 0.001);
        });
        break;
      case SOLVER.QUADRATIC_MIDPOINT_INVERSE:
        // Forward
        this.sM.map((v, i) => {
          this.sM[i] = this.s1[i] + this.s1dot[i] * (tracker.ms * 0.0005);
        });
        this.sMdot = this.dotFinder(this.sM);
        this.s2.map((v, i) => {
          this.s2[i] = this.s1[i] + this.sMdot[i] * (tracker.ms * 0.001);
        });
        // Backward
        this.s2dot = this.dotFinder(this.s2);
        this.sM.map((v, i) => {
          this.sM[i] = this.s2[i] - this.s2dot[i] * (tracker.ms * 0.0005);
        });
        this.sMdot = this.dotFinder(this.sM);
        this.s3.map((v, i) => {
          this.s3[i] = this.s2[i] - this.sMdot[i] * (tracker.ms * 0.001);
        });
        this.sErr.map((v, i) => {
          this.sErr[i] = this.s3[i] - this.s1[i];
        });
        this.s2.map((v, i) => {
          this.s2[i] -= this.sErr[i] * 0.5;
        });
        break;
      case SOLVER.ADAMS_BASHFORTH:
        this.s0dot = this.dotFinder(this.s0);
        this.s2.map((v, i) => {
          this.s2[i] = this.s1[i] + this.s1dot[i] * (tracker.ms * 0.0015) - this.s0dot[i] * (tracker.ms * 0.0005);
        });
        break;
      case SOLVER.VERLET:
        // TODO
        break;
      default:
        console.log('unknown solver: ' + solver_type);
        break;
    }
    // For Snow, we care about age
    if (this._type == PARTICLE_SYSTEM.SNOW) {
      for (var i = 0; i < this.s2.length / STATE_SIZE; i++) {
        // Decrement age
        this.s2[(i * STATE_SIZE) + STATE.AGE] -= 1;
        if (this.s2[(i * STATE_SIZE) + STATE.AGE] < 0) {
          // Reset age
          this.s2[(i * STATE_SIZE) + STATE.AGE] = 300;
          // Make it fall again
          this.s2[(i * STATE_SIZE) + STATE.P_X] = Math.random() * top_m[0] + top_a[0];
          this.s2[(i * STATE_SIZE) + STATE.P_Y] = Math.random() * top_m[1] + top_a[1];
          this.s2[(i * STATE_SIZE) + STATE.P_Z] = Math.random() * top_m[2] + top_a[2];
          this.s2[(i * STATE_SIZE) + STATE.V_X] = 0;
          this.s2[(i * STATE_SIZE) + STATE.V_Y] = 0;
          this.s2[(i * STATE_SIZE) + STATE.V_Z] = 0;
        }
      }
    }
    // For Reeve's fire, alpha depends on z position, and we care about age
    if (this._type == PARTICLE_SYSTEM.REEVES_FIRE) {
      var sphere = this.constraint_set[1].bounds;
      var r = sphere[3];
      var min = this.constraint_set[0].bounds[4];
      var max = this.constraint_set[0].bounds[5];
      for (var i = 0; i < this.s2.length / STATE_SIZE; i++) {
        // Decrement age
        this.s2[(i * STATE_SIZE) + STATE.AGE] -= 1;
        if (this.s2[(i * STATE_SIZE) + STATE.AGE] < 0) {
          // Reset age, color
          this.s2[(i * STATE_SIZE) + STATE.AGE] = 60;
          this.s2[(i * STATE_SIZE) + STATE.R] = 1;
          this.s2[(i * STATE_SIZE) + STATE.G] = 1;
          this.s2[(i * STATE_SIZE) + STATE.B] = 1;
          // Place on the surface of the sphere
          var z = Math.random() * (sphere[3] + sphere[3]) - sphere[3];
          var φ = Math.random() * 2 * Math.PI;
          var θ = Math.acos(z / r);
          this.s2[(i * STATE_SIZE) + STATE.P_X] = r * Math.sin(θ) * Math.cos(φ) + sphere[0];
          this.s2[(i * STATE_SIZE) + STATE.P_Y] = r * Math.sin(θ) * Math.sin(φ) + sphere[1];
          this.s2[(i * STATE_SIZE) + STATE.P_Z] = Math.min(Math.max(z + sphere[2], min), max);
        }
        // Older particles cool off (become less white)
        this.s2[(i * STATE_SIZE) + STATE.R] *= 1;
        this.s2[(i * STATE_SIZE) + STATE.G] *= 0.97;
        this.s2[(i * STATE_SIZE) + STATE.B] *= 0.7;
        // Set alpha according to distance from edge of sphere
        var dist = glMatrix.vec3.distance(
          glMatrix.vec3.fromValues(
            sphere[0],
            sphere[1],
            sphere[2]),
          glMatrix.vec3.fromValues(
            this.s2[(i * STATE_SIZE) + STATE.P_X],
            this.s2[(i * STATE_SIZE) + STATE.P_Y],
            this.s2[(i * STATE_SIZE) + STATE.P_Z])) - r;
        this.s2[(i * STATE_SIZE) + STATE.A] = 0.7 - (dist / (1.5 * r));
        if (this.s2[(i * STATE_SIZE) + STATE.A] < 0.2)
          this.s2[(i * STATE_SIZE) + STATE.A] = 0.2;
        if (this.s2[(i * STATE_SIZE) + STATE.A] > 0.7)
          this.s2[(i * STATE_SIZE) + STATE.A] = 0.7;
      }
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
  swap() {
    this.s0.set(this.s1);
    this.s1.set(this.s2);
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
    var partSysString = "" + this._FIRE_PARTICLE_COUNT;
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
            tracker[attr + "_restitution"] = this.constraint_set[i].restitution;
            constraintSubFolder.add(tracker, attr + "_restitution").name("restitution").onChange(function() {
              this.constraint_set[i].restitution = tracker[attr + "_restitution"];
            }.bind(this));
          case CONSTRAINT_TYPE.VOLUME_WRAP:
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
            constraintSubFolder.add(tracker, attr + "_r", 0.125, 2, 0.125).name("radius").onChange(function() {
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
