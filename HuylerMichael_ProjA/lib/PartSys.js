/**
 * Classes related to Particle Systems.
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

/*
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

  init(part_sys_type, force_set, constraint_set) {
    this.force_set = force_set;
    this.constraint_set = constraint_set;
  }

  /*
   * Applys all forces in forceArray, modifying state array s.
   */
  applyAllForces() {
    this.force_set.forEach((force, _) => force.apply(this.s1));
    this.force_set = this.force_set.filter(force => !force.expired());
  }

  /*
   * Finds the derivative w.r.t. time of state s.
   */
  dotFinder() {
    this._sdot = new Float32Array(this.s1.length());
  }

  /*
   * Creates s1 by approximating integration of s0 over a single timestep.
   */
  solver(solver_type) {
    this.s0[xpos] = this.s1[xpos];
    this.s0[xvel] = this.s1[xvel];
    this.s0[ypos] = this.s1[ypos];
    this.s0[yvel] = this.s1[yvel];
    this.s0[zpos] = this.s1[zpos];
    this.s0[zvel] = this.s1[zvel];

    if (solver_type == 0) { // EXPLICIT (adds energy)
      this.s1[xpos] += this.s1[xvel] * (g_timeStep * 0.001);
      this.s1[ypos] += this.s1[yvel] * (g_timeStep * 0.001);
      this.s1[zpos] += this.s1[zvel] * (g_timeStep * 0.001);
      this.applyAllForces();
    } else if (solver_type == 1) { // IMPLICIT (loses energy)
      this.applyAllForces();
      this.s1[xpos] += this.s1[xvel] * (g_timeStep * 0.001);
      this.s1[ypos] += this.s1[yvel] * (g_timeStep * 0.001);
      this.s1[zpos] += this.s1[zvel] * (g_timeStep * 0.001);
    } else {
      console.log('unknown solver: ' + solver_type);
      return;
    }
  }

  /*
   * Applies all constraints for a given system.
   */
  doConstraints() {
    this.constraint_set.forEach((constraint, _) => {
      constraint.constrain(this.s0, this.s1);
    });
  }

  /*
   * Updates values stored in the GPU and performs a draw call.
   */
  render(box) {
    // Send to the VBO box to call WebGLRenderingContext.bufferSubData()
    box.vbo = this.s1;
  }

  swap(s0, s1) {
    [s0, s1] = [s1, s0];
  }

  addForce(f) {
    this.force_set = f;
  }

  addConstraint(c) {
    this.constraint_set = c;
  }
}

// Type of force to apply
var FORCE_SIMP_GRAVITY = 0;
var FORCE_DRAG = 1;
var FORCE_WIND = 2;
var FORCE_SPRING = 3;
var FORCE_CHARGE = 4;
var FORCE_FLOCK = 5;
var FORCE_GRAVITY = 6;

// How long the force should stay active
var TIMEOUT_NO_TIMEOUT = -1;
var TIMEOUT_INSTANT = 1;

/*
 * Creates a force in a particular direction for a specific duration.
 */
class Force {
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

  apply(s) {
    switch (this._type) {
      case FORCE_SIMP_GRAVITY:
        s[zvel] += this.magnitude;
        break;
      case FORCE_DRAG:
        s[xvel] *= (this.x * this.magnitude);
        s[yvel] *= (this.y * this.magnitude);
        s[zvel] *= (this.z * this.magnitude);
        break;
      case FORCE_WIND:
        s[xvel] += this.x * this.magnitude;
        s[yvel] += this.y * this.magnitude;
        s[zvel] += this.z * this.magnitude;
        break;
      default:
        return;
    }
    if (this.expires()) this._t -= 1;
  }

  expires() {
    // Return true if this force should eventually timeout
    return (this._t >= 0);
  }

  expired() {
    return this.expires() && this._t == 0;
  }

}

/*
 * Creates rules for a constraint, and a handler function to be called if a
 * constraint is not met.
 */
class Constraint {
  constructor(predicate, fix) {
    this._predicate = predicate;
    this._fix = fix;
  }

  isNotMet(s0, s1) {
    return this._predicate(s0, s1);
  }

  constrain(s0, s1) {
    if (this.isNotMet(s0, s1)) {
      this._fix(s0, s1);
    }
  }
}
