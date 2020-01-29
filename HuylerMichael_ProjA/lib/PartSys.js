/**
 * Classes used to implement a Particle Systems.
 *
 * @author Michael Huyler
 */

var STATE_SIZE = 7;
var xpos = 0;
var ypos = 1;
var zpos = 2;
var xvel = 3;
var yvel = 4;
var zvel = 5;
var age = 6;

/**
 * Abstract Particle System.
 */
class PartSys {
  constructor(particle_count) {
    this._particle_count = particle_count;
    this._s0 = new Float32Array(particle_count * STATE_SIZE);
    this._s0dot = this._s0.slice();
    this._s1 = this._s0.slice();
    this._force_set = [];
    this._constraint_set = [];
  }

  get s0() {
    return this._s0;
  }
  get s0dot() {
    return this._s0dot;
  }
  get s1() {
    return this._s1;
  }
  get force_set() {
    return this._force_set;
  }
  get constraint_set() {
    return this._constraint_set;
  }

  set s0(s) {
    this._s0 = s;
  }
  set s0dot(s) {
    this._s0dot = s;
  }
  set s1(s) {
    this._s1 = s;
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
    if (c instanceof Constraint) {
      this._constraint_set.push(c);
    } else if (Array.isArray(c)) {
      this._constraint_set = c;
    } else {
      console.error("improper constraint: " + typeof(c));
    }
  }

  /**
   * Sets up a particular particle system, influencing its general behavior.
   *
   * @param {number} part_sys_type The type of particle system to create.
   * @param {Array<Force>} force_set The set of initial forces acting on this particle system.
   * @param {Array<Constraint>} constraint_set The set of initial constraints limiting this particle system.
   */
  init(part_sys_type, force_set, constraint_set) {
    this.force_set = force_set;
    this.constraint_set = constraint_set;
  }

  /**
   * Applys all forces in forceArray, modifying state array s.
   */
  applyAllForces() {
    this.force_set.forEach((force, _) => force.apply(this.s1));
    this.force_set = this.force_set.filter(force => !force.expired());
  }

  /**
   * Finds the derivative w.r.t. time of state s.
   */
  dotFinder() {
    this._sdot = this.s1.slice();
  }

  /**
   * Creates s1 by approximating integration of s0 over a single timestep.
   *
   * @param {number} solver_type The type of solver to use.
   */
  solver(solver_type) {
    for (var i = 0; i < this.s1.length; i += STATE_SIZE) {
      this.s0[i + xpos] = this.s1[i + xpos];
      this.s0[i + xvel] = this.s1[i + xvel];
      this.s0[i + ypos] = this.s1[i + ypos];
      this.s0[i + yvel] = this.s1[i + yvel];
      this.s0[i + zpos] = this.s1[i + zpos];
      this.s0[i + zvel] = this.s1[i + zvel];
    }
    if (solver_type == 0) { // EXPLICIT (adds energy)
      for (var i = 0; i < this.s1.length; i += STATE_SIZE) {
        this.s1[i + xpos] += this.s1[i + xvel] * (timeStep * 0.001);
        this.s1[i + ypos] += this.s1[i + yvel] * (timeStep * 0.001);
        this.s1[i + zpos] += this.s1[i + zvel] * (timeStep * 0.001);
      }
      this.applyAllForces();
    } else if (solver_type == 1) { // IMPLICIT (loses energy)
      this.applyAllForces();
      for (var i = 0; i < this.s1.length; i += STATE_SIZE) {
        this.s1[i + xpos] += this.s1[i + xvel] * (timeStep * 0.001);
        this.s1[i + ypos] += this.s1[i + yvel] * (timeStep * 0.001);
        this.s1[i + zpos] += this.s1[i + zvel] * (timeStep * 0.001);
      }
    } else {
      console.log('unknown solver: ' + solver_type);
      return;
    }
  }

  /**
   * Applies all constraints for a given system.
   */
  doConstraints() {
    this.constraint_set.forEach((constraint, _) => {
      constraint.constrain(this.s0, this.s1);
    });
  }

  /**
   * Updates values for transferring to the GPU.
   *
   * @param {VBOBox} box The VBOBox whose VBO should be updated.
   */
  render(box) {
    // Send to the VBO box to call WebGLRenderingContext.bufferSubData()
    box.vbo = this.s1;
    box.reload(box.vbo);
  }

  /**
   * Swaps two state vectors.
   *
   * @param {Float32Array} s0 The previous state vector.
   * @param {Float32Array} s1 The current state vector.
   */
  swap(s0, s1) {
    [s0, s1] = [s1, s0];
  }

