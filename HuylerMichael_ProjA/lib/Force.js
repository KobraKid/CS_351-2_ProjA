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
  FORCE_FLOCK: 4,
  FORCE_PLANETARY_GRAVITY: 5,
  FORCE_LINE_ATTRACTOR: 6,
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
   * This approach follows Reynolds' "boids" method of flocking particles,
   * which is affected by 3* independent, and often competing forces:
   *  - Separation
   *  - Alignment
   *  - Cohesion
   *
   * * there can be more forces applied to boids, such as obstacle avoidance,
   * which is, in fact, used by this implementation.
   *
   * @param {number} min_rad The bois' small (focused) visual radius.
   * @param {number} max_rad The bois' large (boundary) visual radius.
   * @param {number} binocular_angle The bois' range of binocular vision (radians).
   * @param {number} monocular_angle The bois' range of monocular vision (radians).
   * @param {number} k_a The avoidance hyperparameter.
   * @param {number} k_v The velocity matching hyperparameter.
   * @param {number} k_c The centering hyperparameter.
   */
  init_boid(min_rad, max_rad, binocular_angle, monocular_angle, k_a, k_v, k_c) {
    this._r1 = min_rad;
    this._r2 = max_rad;
    this._t1 = binocular_angle; // θ1
    this._t2 = monocular_angle; // θ2
    this._ka = k_a;
    this._kv = k_v;
    this._kc = k_c;
    return this;
  }

  /**
   * Initializes an attractor force.
   */
  init_attractor(x, y, z, a_x, a_y, a_z, p, L = 0) {
    this._x_a = glMatrix.vec3.fromValues(x, y, z);
    this._a = glMatrix.vec3.fromValues(a_x, a_y, a_z);
    this._pow = p;
    this._L = L;
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
        // and limit the force for stability
        var Fx = Math.min(this._k * L * Lx / distance, 12);
        var Fy = Math.min(this._k * L * Ly / distance, 12);
        var Fz = Math.min(this._k * L * Lz / distance, 12);
        // Dampen the forces
        // Multiply damping coeff. by difference in velocities of particles and
        // by the square of the normalized L vector
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
        // Our current boid
        var x_i = glMatrix.vec3.create();
        // Our 'other' boid
        var x_j = glMatrix.vec3.create();
        // The vector from current to other
        var x_ij = glMatrix.vec3.create();
        // The directional vector from current to other
        var x_hat = glMatrix.vec3.create();
        // The distance from current to other
        var d_ij = 0;
        // The angle between current and other
        var t_ij = 0;
        // The accumulated acceleration
        var a_i = glMatrix.vec3.create(); // [a_ij^a, a_ij^v, a_ij^c]
        // The distance weight
        var k_d = 0;
        // The visual field weight
        var k_t = 1; // 0;
        for (var i = 0; i < this._p.length; i++) {
          x_i = glMatrix.vec3.fromValues(
            s[(this._p[i] * STATE_SIZE) + STATE.P_X],
            s[(this._p[i] * STATE_SIZE) + STATE.P_Y],
            s[(this._p[i] * STATE_SIZE) + STATE.P_Z]);
          glMatrix.vec3.zero(a_i);
          for (var j = 0; j < this._p.length; j++) {
            x_j = glMatrix.vec3.fromValues(
              s[(this._p[j] * STATE_SIZE) + STATE.P_X],
              s[(this._p[j] * STATE_SIZE) + STATE.P_Y],
              s[(this._p[j] * STATE_SIZE) + STATE.P_Z]);
            x_ij = glMatrix.vec3.sub(x_ij, x_j, x_i);
            d_ij = glMatrix.vec3.length(x_ij);
            t_ij = glMatrix.vec3.angle(x_ij,
              glMatrix.vec3.fromValues(
                s[(this._p[j] * STATE_SIZE) + STATE.V_X],
                s[(this._p[j] * STATE_SIZE) + STATE.V_Y],
                s[(this._p[j] * STATE_SIZE) + STATE.V_Z]));
            x_hat = glMatrix.vec3.scale(x_hat, x_ij, d_ij);
            // This boid is the current boid, is too far away, or is in a blind spot
            if (i == j || d_ij == 0 || d_ij > this._r2 || t_ij > this._t2 * 0.5)
              continue;
            k_d = d_ij < this._r1 ? 1 : (this._r2 - d_ij) / (this._r2 - this._r1);
            k_t = t_ij < (this._t1 * 0.5) ? 1 : (this._t2 * 0.5 - t_ij) / (this._t2 * 0.5 - this._t1 * 0.5);
            /* Collision avoidance */
            // a_ij^a = -(k_a / d_ij) * x_hat
            glMatrix.vec3.add(a_i, a_i,
              glMatrix.vec3.scale(x_hat, x_hat, k_t * k_d * (-1 * this._ka / d_ij)));
            /* Velocity matching */
            // a_ij^v = k_v * (v_j - v_i)
            glMatrix.vec3.add(a_i, a_i,
              glMatrix.vec3.scale(
                glMatrix.vec3.create(), // 'out' not needed
                glMatrix.vec3.sub(
                  glMatrix.vec3.create(), // 'out' not needed
                  glMatrix.vec3.fromValues(
                    s[(this._p[j] * STATE_SIZE) + STATE.V_X],
                    s[(this._p[j] * STATE_SIZE) + STATE.V_Y],
                    s[(this._p[j] * STATE_SIZE) + STATE.V_Z]),
                  glMatrix.vec3.fromValues(
                    s[(this._p[i] * STATE_SIZE) + STATE.V_X],
                    s[(this._p[i] * STATE_SIZE) + STATE.V_Y],
                    s[(this._p[i] * STATE_SIZE) + STATE.V_Z])),
                k_t * k_d * this._kv));
            /* Centering */
            // a_ij^c = k_c * x_ij
            glMatrix.vec3.add(a_i, a_i,
              glMatrix.vec3.scale(x_ij, x_ij, k_t * k_d * this._kc));
            if (Number.isNaN(a_i[0])) {
              console.log(x_i, x_j, x_ij, d_ij, t_ij, k_d, k_t, x_hat)
            }
          }
          s[(this._p[i] * STATE_SIZE) + STATE.F_X] += a_i[0];
          s[(this._p[i] * STATE_SIZE) + STATE.F_Y] += a_i[1];
          s[(this._p[i] * STATE_SIZE) + STATE.F_Z] += a_i[2];
        }
        break;
      case FORCE_TYPE.FORCE_LINE_ATTRACTOR:
        const x_a = this._x_a;
        const a = this._a;
        var x_i = glMatrix.vec3.create();
        var x_ai = glMatrix.vec3.create();
        var l_ai = 0;
        var r_ai = glMatrix.vec3.create();
        var r = 0; // magnitude of r_ai
        var a_ai = glMatrix.vec3.create();
        var epsilon = 0.01;
        for (var i = 0; i < this._p.length; i++) {
          x_i = glMatrix.vec3.fromValues(
            s[(this._p[i] * STATE_SIZE) + STATE.P_X],
            s[(this._p[i] * STATE_SIZE) + STATE.P_Y],
            s[(this._p[i] * STATE_SIZE) + STATE.P_Z]
          );
          x_ai = glMatrix.vec3.sub(x_ai, x_i, x_a);
          l_ai = glMatrix.vec3.dot(x_ai, a);
          if (epsilon <= l_ai && l_ai < this._L) {
            r_ai = glMatrix.vec3.scaleAndAdd(r_ai, x_ai, a, -l_ai);
            r = glMatrix.vec3.len(r_ai);
            a_ai = glMatrix.vec3.scale(a_ai, r_ai, -9.8 * Math.pow(r, -(this._pow + 1)));
            s[(this._p[i] * STATE_SIZE) + STATE.F_X] += a_ai[0];
            s[(this._p[i] * STATE_SIZE) + STATE.F_Y] += a_ai[1];
            s[(this._p[i] * STATE_SIZE) + STATE.F_Z] += a_ai[2];
          }
        }
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
