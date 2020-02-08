/**
 * The Force class.
 *
 * @author Michael Huyler
 */

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
   * Creates a constant vector force.
   *
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
   * Creates a spring force.
   *
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
   * Creates a flocking force.
   *
   * @param {number} radius The bois' visual radius.
   */
  init_boid(radius) {
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
          s[(this._p[i] * STATE_SIZE) + STATE.F_X] += this.x * this.magnitude * (Math.random() * 2 - 1);
          s[(this._p[i] * STATE_SIZE) + STATE.F_Y] += this.y * this.magnitude * (Math.random() * 2 - 1);
          s[(this._p[i] * STATE_SIZE) + STATE.F_Z] += this.z * this.magnitude * (Math.random() * 2 - 1);
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
      case FORCE_TYPE.FORCE_FLOCK:

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
