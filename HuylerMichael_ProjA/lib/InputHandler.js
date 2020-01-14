/**
 * Input handler.
 *
 * Handles all user inputs - keyboard & mouse.
 *
 * @author Michael Huyler
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

function drawResize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  aspect = canvas.width / canvas.height;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
