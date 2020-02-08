/**
 * The Constraint class.
 *
 * @author Michael Huyler
 */

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
  VOLUME_WRAP: 4,
};
const CONSTRAINT_STRINGS = [
  "Volume [Impulsive]",
  "Volume [Velocity Reverse]",
  "Sphere",
  "Absolute Position",
  "Wraparound [Impulsive]",
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

const VISIBLE_CONSTRAINTS = [
  CONSTRAINT_TYPE.VOLUME_IMPULSIVE,
  CONSTRAINT_TYPE.VOLUME_VELOCITY_REVERSE,
  CONSTRAINT_TYPE.SPHERE,
  CONSTRAINT_TYPE.VOLUME_WRAP
];
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
      case CONSTRAINT_TYPE.VOLUME_WRAP:
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

  get radius() {
    return this._r;
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
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] =
              Math.abs(s1[(this._p[i] * STATE_SIZE) + STATE.V_X]) * tracker.drag * tracker.restitution * -1;
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
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] = part_vel[0] * tracker.restitution;
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] = part_vel[1] * tracker.restitution;
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] = part_vel[2] * tracker.restitution;
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
      case CONSTRAINT_TYPE.VOLUME_WRAP:
        for (var i = 0; i < this._p.length; i++) {
          // wrap to right wall
          if ((this._walls & WALL.LEFT) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X] < this._x_min &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] <= 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X] = this._x_max;
          }
          // wrap to left wall
          if ((this._walls & WALL.RIGHT) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X] > this._x_max &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_X] >= 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_X] = this._x_min;
          }
          // wrap to back wall
          if ((this._walls & WALL.FRONT) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] < this._y_min &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] <= 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] = this._y_max;
          }
          // wrap to front wall
          if ((this._walls & WALL.BACK) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] > this._y_max &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Y] >= 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Y] = this._y_min;
          }
          // wrap to ceiling
          if ((this._walls & WALL.BOTTOM) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] < this._z_min &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] <= 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] = this._z_max;
          }
          // wrap to floor
          if ((this._walls & WALL.TOP) &&
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] > this._z_max &&
            s2[(this._p[i] * STATE_SIZE) + STATE.V_Z] >= 0.0) {
            s2[(this._p[i] * STATE_SIZE) + STATE.P_Z] = this._z_min;
          }
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
      case CONSTRAINT_TYPE.VOLUME_WRAP:
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
