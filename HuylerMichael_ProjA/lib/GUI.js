var gui;
var gui_open = true;
var GuiTracker = function() {
  this.test_var = 0;
}
var tracker = new GuiTracker();
var help_visible = false;

function initGui() {
  gui = new dat.GUI({
    name: 'My GUI',
    hideable: false
  });
  gui.add(tracker, 'test_var').name('Test Variable');
  if (!gui_open)
    gui.close();
  document.getElementsByClassName('close-bottom')[0].onclick = function() {
    gui_open = !gui_open;
  };
}

function toggle_gui() {
  gui_open = !gui_open;
  if (gui_open)
    gui.open();
  else
    gui.close();
}

function toggle_help() {
  help_visible = !help_visible;
  document.getElementById("help-menu-expanded").style.visibility = help_visible ? "visible" : "hidden";
  document.getElementById("help-menu").innerHTML = help_visible ? "Hide Help" : "Show Help";
}

initGui();
