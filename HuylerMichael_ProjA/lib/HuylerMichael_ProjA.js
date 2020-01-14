/**
 * Main entry point into the program.
 *
 * Handles setting up objects required for 3D graphics.
 *
 * @author Michael Huyler
 */

// GL context
var gl;
// HTML canvas
var canvas;
// Screen aspect ratio
var aspect;
// Ground plane VBOBox
var vbo_0;
// Tick function
var tick = function() {
  requestAnimationFrame(tick, canvas);
  drawAll();
}

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

  window.addEventListener("keydown", keyDown, false);

  initGui();

  initVBO();

  tick();
}

function initVBO() {
  // Ground Grid
  {
    var xcount = 15;
    var zcount = 15;
    var xzmax = 5.0;
    var v = 0;
    var j = 0;
    verts = new Float32Array(7 * 2 * (xcount + zcount));
    var xgap = xzmax / (xcount - 1);
    var zgap = xzmax / (zcount - 1);
    for (v = 0, j = 0; v < 2 * xcount; v++, j += 7) {
      if (v % 2 == 0) {
        verts[j] = -xzmax + (v) * xgap;
        verts[j + 1] = -xzmax;
        verts[j + 2] = 0.0;
        verts[j + 3] = 1.0;
      } else {
        verts[j] = -xzmax + (v - 1) * xgap;
        verts[j + 1] = xzmax;
        verts[j + 2] = 0.0;
        verts[j + 3] = 1.0;
      }
    }
    for (v = 0; v < 2 * zcount; v++, j += 7) {
      if (v % 2 == 0) {
        verts[j] = -xzmax;
        verts[j + 1] = -xzmax + (v) * zgap;
        verts[j + 2] = 0.0;
        verts[j + 3] = 1.0;
      } else {
        verts[j] = xzmax;
        verts[j + 1] = -xzmax + (v - 1) * zgap;
        verts[j + 2] = 0.0;
        verts[j + 3] = 1.0;
      }
    }
    for (var i = 0; i < verts.length; i += 7) {
      verts[i + 4] = 0 / 255;
      verts[i + 5] = 40 / 255;
      verts[i + 6] = 80 / 255;
    }
    console.log(verts);
  }
  // var verts = new Float32Array(10 * 100);
  // for (var i = 0; i < 100; i++) {
  //   verts[i + 0] = Math.random() / 2;
  //   verts[i + 1] = Math.random() / 2;
  //   verts[i + 2] = 1.0;
  //   verts[i + 3] = 1.0;
  //   verts[i + 4] = 0 / 255;
  //   verts[i + 5] = 40 / 255;
  //   verts[i + 6] = 80 / 255;
  // }

  var ground_plane_vertex_shader = `
    precision highp float;

    // ATTRIBUTES
    attribute vec4 a_position_0;
    attribute vec3 a_color_0;

    // UNIFORMS
    uniform mat4 u_model_matrix_0;

    // VARYING
    varying vec3 v_position_0;
    varying vec3 v_color_0;

    void main() {
  		gl_Position = a_position_0;
  		v_color_0 = a_color_0;
      u_model_matrix_0;
    }
  `;
  var ground_plane_fragment_shader = `
    precision highp float;

    // VARYING
    varying vec3 v_position_0;
    varying vec3 v_color_0;

    void main() {
      gl_FragColor = vec4(v_color_0, 1.0);
    }
  `;
  vbo_0 = new VBOBox(
    ground_plane_vertex_shader,
    ground_plane_fragment_shader,
    verts,
    7,
    4,
    0,
    3,
    0);
  vbo_0.init();
}

function drawAll() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  vbo_0.enable();
  vbo_0.adjust();
  vbo_0.draw();
}
