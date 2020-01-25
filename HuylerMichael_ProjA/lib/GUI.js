/**
 * GUI Manager.
 *
 * Handles setting up the GUI and help menu and sets up helper functions to
 * toggle the menus.
 *
 * @author Michael Huyler
 */

var gui;
var gui_open = true;
var GuiTracker = function() {
  this.vel_x = 0;
  this.vel_y = 0;
  this.vel_z = 0;
  this.addVel = function() {
    bball.addForce(new Force(FORCE_TYPE.FORCE_WIND, 1, 0, 0, this.vel_x, TIMEOUT_INSTANT));
    bball.addForce(new Force(FORCE_TYPE.FORCE_WIND, 0, 1, 0, this.vel_y, TIMEOUT_INSTANT));
    bball.addForce(new Force(FORCE_TYPE.FORCE_WIND, 0, 0, 1, this.vel_z, TIMEOUT_INSTANT));
  }
  this.drag = 0.985;
  this.gravity = 9.832;
  this.restitution = 1.0;
  this.solver = 1;
  this.bounce_type = 1;
  this.clear = true;
  this.pause = false;
}
var tracker = new GuiTracker();
var help_visible = false;

/**
 * Initializes the GUI.
 */
function initGui() {
  gui = new dat.GUI({
    name: 'My GUI',
    hideable: false
  });
  var addVelocity = gui.addFolder('Add Velocity');
  addVelocity.add(tracker, 'vel_x', -9, 9, 0.5);
  addVelocity.add(tracker, 'vel_y', -9, 9, 0.5);
  addVelocity.add(tracker, 'vel_z', -9, 9, 0.5);
  addVelocity.add(tracker, 'addVel').name('Click to bounce!');
  addVelocity.open();
  gui.add(tracker, 'drag', 0, 1, 0.005);
  gui.add(tracker, 'gravity', 0);
  gui.add(tracker, 'restitution');
  gui.add(tracker, 'solver', {'Explicit': 0, 'Implicit': 1});
  gui.add(tracker, 'bounce_type', {'Velocity Reverse': 0, 'Impulsive': 1}).name('bounce type').onChange(function(value) {
    if (value == 0) {
      bball.removeConstraint(0);
      bball.addConstraint(new Constraint(CONSTRAINT_TYPE.VOLUME_VELOCITY_REVERSE, [...Array(PARTICLE_COUNT).keys()], 0, 0.9, 0, 0.9, 0, 0.9));
    } else if (value == 1) {
      bball.removeConstraint(0);
      bball.addConstraint(new Constraint(CONSTRAINT_TYPE.VOLUME_IMPULSIVE, [...Array(PARTICLE_COUNT).keys()], 0, 0.9, 0, 0.9, 0, 0.9));
    }
  });
  gui.add(tracker, 'clear').name('Clear screen?').listen();
  gui.add(tracker, 'pause').name('Pause').listen();
  if (gui_open)
    gui.close();
  document.getElementsByClassName('close-bottom')[0].onclick = function() {
    gui_open = !gui_open;
  };
}

/**
 * Toggles the GUI.
 */
function toggle_gui() {
  gui_open = !gui_open;
  if (gui_open)
    gui.open();
  else
    gui.close();
}

/**
 * Toggles the help menu.
 */
function toggle_help() {
  help_visible = !help_visible;
  document.getElementById("help-menu-expanded").style.visibility = help_visible ? "visible" : "hidden";
  document.getElementById("help-menu").innerHTML = help_visible ? "Hide Help" : "Show Help";
}
