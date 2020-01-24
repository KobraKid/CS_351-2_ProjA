/**
 * Input handler.
 *
 * Handles all program inputs, including keypress events, mouse events, and
 * page resize events.
 *
 * @author Michael Huyler
 */

/**
 * Handles keypress events.
 */
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

/**
 * Handles page resize events.
 *
 * Resizes the canvas and calls WebGLRenderingContext.viewport() to resize the
 * current rendering context according to the new canvas size and aspect ratio.
 */
function drawResize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  aspect = canvas.width / canvas.height;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
