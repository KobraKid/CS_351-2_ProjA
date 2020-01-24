/**
 * Classes used to implement a Particle Systems.
 *
 * @author Michael Huyler
 */

var STATE_SIZE = 6;
var xpos = 0;
var ypos = 1;
var zpos = 2;
var xvel = 3;
var yvel = 4;
var zvel = 5;

/**
 * Abstract Particle System.
 */
class PartSys {
  constructor(particle_count) {
    this._s0 = new Float32Array(particle_count * STATE_SIZE);
    this._s0dot = new Float32Array(particle_count * STATE_SIZE);
    this._s1 = new Float32Array(particle_count * STATE_SIZE);
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
    this._sdot = new Float32Array(this.s1.length());
  }

  /**
   * Creates s1 by approximating integration of s0 over a single timestep.
   *
   * @param {number} solver_type The type of solver to use.
   */
  solver(solver_type) {
    this.s0[xpos] = this.s1[xpos];
    this.s0[xvel] = this.s1[xvel];
    this.s0[ypos] = this.s1[ypos];
    this.s0[yvel] = this.s1[yvel];
    this.s0[zpos] = this.s1[zpos];
    this.s0[zvel] = this.s1[zvel];

    if (solver_type == 0) { // EXPLICIT (adds energy)
      this.s1[xpos] += this.s1[xvel] * (timeStep * 0.001);
      this.s1[ypos] += this.s1[yvel] * (timeStep * 0.001);
      this.s1[zpos] += this.s1[zvel] * (timeStep * 0.001);
      this.applyAllForces();
    } else if (solver_type == 1) { // IMPLICIT (loses energy)
      this.applyAllForces();
      this.s1[xpos] += this.s1[xvel] * (timeStep * 0.001);
      this.s1[ypos] += this.s1[yvel] * (timeStep * 0.001);
      this.s1[zpos] += this.s1[zvel] * (timeStep * 0.001);
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
    box.reload();
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
  constructor(type, x, y, z, magnitude, timeout) {
    this._type = type;
    this._x = x;
    this._y = y;
    this._z = z;
    this._magnitude = magnitude;
    this._t = timeout;
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
        s[zvel] += this.magnitude;
        break;
      case FORCE_TYPE.FORCE_DRAG:
        s[xvel] *= (this.x * this.magnitude);
        s[yvel] *= (this.y * this.magnitude);
        s[zvel] *= (this.z * this.magnitude);
        break;
      case FORCE_TYPE.FORCE_WIND:
        s[xvel] += this.x * this.magnitude;
        s[yvel] += this.y * this.magnitude;
        s[zvel] += this.z * this.magnitude;
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
  constructor(predicate, fix) {
    this._predicate = predicate;
    this._fix = fix;
  }

  /**
   * Checks whether the constraint has been met.
   *
   * @param {Float32Array} s0 The previous state vector.
   * @param {Float32Array} s1 The current state vector.
   * @return {boolean} Returns true when the constraint is not met.
   */
  isNotMet(s0, s1) {
    return this._predicate(s0, s1);
  }

  /**
   * Ensures the current state vector meets this constraint.
   *
   * @param {Float32Array} s0 The previous state vector.
   * @param {Float32Array} s1 The current state vector.
   */
  constrain(s0, s1) {
    if (this.isNotMet(s0, s1)) {
      this._fix(s0, s1);
    }
  }
}
