/**
 * Classes used to implement a Particle Systems.
 *
 * @author Michael Huyler
 */

const STATE_SIZE = 15;
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
  MASS: 12,
  DIAMETER: 13,
  AGE: 14,
};

/**
 * Abstract Particle System.
 */
class PartSys {
  constructor(particle_count) {
    this._particle_count = particle_count;
    this._s1 = new Float32Array(particle_count * STATE_SIZE);
    for (var i = 0; i < particle_count * STATE_SIZE; i += STATE_SIZE) {
      this._s1[i + STATE.P_Z] = 0.95;
      this._s1[i + STATE.MASS] = 1;
    }
    this._s1dot = this._s1.slice();
    this._s2 = this._s1.slice();
    this._force_set = [];
    this._constraint_set = [];
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
  applyAllForces(s) {
    for (var i = 0; i < s.length; i += STATE_SIZE) {
      s[i + STATE.F_X] = 0;
      s[i + STATE.F_Y] = 0;
      s[i + STATE.F_Z] = 0;
    }
    this.force_set.forEach((force, _) => force.apply(s));
    this.force_set = this.force_set.filter(force => !force.expired());
  }

  /**
   * Finds the derivative w.r.t. time of state s.
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
      dot[i + STATE.MASS] = 0;
      dot[i + STATE.DIAMETER] = 0;
      dot[i + STATE.AGE] = 0;
    }
    return dot;
  }

  /**
   * Creates s2 by approximating integration of s1 over a single timestep.
   *
   * @param {number} solver_type The type of solver to use.
   */
  solver(solver_type) {
    // TODO: Make solvers correctly explicit/implicit. Currently both are explicit
    if (solver_type == 0) { // EXPLICIT (adds energy)
      for (var i = 0; i < this.s2.length; i++) {
        this.s2[i] = this.s1[i] + this.s1dot[i] * (timeStep * 0.001);
      }
    } else if (solver_type == 1) { // IMPLICIT (loses energy)
      for (var i = 0; i < this.s2.length; i += STATE_SIZE) {
        this.s2[i + STATE.V_Z] -= tracker.gravity * (timeStep * 0.001);
        this.s2[i + STATE.V_X] *= tracker.drag;
        this.s2[i + STATE.V_Y] *= tracker.drag;
        this.s2[i + STATE.V_Z] *= tracker.drag;
        this.s2[i + STATE.P_X] += this.s2[i + STATE.V_X] * (timeStep * 0.001);
        this.s2[i + STATE.P_Y] += this.s2[i + STATE.V_Y] * (timeStep * 0.001);
        this.s2[i + STATE.P_Z] += this.s2[i + STATE.V_Z] * (timeStep * 0.001);
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
      constraint.constrain(this.s1, this.s2);
    });
    if (tracker.fountain) {
      for (var i = 0; i < this.s2.length; i += STATE_SIZE) {
        this.s2[i + STATE.AGE] -= 1;
        if (this.s2[i + STATE.AGE] <= 0) {
          this.s2[i + STATE.P_X] = 0.2 * Math.random() - 0.1;
          this.s2[i + STATE.P_Y] = 0.2 * Math.random() - 0.1;
          this.s2[i + STATE.P_Z] = 0.4 * Math.random();
          this.s2[i + STATE.V_X] = 0.8 * Math.random() - 0.4;
          this.s2[i + STATE.V_Y] = 0.8 * Math.random() - 0.4;
          this.s2[i + STATE.V_Z] = 3.0 * Math.random();
          this.s2[i + STATE.AGE] = 30 + 30 * Math.random();
        }
      }
    }
  }

  /**
   * Updates values for transferring to the GPU.
   *
   * @param {VBOBox} box The VBOBox whose VBO should be updated.
   */
  render(box) {
    // Send to the VBO box to call WebGLRenderingContext.bufferSubData()
    box.vbo = this.s2;
    box.reload(box.vbo);
  }

  /**
   * Swaps two state vectors.
   *
   * @param {Float32Array} s1 The previous state vector.
   * @param {Float32Array} s2 The current state vector.
   */
  swap(s1, s2) {
    s1.set(s2);
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
};

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
};

const WALL = {
  ALL: 0b111111,
  TOP: 0b000001,
  BOTTOM: 0b000010,
  FRONT: 0b000100,
  BACK: 0b001000,
  LEFT: 0b010000,
  RIGHT: 0b100000,
};

/**
 * Creates rules for a constraint, and a function to be called to fix the
 * state vector if a constraint is not met.
 */
class Constraint {
  /**
   * @param {CONSTRAINT_TYPE} type The type of constraint to represent.
   * @param {Array<number>} affected_particles The list of particles to constrain.
   * @param {WALL} enabled_walls The walls to enable for this constraint.
   * @param {...number} bounds The rest of the arguments are all numbers which bound the constraint.
   */
  constructor(type, affected_particles, enabled_walls, ...bounds) {
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
    this._walls = enabled_walls;
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
   * @param {Float32Array} s1 The previous state vector.
   * @param {Float32Array} s2 The current state vector.
   */
  constrain(s1, s2) {
    switch (this._type) {
      case CONSTRAINT_TYPE.VOLUME_IMPULSIVE:
        for (var i = 0; i < this._p.length; i++) {
          // bounce on left wall
          if ((this._walls & WALL.LEFT) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X] < this._x_min &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] < 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X] = this._x_min;
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] =
              Math.abs(s1[(this._p[i] * STATE_SIZE) + STATE.V_X]) * tracker.drag * tracker.restitution;
          }
          // bounce on right wall
          if ((this._walls & WALL.RIGHT) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X] > this._x_max &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] > 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X] = this._x_max;
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] = Math.abs(s1[(this._p[i] * STATE_SIZE) + STATE.V_X]) * tracker.drag * tracker.restitution * -1;
          }
          // bounce on front wall
          if ((this._walls & WALL.FRONT) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] < this._y_min &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] < 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] = this._y_min;
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] =
              Math.abs(s1[(this._p[i] * STATE_SIZE) + STATE.V_Y]) * tracker.drag * tracker.restitution;
          }
          // bounce on back wall
          if ((this._walls & WALL.BACK) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] > this._y_max &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] > 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] = this._y_max;
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] =
              Math.abs(s1[(this._p[i] * STATE_SIZE) + STATE.V_Y]) * tracker.drag * tracker.restitution * -1;
          }
          // bounce on floor
          if ((this._walls & WALL.BOTTOM) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] < this._z_min &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] < 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] = this._z_min;
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] =
              Math.abs(s1[(this._p[i] * STATE_SIZE) + STATE.V_Z]) * tracker.drag * tracker.restitution;
          }
          // bounce on ceiling
          if ((this._walls & WALL.TOP) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] > this._z_max &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] > 0.0) {
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
        break;
      case CONSTRAINT_TYPE.STIFF_SPRING:
        if (Math.sqrt(
            Math.pow(s2[this._p[0] + STATE.P_X] + s2[this._p[0] + STATE.V_X] - s2[this._p[1] + STATE.P_X] + s2[this._p[1] + STATE.V_X], 2) +
            Math.pow(s2[this._p[0] + STATE.P_Y] + s2[this._p[0] + STATE.V_Y] - s2[this._p[1] + STATE.P_Y] + s2[this._p[1] + STATE.V_Y], 2) +
            Math.pow(s2[this._p[0] + STATE.P_Z] + s2[this._p[0] + STATE.V_Z] - s2[this._p[1] + STATE.P_Z] + s2[this._p[1] + STATE.V_Z], 2)
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