  /**
   * Adds a new force to the particle system, or replaces the set of forces
   * with a new set if an array is passed in.
   *
   * @param {Force} f The force to be added to this particle system.
   */
  addForce(f) {
    this.force_set = f;
  }

  /**
   * Adds a new constraint to the particle system, or replaces the set of
   * constraints with a new set if an array is passed in.
   *
   * @param {Constraint} c The constraint to be added to this particle system.
   */
  addConstraint(c) {
    this.constraint_set = c;
  }

  removeConstraint(i) {
    this.constraint_set.splice(i, 1);
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
}

// How long the force should stay active
var TIMEOUT_NO_TIMEOUT = -1;
var TIMEOUT_INSTANT = 1;

/**
 * Creates a force in a particular direction for a specific duration.
 */
class Force {
  /**
   * @param {FORCE_TYPE} type The type of force to implement.
   * @param {number} x The x component of the force vector.
   * @param {number} y The y component of the force vector.
   * @param {number} z The z component of the force vector.
   * @param {number} magnitude The magnitude of the force vector.
   * @param {number} timeout How long the force should last.
   */
  constructor(type, x, y, z, magnitude, timeout, affected_particles) {
    this._type = type;
    this._x = x;
    this._y = y;
    this._z = z;
    this._magnitude = magnitude;
    this._t = timeout;
    this._p = affected_particles;
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

  /**
   * Applies this force to a given state vector.
   *
   * @param {Float32Array} s The state vector to apply this force to.
   */
  apply(s) {
    switch (this._type) {
      case FORCE_TYPE.FORCE_SIMP_GRAVITY:
        for (var i = 0; i < this._p.length; i++) {
          s[(this._p[i] * STATE_SIZE) + zvel] += this.magnitude;
        }
        break;
      case FORCE_TYPE.FORCE_DRAG:
        for (var i = 0; i < this._p.length; i++) {
          s[(this._p[i] * STATE_SIZE) + xvel] *= (this.x * this.magnitude);
          s[(this._p[i] * STATE_SIZE) + yvel] *= (this.y * this.magnitude);
          s[(this._p[i] * STATE_SIZE) + zvel] *= (this.z * this.magnitude);
        }
        break;
      case FORCE_TYPE.FORCE_WIND:
        for (var i = 0; i < this._p.length; i++) {
          s[(this._p[i] * STATE_SIZE) + xvel] += this.x * this.magnitude * Math.random();
          s[(this._p[i] * STATE_SIZE) + yvel] += this.y * this.magnitude * Math.random();
          s[(this._p[i] * STATE_SIZE) + zvel] += this.z * this.magnitude * Math.random();
        }
        break;
      default:
        console.log("Unimplemented force type: " + this._type);
        return;
    }
    if (this.expires()) this._t -= 1;
  }

  /**
   * Checks if this force can time out.
   *
   * @return {boolean} Whether this force can time out.
   */
  expires() {
    return (this._t >= 0);
  }

  /**
   * Checks if this force has expired.
   *
   * @return {boolean} Whether this force has expired.
   */
  expired() {
    return this.expires() && this._t == 0;
  }

}

/**
 * Types of Constraints.
 */
const CONSTRAINT_TYPE = {
  VOLUME_IMPULSIVE: 0,
  VOLUME_VELOCITY_REVERSE: 1,
  SPHERE: 2,
  STIFF_SPRING: 3,
}

/**
 * Creates rules for a constraint, and a function to be called to fix the
 * state vector if a constraint is not met.
 */
class Constraint {
  /**
   * @param {function(Float32Array, Float32Array): boolean} predicate The
   *    predicate used to test whether this constraint has been met.
   * @param {function(Float32Array, Float32Array): undefined} fix The function
   *    used to repair the state vector.
   */
  constructor(type, affected_particles, ...bounds) {
    this._type = type;
    switch (this._type) {
      case CONSTRAINT_TYPE.VOLUME_IMPULSIVE:
      case CONSTRAINT_TYPE.VOLUME_VELOCITY_REVERSE:
        this._x_min = bounds[0];
        this._x_max = bounds[1];
        this._y_min = bounds[2];
        this._y_max = bounds[3];
        this._z_min = bounds[4];
        this._z_max = bounds[5];
        break;
      case CONSTRAINT_TYPE.SPHERE:
        this._x = bounds[0];
        this._y = bounds[1];
        this._z = bounds[2];
        break;
      case CONSTRAINT_TYPE.STIFF_SPRING:
        if (affected_particles.length != 2)
          console.error("invalid spring - wrong number of particles: " + affected_particles.length);
        // no bounds
        break;
      default:
        break;
    }
    this._p = affected_particles;
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
   * Ensures the current state vector meets this constraint.
   *
   * @param {Float32Array} s0 The previous state vector.
   * @param {Float32Array} s1 The current state vector.
   */
  constrain(s0, s1) {
    switch (this._type) {
      case CONSTRAINT_TYPE.VOLUME_IMPULSIVE:
        for (var i = 0; i < this._p.length; i++) {
          // bounce on left wall
          if (s1[(this._p[i] * STATE_SIZE) + xpos] < this._x_min && s1[(this._p[i] * STATE_SIZE) + xvel] < 0.0) {
            s1[(this._p[i] * STATE_SIZE) + xpos] = this._x_min;
            s1[(this._p[i] * STATE_SIZE) + xvel] = Math.abs(s0[(this._p[i] * STATE_SIZE) + xvel]) * tracker.drag * tracker.restitution;
          }
          // bounce on right wall
          if (s1[(this._p[i] * STATE_SIZE) + xpos] > this._x_max && s1[(this._p[i] * STATE_SIZE) + xvel] > 0.0) {
            s1[(this._p[i] * STATE_SIZE) + xpos] = this._x_max;
            s1[(this._p[i] * STATE_SIZE) + xvel] = -1 * Math.abs(s0[(this._p[i] * STATE_SIZE) + xvel]) * tracker.drag * tracker.restitution;
          }
          // bounce on front wall
          if (s1[(this._p[i] * STATE_SIZE) + ypos] < this._y_min && s1[(this._p[i] * STATE_SIZE) + yvel] < 0.0) {
            s1[(this._p[i] * STATE_SIZE) + ypos] = this._y_min;
            s1[(this._p[i] * STATE_SIZE) + yvel] = Math.abs(s0[(this._p[i] * STATE_SIZE) + yvel]) * tracker.drag * tracker.restitution;
          }
          // bounce on back wall
          if (s1[(this._p[i] * STATE_SIZE) + ypos] > this._y_max && s1[(this._p[i] * STATE_SIZE) + yvel] > 0.0) {
            s1[(this._p[i] * STATE_SIZE) + ypos] = this._y_max;
            s1[(this._p[i] * STATE_SIZE) + yvel] = -1 * Math.abs(s0[(this._p[i] * STATE_SIZE) + yvel]) * tracker.drag * tracker.restitution;
          }
          // bounce on floor
          if (s1[(this._p[i] * STATE_SIZE) + zpos] < this._z_min && s1[(this._p[i] * STATE_SIZE) + zvel] < 0.0) {
            s1[(this._p[i] * STATE_SIZE) + zpos] = this._z_min;
            s1[(this._p[i] * STATE_SIZE) + zvel] = Math.abs(s0[(this._p[i] * STATE_SIZE) + zvel]) * tracker.drag * tracker.restitution;
          }
          // bounce on ceiling
          if (s1[(this._p[i] * STATE_SIZE) + zpos] > this._z_max && s1[(this._p[i] * STATE_SIZE) + zvel] > 0.0) {
            s1[(this._p[i] * STATE_SIZE) + zpos] = this._z_max;
            s1[(this._p[i] * STATE_SIZE) + zvel] = -1 * Math.abs(s0[(this._p[i] * STATE_SIZE) + zvel]) * tracker.drag * tracker.restitution;
          }

        }
        break;
      case CONSTRAINT_TYPE.VOLUME_VELOCITY_REVERSE:
        for (var i = 0; i < this._p.length; i++) {
          // bounce on left wall
          if (s1[(this._p[i] * STATE_SIZE) + xpos] < this._x_min && s1[(this._p[i] * STATE_SIZE) + xvel] < 0.0) {
            s1[(this._p[i] * STATE_SIZE) + xvel] = -tracker.restitution * s1[(this._p[i] * STATE_SIZE) + xvel];
          }
          // bounce on right wall
          if (s1[(this._p[i] * STATE_SIZE) + xpos] > this._x_max && s1[(this._p[i] * STATE_SIZE) + xvel] > 0.0) {
            s1[(this._p[i] * STATE_SIZE) + xvel] = -tracker.restitution * s1[(this._p[i] * STATE_SIZE) + xvel];
          }
          // bounce on front wall
          if (s1[(this._p[i] * STATE_SIZE) + ypos] < this._y_min && s1[(this._p[i] * STATE_SIZE) + yvel] < 0.0) {
            s1[(this._p[i] * STATE_SIZE) + yvel] = -tracker.restitution * s1[(this._p[i] * STATE_SIZE) + yvel];
          }
          // bounce on back wall
          if (s1[(this._p[i] * STATE_SIZE) + ypos] > this._y_max && s1[(this._p[i] * STATE_SIZE) + yvel] > 0.0) {
            s1[(this._p[i] * STATE_SIZE) + yvel] = -tracker.restitution * s1[(this._p[i] * STATE_SIZE) + yvel];
          }
          // bounce on floor
          if (s1[(this._p[i] * STATE_SIZE) + zpos] < this._z_min && s1[(this._p[i] * STATE_SIZE) + zvel] < 0.0) {
            s1[(this._p[i] * STATE_SIZE) + zvel] = -tracker.restitution * s1[(this._p[i] * STATE_SIZE) + zvel];
          }
          // bounce on ceiling
          if (s1[(this._p[i] * STATE_SIZE) + zpos] > this._z_max && s1[(this._p[i] * STATE_SIZE) + zvel] > 0.0) {
            s1[(this._p[i] * STATE_SIZE) + zvel] = -tracker.restitution * s1[(this._p[i] * STATE_SIZE) + zvel];
          }
          // hard limit on 'floor' keeps z position >= 0;
          if (s1[(this._p[i] * STATE_SIZE) + zpos] < this._z_min) {
            s1[(this._p[i] * STATE_SIZE) + zpos] = this._z_min;
          }
        }
        break;
      case CONSTRAINT_TYPE.SPHERE:
        break;
      case CONSTRAINT_TYPE.STIFF_SPRING:
        if (Math.sqrt(
          Math.pow(s1[this._p[0] + xpos] + s1[this._p[0] + xvel] - s1[this._p[1] + xpos] + s1[this._p[1] + xvel], 2) +
          Math.pow(s1[this._p[0] + ypos] + s1[this._p[0] + yvel] - s1[this._p[1] + ypos] + s1[this._p[1] + yvel], 2) +
          Math.pow(s1[this._p[0] + zpos] + s1[this._p[0] + zvel] - s1[this._p[1] + zpos] + s1[this._p[1] + zvel], 2)
        ) > 0.5) {
          console.log('breaking');
        }
        break;
      default:
        return;
    }
  }

  draw(index, enabled) {
    var r = Math.random();
    var g = Math.random();
    var b = Math.random();
    vbo_2.reload(
      new Float32Array([
        this._x_min, this._y_min, this._z_min, r, g, b, enabled | 0, // 1
        this._x_min, this._y_max, this._z_min, r, g, b, enabled | 0, // 2

        this._x_min, this._y_max, this._z_min, r, g, b, enabled | 0, // 2
        this._x_max, this._y_max, this._z_min, r, g, b, enabled | 0, // 3

        this._x_max, this._y_max, this._z_min, r, g, b, enabled | 0, // 3
        this._x_max, this._y_min, this._z_min, r, g, b, enabled | 0, // 4

        this._x_max, this._y_min, this._z_min, r, g, b, enabled | 0, // 4
        this._x_min, this._y_min, this._z_min, r, g, b, enabled | 0, // 1

        this._x_max, this._y_min, this._z_max, r, g, b, enabled | 0, // 5
        this._x_max, this._y_max, this._z_max, r, g, b, enabled | 0, // 6

        this._x_max, this._y_max, this._z_max, r, g, b, enabled | 0, // 6
        this._x_min, this._y_max, this._z_max, r, g, b, enabled | 0, // 7

        this._x_min, this._y_max, this._z_max, r, g, b, enabled | 0, // 7
        this._x_min, this._y_min, this._z_max, r, g, b, enabled | 0, // 8

        this._x_min, this._y_min, this._z_max, r, g, b, enabled | 0, // 8
        this._x_max, this._y_min, this._z_max, r, g, b, enabled | 0, // 5

        this._x_min, this._y_min, this._z_min, r, g, b, enabled | 0, // 1
        this._x_min, this._y_min, this._z_max, r, g, b, enabled | 0, // 8

        this._x_min, this._y_max, this._z_min, r, g, b, enabled | 0, // 2
        this._x_min, this._y_max, this._z_max, r, g, b, enabled | 0, // 7

        this._x_max, this._y_max, this._z_min, r, g, b, enabled | 0, // 3
        this._x_max, this._y_max, this._z_max, r, g, b, enabled | 0, // 6

        this._x_max, this._y_min, this._z_min, r, g, b, enabled | 0, // 4
        this._x_max, this._y_min, this._z_max, r, g, b, enabled | 0, // 5
      ]),
      index * 7 * 24);
  }
}