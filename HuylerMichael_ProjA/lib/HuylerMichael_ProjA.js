/**
 * Michael Huyler
 * CS 351-2
 * Winter 2020
 */

// GL context
var gl;
// HTML canvas
var canvas;
// Screen aspect ratio
var aspect;

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

  gl.clearColor(0, 0, 0, 1);
  gl.enable(gl.DEPTH_TEST);

  window.addEventListener("keydown", keyDown, false);
}

function drawResize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  aspect = canvas.width / canvas.height;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function keyDown(kev) {
  var code;
  if (!kev.code) {
    code = "" + kev.keyCode;
  } else {
    code = kev.code;
  }
  switch (code) {
    case "KeyW":
      break;
    case "KeyA":
      break;
    case "KeyS":
      break;
    case "KeyD":
      break;
    default:
      console.log("Unused key: " + code);
      break;
  }
}
