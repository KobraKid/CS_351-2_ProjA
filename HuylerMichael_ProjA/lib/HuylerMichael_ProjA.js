/**
 * Main entry point into the program.
 *
 * Handles setting up objects required for 3D graphics.
 *
 * @author Michael Huyler
 */

/* WebGL variables */
// GL context
var gl;
// HTML canvas
var canvas;
// Screen aspect ratio
var aspect;

/* VBO Boxes */
// Ground plane
var vbo_0;
// Velocity field (snow)
var vbo_1;
// Boids
var vbo_2;
// Reeve's Fire
var vbo_3;
// Springs
var vbo_4;
// Volume constraints
var vbo_5;
// Spring forces
var vbo_6;
// Array containing all VBOBoxes
const vbo_boxes = [];
const sprite_locations = {};

/* Particle Systems */
var INIT_VEL = 0.15 * 60.0;
// Vector Field
const VEC_FIELD_PARTICLE_COUNT = 300;
const vfield = new PartSys(VEC_FIELD_PARTICLE_COUNT);
const top_m = [10, 10, 1];
const top_a = [1, 2, 9];
// Boids
const BOID_PARTICLE_COUNT = 90;
const boid = new PartSys(BOID_PARTICLE_COUNT);
var boid_predator_timer = 0;
// Reve's Fire
const FIRE_PARTICLE_COUNT = 2000;
const fire = new PartSys(FIRE_PARTICLE_COUNT);
// Springs
const CLOTH_WIDTH = 30;
const CLOTH_HEIGHT = 10;
const SPRING_PARTICLE_COUNT = CLOTH_WIDTH * CLOTH_HEIGHT;
const spring = new PartSys(SPRING_PARTICLE_COUNT);

/**
 * Initialize global variables, event listeners, etc.
 */
