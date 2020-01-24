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
  var vertex_shader_0 = `
    precision highp float;

    // ATTRIBUTES
    attribute vec4 a_position_0;
    attribute vec3 a_color_0;

    // UNIFORMS
    uniform mat4 u_model_matrix_0;
    uniform mat4 u_view_matrix_0;
    uniform mat4 u_projection_matrix_0;

    // VARYING
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
  vbo_0 = new VBOBox(vertex_shader_0, fragment_shader_0, verts, gl.LINES, 7, 4, 0, 3, 0);
  vbo_0.init();
}

function drawAll() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  vbo_0.enable();
  vbo_0.adjust();
  vbo_0.draw();
}
