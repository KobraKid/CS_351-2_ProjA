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
// Timestep
var timeStep = 1000.0 / 60.0;

/* VBO Boxes */
// Ground plane VBOBox
var vbo_0;
// Bouncy ball VBOBox
var vbo_1;
// Ball container visualization
var vbo_2;
// Spring visualization
var vbo_3;
// Array containing all VBOBoxes
var vbo_boxes = [];

/* Particle Systems */
var INIT_VEL = 0.15 * 60.0;
var BBALL_PARTICLE_COUNT = 5;
var bball = new PartSys(BBALL_PARTICLE_COUNT);
var SPRING_PARTICLE_COUNT = 9;
var spring = new PartSys(SPRING_PARTICLE_COUNT);

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
  gl.enable(gl.DEPTH_TEST);

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
  initVBOBoxes();
  initParticleSystems();

  var shouldUpdateKeypress = 0;
  var tick = function() {
    if (shouldUpdateKeypress >= 3) {
      updateKeypresses();
      shouldUpdateKeypress = 0;
    }
    shouldUpdateKeypress++;
    requestAnimationFrame(tick, canvas);
    updateAll();
    drawAll();
  };
  tick();
}

/**
 * Initializes all of the VBOBoxes.
 */
function initVBOBoxes() {
  var vertex_shader_0 = `
    precision highp float;

    uniform mat4 u_model_matrix_0;
    uniform mat4 u_view_matrix_0;
    uniform mat4 u_projection_matrix_0;

    attribute vec4 a_position_0;
    attribute vec3 a_color_0;

    varying vec4 v_color_0;

    void main() {
  		gl_Position = u_projection_matrix_0 * u_view_matrix_0 * u_model_matrix_0 * a_position_0;
  		v_color_0 = vec4(a_color_0, 1.0);
    }
  `;
  var fragment_shader_0 = `
    precision highp float;

    // VARYING
    varying vec4 v_color_0;

    void main() {
      gl_FragColor = v_color_0;
    }
  `;
  var xcount = 10;
  var ycount = 10;
  var xymax = 5.0;
  var v = 0;
  var j = 0;
  var verts = new Float32Array(7 * 2 * (xcount + ycount));

  var xgap = xymax / (xcount - 1);
  var ygap = xymax / (ycount - 1);
  for (v = 0, j = 0; v < 2 * xcount; v++, j += 7) {
    if (v % 2 == 0) {
      verts[j] = -xymax + (v) * xgap;
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
      verts[j + 1] = -xymax + (v) * ygap;
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
      'a_position_0': [0, 4],
      'a_color_0': [4, 3],
    },
    0,
    () => {});
  vbo_0.init();
  vbo_boxes.push(vbo_0);

  var vertex_shader_1 = `
    precision mediump float;

    uniform mat4 u_model_matrix_1;
    uniform mat4 u_view_matrix_1;
    uniform mat4 u_projection_matrix_1;

    attribute vec4 a_position_1;
    attribute vec4 a_color_1;

    varying vec4 v_color_1;

    void main() {
      gl_PointSize = 16.0;
      gl_Position = u_projection_matrix_1 * u_view_matrix_1 * u_model_matrix_1 * a_position_1;
      v_color_1 = vec4(a_color_1);
    }`;
  var fragment_shader_1 = `
    precision mediump float;

    // VARYING
    varying vec4 v_color_1;

    void main() {
      float dist = distance(gl_PointCoord, vec2(0.5, 0.5));
      if (dist < 0.5) {
        gl_FragColor = vec4((1.0 - 2.0 * dist) * v_color_1.rgb, 1.0);
      } else { discard; }
    }`;
  vbo_1 = new VBOBox(
    vertex_shader_1,
    fragment_shader_1,
    new Float32Array((BBALL_PARTICLE_COUNT + SPRING_PARTICLE_COUNT) * STATE_SIZE),
    gl.POINTS,
    STATE_SIZE, {
      'a_position_1': [0, 3],
      'a_color_1': [9, 4],
    },
    1,
    () => {
      if (!tracker.pause) {
        bball.applyAllForces(bball.s1);
        bball.s1dot = bball.dotFinder(bball.s1);
        bball.solver(Number(tracker.solver));
        bball.doConstraints();
        bball.render(vbo_1);
        bball.swap(bball.s1, bball.s2);

        spring.applyAllForces(spring.s1);
        spring.s1dot = spring.dotFinder(spring.s1);
        spring.solver(Number(tracker.solver));
        spring.doConstraints();
        spring.render(vbo_1, BBALL_PARTICLE_COUNT * STATE_SIZE);
        spring.swap(spring.s1, spring.s2);
      }
    });
  vbo_1.init();
  vbo_boxes.push(vbo_1);

  var vertex_shader_2 = `
    precision mediump float;

    uniform mat4 u_model_matrix_2;
    uniform mat4 u_view_matrix_2;
    uniform mat4 u_projection_matrix_2;

    attribute vec3 a_position_2;
    attribute vec3 a_color_2;
    attribute float a_enabled_2;

    varying vec3 v_color_2;
    varying float v_enabled_2;

    void main() {
      gl_Position = u_projection_matrix_2 * u_view_matrix_2 * u_model_matrix_2 * vec4(a_position_2, 1.0);
      v_color_2 = a_color_2;
      v_enabled_2 = a_enabled_2;
    }`;
  var fragment_shader_2 = `
    precision mediump float;

    varying vec3 v_color_2;
    varying float v_enabled_2;

    void main() {
      if (v_enabled_2 > 0.0) {
        gl_FragColor = vec4(v_color_2, 1.0);
      } else { discard; }
    }`;
  vbo_2 = new VBOBox(
    vertex_shader_2,
    fragment_shader_2,
    new Float32Array(7 * 24 * 4), // 7 attributes, 24 lines, max 4 constraints
    gl.LINES,
    7, {
      'a_position_2': [0, 3],
      'a_color_2': [3, 3],
      'a_enabled_2': [6, 1],
    },
    2,
    () => {});
  vbo_2.init();
  vbo_boxes.push(vbo_2);

  var vertex_shader_3 = `
    precision mediump float;

    uniform mat4 u_model_matrix_3;
    uniform mat4 u_view_matrix_3;
    uniform mat4 u_projection_matrix_3;

    attribute vec3 a_position_3;
    attribute vec3 a_color_3;
    attribute float a_enabled_3;

    varying vec3 v_color_3;
    varying float v_enabled_3;

    void main() {
      gl_Position = u_projection_matrix_3 * u_view_matrix_3 * u_model_matrix_3 * vec4(a_position_3, 1.0);
      v_color_3 = a_color_3;
      v_enabled_3 = a_enabled_3;
    }`;
  var fragment_shader_3 = `
    precision mediump float;

    varying vec3 v_color_3;
    varying float v_enabled_3;

    void main() {
      if (v_enabled_3 > 0.0) {
        gl_FragColor = vec4(v_color_3, 1.0);
      } else { discard; }
    }`;
  vbo_3 = new VBOBox(
    vertex_shader_3,
    fragment_shader_3,
    new Float32Array(7 * 24 * 4), // 7 attributes, 1 line, max 4 constraints
    gl.LINES,
    7, {
      'a_position_3': [0, 3],
      'a_color_3': [3, 3],
      'a_enabled_3': [6, 1],
    },
    3,
    () => {});
  vbo_3.init();
  vbo_boxes.push(vbo_3);
}