function main() {
  canvas = document.getElementById('webgl');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  aspect = canvas.width / canvas.height;

  gl = canvas.getContext("webgl", {
    preserveDrawingBuffer: true
  });

  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  gl.clearColor(0.2, 0.2, 0.2, 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  canvas.onmousedown = function(ev) {
    mouseDown(ev)
  };
  canvas.onmousemove = function(ev) {
    mouseMove(ev)
  };
  canvas.onmouseup = function(ev) {
    mouseUp(ev)
  };
  window.addEventListener("keydown", keyDown, false);
  window.addEventListener("keyup", keyUp, false);

  initGui();
  initParticleSystems();
  initVBOBoxes();
  vfield.constraint_set.forEach(constraint => constraint.draw(vfield._c_vbo, true));
  boid.constraint_set.forEach(constraint => constraint.draw(vfield._c_vbo, true));
  fire.constraint_set.forEach(constraint => constraint.draw(vfield._c_vbo, true));
  spring.constraint_set.forEach(constraint => constraint.draw(vfield._c_vbo, true));

  // There is a significant overhead inherent in setting up the VBOs and
  // particle systems, so we start our timing after the setup has completed
  tracker.prev = Date.now();

  var shouldUpdateFrame = 1;
  var tick = function() {
    updateKeypresses();
    requestAnimationFrame(tick, canvas);
    if (shouldUpdateFrame >= tracker.speed) {
      boid_predator_timer -= 1;
      if (boid_predator_timer <= 0) {
        boid_predator_timer = 240;
        // random walk
        boid.force_set[3].x = Math.random() * Math.abs(boid.constraint_set[0].bounds[1] - boid.constraint_set[0].bounds[0]) + boid.constraint_set[0].bounds[0];
        boid.force_set[3].y = Math.random() * Math.abs(boid.constraint_set[0].bounds[3] - boid.constraint_set[0].bounds[2]) + boid.constraint_set[0].bounds[2];
        boid.force_set[3].z = Math.random() * Math.abs(boid.constraint_set[0].bounds[5] - boid.constraint_set[0].bounds[4]) + boid.constraint_set[0].bounds[4];
      }
      tracker.fps_calc();
      drawAll();
      shouldUpdateFrame = 1;
    } else {
      shouldUpdateFrame++;
    }
  };
  tick();
}

/**
 * Initializes all of the VBOBoxes.
 */
function initVBOBoxes() {
  var id;
  var glTexture;

  // Ground plane
  id = 0;
  const vertex_shader_0 = `
    precision highp float;

    uniform mat4 u_model_matrix_${id};
    uniform mat4 u_view_matrix_${id};
    uniform mat4 u_projection_matrix_${id};

    attribute vec4 a_position_${id};
    attribute vec3 a_color_${id};

    varying vec4 v_color_${id};

    void main() {
  		gl_Position = u_projection_matrix_${id} * u_view_matrix_${id} * u_model_matrix_${id} * a_position_${id};
  		v_color_${id} = vec4(a_color_${id}, 1.0);
    }
  `;
  const fragment_shader_0 = `
    precision highp float;

    varying vec4 v_color_${id};

    void main() {
      gl_FragColor = v_color_${id};
    }
  `;
  const xcount = 10;
  const ycount = 10;
  const xymax = 5.0;
  var v = 0;
  var j = 0;
  const verts = new Float32Array(7 * 2 * (xcount + ycount));
  const xgap = xymax / (xcount - 1);
  const ygap = xymax / (ycount - 1);
  for (v = 0, j = 0; v < 2 * xcount; v++, j += 7) {
    if (v % 2 == 0) {
      verts[j] = -xymax + v * xgap;
      verts[j + 1] = -xymax;
      verts[j + 2] = 0.0;
      verts[j + 3] = 1.0;
    } else {
      verts[j] = -xymax + (v - 1) * xgap;
      verts[j + 1] = xymax;
      verts[j + 2] = 0.0;
      verts[j + 3] = 1.0;
    }
  }
  for (v = 0; v < 2 * ycount; v++, j += 7) {
    if (v % 2 == 0) {
      verts[j] = -xymax;
      verts[j + 1] = -xymax + v * ygap;
      verts[j + 2] = 0.0;
      verts[j + 3] = 1.0;
    } else {
      verts[j] = xymax;
      verts[j + 1] = -xymax + (v - 1) * ygap;
      verts[j + 2] = 0.0;
      verts[j + 3] = 1.0;
    }
  }
  for (var i = 0; i < verts.length; i += 7) {
    verts[i + 4] = 80.0 / 255;
    verts[i + 5] = 80.0 / 255;
    verts[i + 6] = 80.0 / 255;
  }
  vbo_0 = new VBOBox(
    vertex_shader_0,
    fragment_shader_0,
    verts,
    gl.LINES,
    7, {
      ['a_position_' + id]: [0, 4],
      ['a_color_' + id]: [4, 3],
    },
    id,
    () => gl.enable(gl.DEPTH_TEST));
  vbo_0.init();
  vbo_boxes.push(vbo_0);

  // Vector Field
  id = 1;
  const vertex_shader_1 = `
    precision highp float;

    uniform mat4 u_model_matrix_${id};
    uniform mat4 u_view_matrix_${id};
    uniform mat4 u_projection_matrix_${id};

    attribute vec4 a_position_${id};
    attribute vec3 a_color_${id};

    varying vec4 v_color_${id};

    void main() {
      gl_PointSize = 16.0;
  		gl_Position = u_projection_matrix_${id} * u_view_matrix_${id} * u_model_matrix_${id} * a_position_${id};
  		v_color_${id} = vec4(a_color_${id}, 1.0);
    }
  `;
  const fragment_shader_1 = `
    precision highp float;

    uniform sampler2D sprite_texture_${id};

    varying vec4 v_color_${id};

    void main() {
      gl_FragColor = texture2D(sprite_texture_${id}, gl_PointCoord) * v_color_${id};
      // float dist = distance(gl_PointCoord, vec2(0.5, 0.5));
      // if (dist < 0.5) {
      //   gl_FragColor = v_color_${id};
      //   gl_FragColor.rgb *= gl_FragColor.a;
      // } else { discard; }
    }
  `;
  const snow_sprite = document.getElementById('fluff');
  const snow_sprite_id = id;
  glTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, glTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snow_sprite);
  gl.generateMipmap(gl.TEXTURE_2D);
  vbo_1 = new VBOBox(vertex_shader_1,
    fragment_shader_1,
    new Float32Array(VEC_FIELD_PARTICLE_COUNT * STATE_SIZE),
    gl.POINTS,
    STATE_SIZE, {
      ['a_position_' + id]: [STATE.P_X, 3],
      ['a_color_' + id]: [STATE.R, 4],
    },
    id,
    () => {
      gl.disable(gl.DEPTH_TEST);
      if (!tracker.pause) {
        vfield.applyAllForces(vfield.s1);
        vfield.s1dot = vfield.dotFinder(vfield.s1);
        vfield.solver(Number(tracker.solver));
        vfield.doConstraints();
        gl.uniform1i(sprite_locations[snow_sprite_id], snow_sprite_id);
        vfield.render();
        vfield.swap();
      }
    });
  vbo_1.init();
  sprite_locations[snow_sprite_id] = gl.getUniformLocation(vbo_1.program, `sprite_texture_${snow_sprite_id}`);
  vbo_boxes.push(vbo_1);

  // Boids
  id = 2;
  const vertex_shader_2 = `
    precision mediump float;

    uniform mat4 u_model_matrix_${id};
    uniform mat4 u_view_matrix_${id};
    uniform mat4 u_projection_matrix_${id};

    attribute vec4 a_position_${id};
    attribute vec4 a_color_${id};
    attribute float a_radius_${id};

    varying vec4 v_color_${id};

    void main() {
      gl_PointSize = a_radius_${id} * 2.0;
      gl_Position = u_projection_matrix_${id} * u_view_matrix_${id} * u_model_matrix_${id} * a_position_${id};
      v_color_${id} = vec4(a_color_${id});
    }`;
  const fragment_shader_2 = `
    precision mediump float;

    uniform sampler2D sprite_texture_${id};

    varying vec4 v_color_${id};

    void main() {
      gl_FragColor = texture2D(sprite_texture_${id}, gl_PointCoord) * v_color_${id};
    }`;
  const boid_sprite = document.getElementById('boid');
  const boid_sprite_id = id;
  glTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, glTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, boid_sprite);
  gl.generateMipmap(gl.TEXTURE_2D);
  vbo_2 = new VBOBox(
    vertex_shader_2,
    fragment_shader_2,
    new Float32Array(BOID_PARTICLE_COUNT * STATE_SIZE),
    gl.POINTS,
    STATE_SIZE, {
      ['a_position_' + id]: [STATE.P_X, 3],
      ['a_color_' + id]: [STATE.R, 4],
      ['a_radius_' + id]: [STATE.RADIUS, 1],
    },
    id,
    () => {
      gl.disable(gl.DEPTH_TEST);
      if (!tracker.pause) {
        boid.applyAllForces(boid.s1);
        boid.s1dot = boid.dotFinder(boid.s1);
        boid.solver(Number(tracker.solver));
        boid.doConstraints();
        gl.uniform1i(sprite_locations[boid_sprite_id], boid_sprite_id);
        boid.render();
        boid.swap();
      }
    });
  vbo_2.init();
  sprite_locations[boid_sprite_id] = gl.getUniformLocation(vbo_2.program, `sprite_texture_${boid_sprite_id}`);
  vbo_boxes.push(vbo_2);

  // Reeve's Fire
  id = 3;
  const vertex_shader_3 = `
    precision mediump float;

    uniform mat4 u_model_matrix_${id};
    uniform mat4 u_view_matrix_${id};
    uniform mat4 u_projection_matrix_${id};

    attribute vec4 a_position_${id};
    attribute vec4 a_color_${id};
    attribute float a_radius_${id};

    varying vec4 v_color_${id};

    void main() {
      gl_PointSize = a_radius_${id} * 2.0;
      gl_Position = u_projection_matrix_${id} * u_view_matrix_${id} * u_model_matrix_${id} * a_position_${id};
      v_color_${id} = vec4(a_color_${id});
    }`;
  const fragment_shader_3 = `
    precision mediump float;

    uniform sampler2D sprite_texture_${id};

    varying vec4 v_color_${id};

    void main() {
      gl_FragColor = texture2D(sprite_texture_${id}, gl_PointCoord) * v_color_${id};
    }`;
  const fire_sprite = document.getElementById('grad');
  const fire_sprite_id = id;
  glTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, glTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fire_sprite);
  gl.generateMipmap(gl.TEXTURE_2D);
  vbo_3 = new VBOBox(
    vertex_shader_3,
    fragment_shader_3,
    new Float32Array(FIRE_PARTICLE_COUNT * STATE_SIZE),
    gl.POINTS,
    STATE_SIZE, {
      ['a_position_' + id]: [STATE.P_X, 3],
      ['a_color_' + id]: [STATE.R, 4],
      ['a_radius_' + id]: [STATE.RADIUS, 1],
    },
    id,
    () => {
      gl.disable(gl.DEPTH_TEST);
      if (!tracker.pause) {
        fire.applyAllForces(fire.s1);
        fire.s1dot = fire.dotFinder(fire.s1);
        fire.solver(Number(tracker.solver));
        fire.doConstraints();
        gl.uniform1i(sprite_locations[fire_sprite_id], fire_sprite_id);
        fire.render();
        fire.swap();
      }
    });
  vbo_3.init();
  sprite_locations[fire_sprite_id] = gl.getUniformLocation(vbo_3.program, `sprite_texture_${fire_sprite_id}`);
  vbo_boxes.push(vbo_3);

  // Springs
  id = 4;
  const vertex_shader_4 = `
    precision mediump float;

    uniform mat4 u_model_matrix_${id};
    uniform mat4 u_view_matrix_${id};
    uniform mat4 u_projection_matrix_${id};

    attribute vec4 a_position_${id};
    attribute vec4 a_color_${id};
    attribute float a_radius_${id};

    varying vec4 v_color_${id};

    void main() {
      gl_PointSize = a_radius_${id} * 2.0;
      gl_Position = u_projection_matrix_${id} * u_view_matrix_${id} * u_model_matrix_${id} * a_position_${id};
      v_color_${id} = vec4(a_color_${id});
    }`;
  const fragment_shader_4 = `
    precision mediump float;

    varying vec4 v_color_${id};

    void main() {
      float dist = distance(gl_PointCoord, vec2(0.5, 0.5));
      if (dist < 0.5) {
        gl_FragColor = v_color_${id};
        gl_FragColor.rgb *= gl_FragColor.a;
      } else { discard; }
    }`;
  vbo_4 = new VBOBox(
    vertex_shader_4,
    fragment_shader_4,
    new Float32Array(SPRING_PARTICLE_COUNT * STATE_SIZE),
    gl.POINTS,
    STATE_SIZE, {
      ['a_position_' + id]: [STATE.P_X, 3],
      ['a_color_' + id]: [STATE.R, 4],
      ['a_radius_' + id]: [STATE.RADIUS, 1],
    },
    id,
    () => {
      gl.enable(gl.DEPTH_TEST);
      if (!tracker.pause) {
        spring.applyAllForces(spring.s1);
        spring.s1dot = spring.dotFinder(spring.s1);
        spring.solver(Number(tracker.solver));
        spring.doConstraints();
        spring.render();
        spring.swap();
      }
    });
  vbo_4.init();
  vbo_boxes.push(vbo_4);

  // Volume constraints
  id = 5;
  const vertex_shader_5 = `
    precision mediump float;

    uniform mat4 u_model_matrix_${id};
    uniform mat4 u_view_matrix_${id};
    uniform mat4 u_projection_matrix_${id};

    attribute vec3 a_position_${id};
    attribute vec3 a_color_${id};
    attribute float a_enabled_${id};

    varying vec3 v_color_${id};
    varying float v_enabled_${id};

    void main() {
      gl_Position = u_projection_matrix_${id} * u_view_matrix_${id} * u_model_matrix_${id} * vec4(a_position_${id}, 1.0);
      v_color_${id} = a_color_${id};
      v_enabled_${id} = a_enabled_${id};
    }`;
  const fragment_shader_5 = `
    precision mediump float;

    varying vec3 v_color_${id};
    varying float v_enabled_${id};

    void main() {
      if (v_enabled_${id} > 0.0) {
        gl_FragColor = vec4(v_color_${id}, 1.0);
      } else { discard; }
    }`;
  vbo_5 = new VBOBox(
    vertex_shader_5,
    fragment_shader_5,
    // 7 attributes, 12 lines (24 points) per box constraint
    new Float32Array(7 * (24 * __constraint_volume_index)),
    gl.LINES,
    7, {
      ['a_position_' + id]: [0, 3],
      ['a_color_' + id]: [3, 3],
      ['a_enabled_' + id]: [6, 1],
    },
    id,
    () => gl.enable(gl.DEPTH_TEST));
  vbo_5.init();
  vbo_boxes.push(vbo_5);

  // Spring forces
  id = 6;
  const vertex_shader_6 = `
    precision mediump float;

    uniform mat4 u_model_matrix_${id};
    uniform mat4 u_view_matrix_${id};
    uniform mat4 u_projection_matrix_${id};

    attribute vec3 a_position_${id};
    attribute vec3 a_color_${id};
    attribute float a_enabled_${id};

    varying vec3 v_color_${id};
    varying float v_enabled_${id};

    void main() {
      gl_Position = u_projection_matrix_${id} * u_view_matrix_${id} * u_model_matrix_${id} * vec4(a_position_${id}, 1.0);
      v_color_${id} = a_color_${id};
      v_enabled_${id} = a_enabled_${id};
    }`;
  const fragment_shader_6 = `
    precision mediump float;

    varying vec3 v_color_${id};
    varying float v_enabled_${id};

    void main() {
      if (v_enabled_${id} > 0.0) {
        gl_FragColor = vec4(v_color_${id}, 1.0);
      } else { discard; }
    }`;
  vbo_6 = new VBOBox(
    vertex_shader_6,
    fragment_shader_6,
    new Float32Array(7 * ( // 7 attributes
      (SPRING_PARTICLE_COUNT + 2) + // wind for each particle + 1 gravity + 1 drag
      2 * 6 * CLOTH_WIDTH * CLOTH_HEIGHT)), // 1 line (2 points) per spring, max 6 springs per particle
    gl.LINES,
    7, {
      ['a_position_' + id]: [0, 3],
      ['a_color_' + id]: [3, 3],
      ['a_enabled_' + id]: [6, 1],
    },
    id,
    () => {
      gl.enable(gl.DEPTH_TEST);
      var p = 0;
      for (var i = 0; i < spring.force_set.length; i++) {
        if (spring.force_set[i].type == FORCE_TYPE.FORCE_SPRING) {
          p0 = spring.force_set[i].particles[0] * STATE_SIZE;
          p1 = spring.force_set[i].particles[1] * STATE_SIZE;
          spring.force_set[i].draw(
            vbo_6,
            i,
            true,
            [spring.s2[p0 + STATE.P_X], spring.s2[p0 + STATE.P_Y], spring.s2[p0 + STATE.P_Z]],
            [spring.s2[p1 + STATE.P_X], spring.s2[p1 + STATE.P_Y], spring.s2[p1 + STATE.P_Z]]
          );
        }
      }
    });
  vbo_6.init();
  vbo_boxes.push(vbo_6);

}

