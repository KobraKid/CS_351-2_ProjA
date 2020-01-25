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
// Array containing all VBOBoxes
var vbo_boxes = [];

/* Particle Systems */
var INIT_VEL = 0.15 * 60.0;
var PARTICLE_COUNT = 2;
var bball = new PartSys(PARTICLE_COUNT);

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

  initGui();
  initParticleSystems();
  initVBOBoxes();

  var tick = function() {
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
    verts[i + 4] = 0.0 / 255;
    verts[i + 5] = 40.0 / 255;
    verts[i + 6] = 80.0 / 255;
  }
  vbo_0 = new VBOBox(vertex_shader_0, fragment_shader_0, verts, gl.LINES, 7, 4, 0, 3, 0, () => {});
  vbo_0.init();
  vbo_boxes.push(vbo_0);

  var vertex_shader_1 = `
    precision mediump float;

    uniform mat4 u_model_matrix_1;
    uniform mat4 u_view_matrix_1;
    uniform mat4 u_projection_matrix_1;

    attribute vec4 a_position_1;

    varying vec4 v_color_1;

    void main() {
      gl_PointSize = 20.0;
      gl_Position = u_projection_matrix_1 * u_view_matrix_1 * u_model_matrix_1 * a_position_1;
      v_color_1 = vec4(0.2, 1.0, 0.2, 1.0);
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
  vbo_1 = new VBOBox(vertex_shader_1, fragment_shader_1, new Float32Array(PARTICLE_COUNT * STATE_SIZE), gl.POINTS, STATE_SIZE, 3, 0, 0, 1, () => {
    bball.render(vbo_1);
    bball.swap();
  });
  vbo_1.init();
  vbo_boxes.push(vbo_1);

  var vertex_shader_2 =
    `precision mediump float;

    uniform mat4 u_model_matrix_2;
    uniform mat4 u_view_matrix_2;
    uniform mat4 u_projection_matrix_2;

    attribute vec3 a_position_2;
    attribute vec3 a_color_2;

    varying vec3 v_color_2;

    void main() {
      gl_Position = u_projection_matrix_2 * u_view_matrix_2 * u_model_matrix_2 * vec4(a_position_2, 1.0);
      v_color_2 = a_color_2;
    }`;
  var fragment_shader_2 =
    `precision mediump float;

    varying vec3 v_color_2;

    void main() {
      gl_FragColor = vec4(v_color_2, 1.0);
    }`;
  vbo_2 = new VBOBox(vertex_shader_2, fragment_shader_2, new Float32Array([
      0, 0, 0, 0, 0, 0,
      0.9, 0, 0, 0, 0, 0,

      0, 0, 0, 0, 0, 0,
      0, 0.9, 0, 0, 0, 0,

      0, 0, 0, 0, 0, 0,
      0, 0, 0.9, 0, 0, 0,

      0.9, 0, 0, 0, 0, 0,
      0.9, 0, 0.9, 0, 0, 0,

      0.9, 0, 0, 0, 0, 0,
      0.9, 0.9, 0, 0, 0, 0,

      0, 0.9, 0, 0, 0, 0,
      0, 0.9, 0.9, 0, 0, 0,

      0, 0.9, 0, 0, 0, 0,
      0.9, 0.9, 0, 0, 0, 0,

      0.9, 0.9, 0, 0, 0, 0,
      0.9, 0.9, 0.9, 0, 0, 0,

      0, 0, 0.9, 0, 0, 0,
      0.9, 0, 0.9, 0, 0, 0,

      0, 0, 0.9, 0, 0, 0,
      0, 0.9, 0.9, 0, 0, 0,

      0.9, 0, 0.9, 0, 0, 0,
      0.9, 0.9, 0.9, 0, 0, 0,

      0, 0.9, 0.9, 0, 0, 0,
      0.9, 0.9, 0.9, 0, 0, 0,

    ]),
    gl.LINES, 6, 3, 0, 3, 2, () => {});
  vbo_2.init();
  vbo_boxes.push(vbo_2);
}

/**
 * Initializes all of the particle systems.
 */
function initParticleSystems() {
  bball.init(0,
    [
      // gravity
      new Force(FORCE_TYPE.FORCE_SIMP_GRAVITY, 0, 0, 1, -tracker.gravity * (timeStep * 0.001), TIMEOUT_NO_TIMEOUT),
      // air drag
      new Force(FORCE_TYPE.FORCE_DRAG, 1, 1, 1, tracker.drag, TIMEOUT_NO_TIMEOUT),
    ],
    [
      new Constraint(CONSTRAINT_TYPE.VOLUME, [0, 1], 0, 0.9, 0, 0.9, 0, 0.9),
      // /* Velocity Reverse Floor Bounce */
      // // bounce on left wall
      // new Constraint(
      //   function(s0, s1) {
      //     return tracker.bounce_type == 0 && (s1[xpos] < 0.0 && s1[xvel] < 0.0);
      //   },
      //   function(s0, s1) {
      //     s1[xvel] = -tracker.restitution * s1[xvel];
      //   }
      // ),
      // // bounce on right wall
      // new Constraint(
      //   function(s0, s1) {
      //     return tracker.bounce_type == 0 && (s1[xpos] > 0.9 && s1[xvel] > 0.0);
      //   },
      //   function(s0, s1) {
      //     s1[xvel] = -tracker.restitution * s1[xvel];
      //   }
      // ),
      // // bounce on front wall
      // new Constraint(
      //   function(s0, s1) {
      //     return tracker.bounce_type == 0 && (s1[ypos] < 0.0 && s1[yvel] < 0.0);
      //   },
      //   function(s0, s1) {
      //     s1[yvel] = -tracker.restitution * s1[yvel];
      //   }
      // ),
      // // bounce on back wall
      // new Constraint(
      //   function(s0, s1) {
      //     return tracker.bounce_type == 0 && (s1[ypos] > 0.9 && s1[yvel] > 0.0);
      //   },
      //   function(s0, s1) {
      //     s1[yvel] = -tracker.restitution * s1[yvel];
      //   }
      // ),
      // // bounce on floor
      // new Constraint(
      //   function(s0, s1) {
      //     return tracker.bounce_type == 0 && (s1[zpos] < 0.0 && s1[zvel] < 0.0);
      //   },
      //   function(s0, s1) {
      //     s1[zvel] = -tracker.restitution * s1[zvel];
      //   }
      // ),
      // // bounce on ceiling
      // new Constraint(
      //   function(s0, s1) {
      //     return tracker.bounce_type == 0 && (s1[zpos] > 0.9 && s1[zvel] > 0.0);
      //   },
      //   function(s0, s1) {
      //     s1[zvel] = -tracker.restitution * s1[zvel];
      //   }
      // ),
      // // hard limit on 'floor' keeps z position >= 0;
      // new Constraint(
      //   function(s0, s1) {
      //     return tracker.bounce_type == 0 && (s1[zpos] < 0.0);
      //   },
      //   function(s0, s1) {
      //     s1[zpos] = 0.0;
      //   }
      // ),
    ]
  );
}

/**
 * Updates all of the Particle Systems.
 */
function updateAll() {
  if (!tracker.pause) {
    bball.dotFinder();
    bball.solver(tracker.solver);
    bball.doConstraints();
  }
}

/**
 * Draws all of the VBOBoxes.
 */
function drawAll() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  vbo_boxes.forEach((box, _) => {
    box.enable();
    box.adjust();
    box.draw();
  });
}
