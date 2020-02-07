/**
 * GUI Manager.
 *
 * Handles setting up the GUI and help menu and sets up helper functions to
 * toggle the menus.
 *
 * @author Michael Huyler
 */

var gui;
var gui_open = false;
var GuiTracker = function() {
  /* Particle System 1 */
  this.constraint_0_x_min = -1;
  this.constraint_0_x_max = 1;
  this.constraint_0_y_min = -1;
  this.constraint_0_y_max = 1;
  this.constraint_0_z_min = 0;
  this.constraint_0_z_max = 2;
  this.constraint_0_drawn = true;
  this.drag = 0.985;
  this.gravity = 9.832;
  this.restitution = 1.0;
  this.solver = SOLVER.MIDPOINT;
  this.bounce_type = CONSTRAINT_TYPE.VOLUME_IMPULSIVE;
  this.fountain = false;
  this.clear = true;
  this.pause = false;
  /* FPS */
  this.fps = 60.0;
  this.ms = 1000.0 / 60.0; // timestep
  this.prev = Date.now();
  this.speed = 1; // speed at which simulation should run
  /**
   * Updatets the FPS in the GUI
   */
  this.fps_calc = function() {
    var now = Date.now();
    var elapsed = now - this.prev;
    this.prev = now;
    this.ms = elapsed / this.speed;
    tracker.fps = 1000.0 / elapsed;
  }
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
  gui.add(tracker, 'fps', 0, 60, 1).name('FPS').listen();
  gui.add(tracker, 'fountain').name('Fountain');
  gui.add(tracker, 'drag', 0, 1, 0.005);
  gui.add(tracker, 'gravity', 0);
  gui.add(tracker, 'restitution');
  gui.add(tracker, 'solver', {
    'Euler': 0,
    'Midpoint': 1,
    'Runga-Kutta': 2,
    'Iterative Backwind': 3,
    'Verlet': 4,
  });
  gui.add(tracker, 'bounce_type', {
    'Velocity Reverse': CONSTRAINT_TYPE.VOLUME_VELOCITY_REVERSE,
    'Impulsive': CONSTRAINT_TYPE.VOLUME_IMPULSIVE,
  }).name('bounce type').onChange(function(value) {
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