/**
 * Initializes all of the particle systems.
 */
function initParticleSystems() {
  // Particle System 1
  particles = [...Array(BBALL_PARTICLE_COUNT).keys()];
  bball.init(PARTICLE_SYSTEM.BOUNCY_BALL,
    vbo_1, vbo_2,
    [
      // gravity
      new Force(FORCE_TYPE.FORCE_SIMP_GRAVITY, particles).init_vectored(-tracker.gravity),
      // air drag
      new Force(FORCE_TYPE.FORCE_DRAG, particles).init_vectored(tracker.drag),
      // wind
      ...[...particles.map(i => new Force(FORCE_TYPE.FORCE_WIND, [i]).init_vectored(INIT_VEL * Math.random() * 25,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1))]
    ],
    [
      new Constraint(CONSTRAINT_TYPE.VOLUME_IMPULSIVE, particles, WALL.ALL, -1, 1, -1, 1, 0, 0.975),
    ]
  );
  particles.forEach(i => bball.disableForce(i + 2));
  bball.constraint_set[0].draw(bball._c_vbo, 0, true);
  // Particle System 2
  particles = [...Array(SPRING_PARTICLE_COUNT).keys()];
  var k_s = 10; // spring constant
  spring.init(PARTICLE_SYSTEM.BOUNCY_BALL,
    vbo_1, vbo_3,
    [
      // gravity
      // new Force(FORCE_TYPE.FORCE_SIMP_GRAVITY, particles).init_vectored(-tracker.gravity),
      // air drag
      new Force(FORCE_TYPE.FORCE_DRAG, particles).init_vectored(tracker.drag),
      // spring: tetrahedron
      new Force(FORCE_TYPE.FORCE_SPRING, [0, 1]).init_spring(k_s, 0.15),
      new Force(FORCE_TYPE.FORCE_SPRING, [0, 2]).init_spring(k_s, 0.15),
      new Force(FORCE_TYPE.FORCE_SPRING, [1, 2]).init_spring(k_s, 0.15),
      new Force(FORCE_TYPE.FORCE_SPRING, [0, 3]).init_spring(k_s, 0.15),
      new Force(FORCE_TYPE.FORCE_SPRING, [1, 3]).init_spring(k_s, 0.15),
      new Force(FORCE_TYPE.FORCE_SPRING, [2, 3]).init_spring(k_s, 0.15),
      // spring: snake
      new Force(FORCE_TYPE.FORCE_SPRING, [4, 5]).init_spring(k_s, 0.05),
      new Force(FORCE_TYPE.FORCE_SPRING, [5, 6]).init_spring(k_s, 0.10),
      new Force(FORCE_TYPE.FORCE_SPRING, [6, 7]).init_spring(k_s, 0.15),
      new Force(FORCE_TYPE.FORCE_SPRING, [7, 8]).init_spring(k_s, 0.20),

      new Force(FORCE_TYPE.FORCE_WIND, [4]).init_vectored(4, 0, 1, 0),
      new Force(FORCE_TYPE.FORCE_WIND, [4]).init_vectored(4, 1, 0, 0),
      new Force(FORCE_TYPE.FORCE_WIND, [4]).init_vectored(4, 0, -1, 0),
      new Force(FORCE_TYPE.FORCE_WIND, [4]).init_vectored(4, -1, 0, 0),
    ],
    [
      new Constraint(CONSTRAINT_TYPE.VOLUME_IMPULSIVE, particles, WALL.ALL, -2, 2, -2, 2, 1.025, 2),
    ]
  );
  spring.disableForce(11);
  spring.disableForce(12);
  spring.disableForce(13);
  spring.disableForce(14);
  var snake = setInterval(function() {
    spring.enableForce(11);
    spring.disableForce(12);
    spring.disableForce(13);
    spring.disableForce(14);
    setTimeout(function() {
      spring.disableForce(11);
      spring.enableForce(12);
      spring.disableForce(13);
      spring.disableForce(14);
      setTimeout(function() {
        spring.disableForce(11);
        spring.disableForce(12);
        spring.enableForce(13);
        spring.disableForce(14);
        setTimeout(function() {
          spring.disableForce(11);
          spring.disableForce(12);
          spring.disableForce(13);
          spring.enableForce(14);
        }, 3000)
      }, 3000)
    }, 3000)
  }, 12000);
  spring.constraint_set[0].draw(spring._c_vbo, 0, true);
}

/**
 * Updates all of the Particle Systems.
 */
function updateAll() {
  tracker.fps_calc();
}

/**
 * Draws all of the VBOBoxes.
 */
function drawAll() {
  if (tracker.clear) gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  vbo_boxes.forEach((box, _) => {
    box.enable();
    box.adjust();
    box.draw();
  });
}
