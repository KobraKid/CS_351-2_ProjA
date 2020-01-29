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
  this.solver = 1;
  this.bounce_type = 1;
  this.fountain = false;
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
  var partSys1 = gui.addFolder('Particle System 1');
  partSys1.add(tracker, 'constraint_0_x_min').name('x-min').onChange(function() {
    if (tracker.constraint_0_x_min > tracker.constraint_0_x_max) {
      tracker.constraint_0_x_min = tracker.constraint_0_x_max - 0.1;
    }
    bball.constraint_set[0].x_min = tracker.constraint_0_x_min;
    bball.constraint_set[0].draw(0, tracker.constraint_0_drawn);
  });
  partSys1.add(tracker, 'constraint_0_x_max').name('x-max').onChange(function() {
    if (tracker.constraint_0_x_max < tracker.constraint_0_x_min) {
      tracker.constraint_0_x_max = tracker.constraint_0_x_min + 0.1;
    }
    bball.constraint_set[0].x_max = tracker.constraint_0_x_max;
    bball.constraint_set[0].draw(0, tracker.constraint_0_drawn);
  });
  partSys1.add(tracker, 'constraint_0_y_min').name('y-min').onChange(function() {
    if (tracker.constraint_0_y_min > tracker.constraint_0_y_max) {
      tracker.constraint_0_y_min = tracker.constraint_0_y_max - 0.1;
    }
    bball.constraint_set[0].y_min = tracker.constraint_0_y_min;
    bball.constraint_set[0].draw(0, tracker.constraint_0_drawn);
  });
  partSys1.add(tracker, 'constraint_0_y_max').name('y-max').onChange(function() {
    if (tracker.constraint_0_y_max < tracker.constraint_0_y_min) {
      tracker.constraint_0_y_max = tracker.constraint_0_y_min + 0.1;
    }
    bball.constraint_set[0].y_max = tracker.constraint_0_y_max;
    bball.constraint_set[0].draw(0, tracker.constraint_0_drawn);
  });
  partSys1.add(tracker, 'constraint_0_z_min').name('z-min').onChange(function() {
    if (tracker.constraint_0_z_min > tracker.constraint_0_z_max) {
      tracker.constraint_0_z_min = tracker.constraint_0_z_max - 0.1;
    }
    bball.constraint_set[0].z_min = tracker.constraint_0_z_min;
    bball.constraint_set[0].draw(0, tracker.constraint_0_drawn);
  });
  partSys1.add(tracker, 'constraint_0_z_max').name('z-max').onChange(function() {
    if (tracker.constraint_0_z_max < tracker.constraint_0_z_min) {
      tracker.constraint_0_z_max = tracker.constraint_0_z_min + 0.1;
    }
    bball.constraint_set[0].z_max = tracker.constraint_0_z_max;
    bball.constraint_set[0].draw(0, tracker.constraint_0_drawn);
  });
  partSys1.add(tracker, 'constraint_0_drawn').name('Visible').onChange(function(value) {
    bball.constraint_set.forEach((constraint, i) => {
      constraint.draw(i, value);
    });
  });
  partSys1.add(tracker, 'fountain').name('Fountain');
  gui.add(tracker, 'drag', 0, 1, 0.005);
  gui.add(tracker, 'gravity', 0);
  gui.add(tracker, 'restitution');
  gui.add(tracker, 'solver', {
    'Explicit': 0,
    'Implicit': 1
  });
  gui.add(tracker, 'bounce_type', {
    'Velocity Reverse': 0,
    'Impulsive': 1
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