/**
 * Initializes all of the particle systems.
 */
function initParticleSystems() {
  var k_s = 30; // spring constant
  var k_d = 5; // damping coefficient
  var dist = 0.5; // natural spring length
  var initial_conditions;

  /* Particle System 1: Snow */
  particles = [...Array(VEC_FIELD_PARTICLE_COUNT).keys()];
  initial_conditions = [];
  for (var i = 0; i < VEC_FIELD_PARTICLE_COUNT * STATE_SIZE; i += STATE_SIZE) {
    [].push.apply(initial_conditions, [
      // Position
      Math.random() * top_m[0] + top_a[0], Math.random() * top_m[1] + top_a[1], Math.random() * top_m[2] + top_a[2],
      // Velocity
      0, 0, 0,
      // Force
      0, 0, 0,
      // Color
      Math.random() * 0.1 + 0.9, Math.random() * 0.1 + 0.9, Math.random() * 0.1 + 0.9, 0.75,
      // Mass
      0.5,
      // Radius
      Math.random() * 4,
      // Age
      i / STATE_SIZE
    ]);
  }
  vfield.init(PARTICLE_SYSTEM.SNOW,
    1, 5,
    [
      // gravity
      new Force(FORCE_TYPE.FORCE_SIMP_GRAVITY, particles).init_vectored(-tracker.gravity),
      // air drag
      new Force(FORCE_TYPE.FORCE_DRAG, particles).init_vectored(tracker.drag),
      // attractor
      new Force(FORCE_TYPE.FORCE_VORTEX, particles).init_attractor( /* pos */ 6, 7, 0, /* a */ 0, 0, 1, /* τ, L, r */ 2, 10, 6),
    ],
    [
      new Constraint(CONSTRAINT_TYPE.VOLUME_IMPULSIVE, particles, glMatrix.vec3.fromValues(1, 1, 1), WALL.ALL, 0.1, 1, 11, 2, 12, 0, 10),
      new Constraint(CONSTRAINT_TYPE.EXTERNAL_VOLUME_IMPULSIVE, particles, glMatrix.vec3.fromValues(0, 1, 0), WALL.ALL, 1, 6, 6.001, 7, 7.001, 0, 10),
    ],
    new Float32Array(initial_conditions)
  );

  /* Particle System 2: Boids */
  particles = [...Array(BOID_PARTICLE_COUNT - 1).keys()];
  initial_conditions = [];
  for (var i = 0; i < BOID_PARTICLE_COUNT * STATE_SIZE; i += STATE_SIZE) {
    [].push.apply(initial_conditions, [
      // Position
      Math.random() * 3 - 5, Math.random() * 5 - 3, Math.random() + 2,
      // Velocity
      Math.random() * 6 - 3, Math.random(), Math.random() * 6 - 3,
      // Force
      0, 0, 0,
      // Color
      0.1, 0.1, 0.1, 1,
      // Mass
      1,
      // Radius
      12,
      // Age
      0
    ]);
  }
  initial_conditions[(BOID_PARTICLE_COUNT - 1) * STATE_SIZE + STATE.R] = 1;
  initial_conditions[(BOID_PARTICLE_COUNT - 1) * STATE_SIZE + STATE.G] = 0.1;
  initial_conditions[(BOID_PARTICLE_COUNT - 1) * STATE_SIZE + STATE.B] = 0.1;
  boid.init(PARTICLE_SYSTEM.BOIDS,
    2, 5,
    [
      // boids
      new Force(FORCE_TYPE.FORCE_FLOCK, particles).init_boid(0.5, 1, (2 * Math.PI) * (1 / 4), (2 * Math.PI) * (1 / 2), 0.8, 0.1, 0.5, 0.1, 0.4),
      // drag
      new Force(FORCE_TYPE.FORCE_DRAG, particles).init_vectored(tracker.drag),
      // wind
      new Force(FORCE_TYPE.FORCE_WIND, particles).init_vectored(4, 1, 1, 0),
      // "predator" forces: point attractor, drag
      new Force(FORCE_TYPE.FORCE_UNIFORM_POINT_ATTRACTOR, [BOID_PARTICLE_COUNT - 1]).init_attractor(0, 0, 0),
      new Force(FORCE_TYPE.FORCE_DRAG, [BOID_PARTICLE_COUNT - 1]).init_vectored(tracker.drag),
    ],
    [
      // Walls on top and bottom for boids
      new Constraint(CONSTRAINT_TYPE.VOLUME_IMPULSIVE, particles, glMatrix.vec3.fromValues(1, 1, 1), WALL.TOP | WALL.BOTTOM, tracker.restitution, -5, -2, -3, 2, 2.025, 3),
      // Walls on all sides for predator
      new Constraint(CONSTRAINT_TYPE.VOLUME_IMPULSIVE, [BOID_PARTICLE_COUNT - 1], glMatrix.vec3.fromValues(1, 1, 0.1), WALL.ALL, tracker.restitution, -5, -2, -3, 2, 2.025, 3),
      // Wraparound for boids
      new Constraint(CONSTRAINT_TYPE.VOLUME_WRAP, particles, glMatrix.vec3.fromValues(1, 0.1, 0.1), WALL.ALL ^ (WALL.TOP | WALL.BOTTOM), 0, -5, -2, -3, 2, 2.025, 3),
    ],
    new Float32Array(initial_conditions)
  );

  /* Particle System 3: Reeve's Fire */
  particles = [...Array(FIRE_PARTICLE_COUNT).keys()];
  initial_conditions = [];
  for (var i = 0; i < FIRE_PARTICLE_COUNT * STATE_SIZE; i += STATE_SIZE) {
    [].push.apply(initial_conditions, [
      // Position
      -1, -1.5, 1,
      // Velocity
      0, 0, 0,
      // Force
      0, 0, 0,
      // Color
      0.7, 0, 0, 0.5,
      // Mass
      1,
      // Radius
      12,
      // Age
      i % 90,
    ]);
  }
  fire.init(PARTICLE_SYSTEM.REEVES_FIRE,
    3, 5,
    [
      // TODO gravity
      // new Force(FORCE_TYPE.FORCE_SIMP_GRAVITY, particles).init_vectored(-tracker.gravity),
      // air drag
      new Force(FORCE_TYPE.FORCE_DRAG, particles).init_vectored(tracker.drag),
      // Fountain effect
      new Force(FORCE_TYPE.FORCE_WIND, particles).init_vectored(4, 0, 0, 1),
      new Force(FORCE_TYPE.FORCE_WIND, particles).init_vectored(4, 1, 0, 0),
      new Force(FORCE_TYPE.FORCE_WIND, particles).init_vectored(4, 0, 1, 0),
    ],
    [
      new Constraint(CONSTRAINT_TYPE.VOLUME_IMPULSIVE, particles, glMatrix.vec3.fromValues(1, 1, 1), WALL.ALL, tracker.restitution, -2, 1, -3, -0.025, 0, 1.975),
      new Constraint(CONSTRAINT_TYPE.SPHERE, particles, glMatrix.vec3.fromValues(1, 0.2, 0.2), 0, 0, -0.5, -1.5, 1, 0.25),
    ],
    new Float32Array(initial_conditions)
  );

  /* Particle System 4: Springs */
  particles = [...Array(SPRING_PARTICLE_COUNT).keys()];
  k_s = 30;
  k_d = 5;
  dist = 0.05;
  initial_conditions = [];
  for (var i = 0; i < SPRING_PARTICLE_COUNT; i++) {
    [].push.apply(initial_conditions, [
      // Position
      0, 0.25 + (i % CLOTH_WIDTH) * dist, 1.95 - (i / CLOTH_WIDTH) * dist,
      // Velocity
      0, 0, 0,
      // Force
      0, 0, 0,
      // Color
      1, 1, 1, 1,
      // Mass
      0.1,
      // Radius
      0.5,
      // Age
      0
    ]);
  }
  var cloth_f = [];
  var cloth_c = [];
  for (var i = 0; i < CLOTH_WIDTH * CLOTH_HEIGHT; i++) {
    // Pin the top of the cloth
    if (i < CLOTH_WIDTH) {
      cloth_c.push(new Constraint(CONSTRAINT_TYPE.ABSOLUTE, [i], glMatrix.vec3.create(), undefined, tracker.restitution, 0, 0.25 + i * dist, 1.95));
    }
    /* Structural Springs */
    // Horizontal
    if (i % CLOTH_WIDTH < CLOTH_WIDTH - 1) {
      cloth_f.push(new Force(FORCE_TYPE.FORCE_SPRING, [i, i + 1]).init_spring(k_s, dist, k_d));
    }
    // Vertical
    if (i < CLOTH_WIDTH * (CLOTH_HEIGHT - 1)) {
      cloth_f.push(new Force(FORCE_TYPE.FORCE_SPRING, [i, i + CLOTH_WIDTH]).init_spring(k_s, dist, k_d));
    }
    /* Shear Springs */
    // Diagonal left
    if (i < CLOTH_WIDTH * (CLOTH_HEIGHT - 1) && i % CLOTH_WIDTH < CLOTH_WIDTH - 1) {
      cloth_f.push(new Force(FORCE_TYPE.FORCE_SPRING, [i, i + CLOTH_WIDTH + 1]).init_spring(k_s, Math.sqrt(dist * dist + dist * dist), k_d));
    }
    // Diagonal right
    if (i < CLOTH_WIDTH * (CLOTH_HEIGHT - 1) && i % CLOTH_WIDTH > 0) {
      cloth_f.push(new Force(FORCE_TYPE.FORCE_SPRING, [i, i + CLOTH_WIDTH - 1]).init_spring(k_s, Math.sqrt(dist * dist + dist * dist), k_d));
    }
    /* Bend Springs */
    // Horizontal
    if (i % CLOTH_WIDTH < CLOTH_WIDTH - 2) {
      cloth_f.push(new Force(FORCE_TYPE.FORCE_SPRING, [i, i + 2]).init_spring(k_s, dist * 2, k_d));
    }
    // Vertical
    if (i < CLOTH_WIDTH * (CLOTH_HEIGHT - 2)) {
      cloth_f.push(new Force(FORCE_TYPE.FORCE_SPRING, [i, i + (CLOTH_WIDTH * 2)]).init_spring(k_s, dist * 2, k_d));
    }
  }
  spring.init(PARTICLE_SYSTEM.CLOTH,
    4, 5,
    [
      // gravity
      new Force(FORCE_TYPE.FORCE_SIMP_GRAVITY, particles).init_vectored(-tracker.gravity),
      // air drag
      new Force(FORCE_TYPE.FORCE_DRAG, particles).init_vectored(tracker.drag * 4),
      // spring: cloth
      ...cloth_f,
    ],
    [
      new Constraint(CONSTRAINT_TYPE.VOLUME_IMPULSIVE, particles, glMatrix.vec3.fromValues(1, 1, 1), WALL.ALL /* ^ WALL.BOTTOM */, tracker.restitution, -1, 1, 0, 2, 0, 1.975),
      new Constraint(CONSTRAINT_TYPE.SPHERE, particles, glMatrix.vec3.fromValues(0.5, 0.5, 0.5), 0, tracker.restitution, -0.1, 0.65, 1, 0.5),
      new Constraint(CONSTRAINT_TYPE.SPHERE, particles, glMatrix.vec3.fromValues(0.5, 0.5, 0.5), 0, tracker.restitution, 0.1, 1.5, 1.3, 0.25),
      new Constraint(CONSTRAINT_TYPE.SPHERE, particles, glMatrix.vec3.fromValues(0.5, 0.5, 0.5), 0, tracker.restitution, 0.5, 0.75, 0, 0.375),
      new Constraint(CONSTRAINT_TYPE.SPHERE, particles, glMatrix.vec3.fromValues(0.5, 0.5, 0.5), 0, tracker.restitution, -0.125, 1.25, -0.125, 0.5),
      ...cloth_c,
    ],
    new Float32Array(initial_conditions)
  );
}

/**
 * Draws all of the VBOBoxes.
 */
function drawAll() {
  if (tracker.clear) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  vbo_boxes.forEach((box, i) => {
    box.enable();
    box.adjust();
    box.draw();
  });
}
