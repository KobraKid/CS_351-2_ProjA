/**
 * Abstracted container for WebGL. Inspired by Tumblin's VBOBox.
 *
 * @author Michael Huyler
 */

/* Camera variables */
// where the camera is
var g_perspective_eye = [6, 0, 1];
// where the camera is pointing
var g_perspective_lookat = [5, 0, 1];
// the camera's up axis
var g_perspective_up = [0, 0, 1];
// rotation step
var theta = 3.14;

/**
 * A complete encapsulation of a VBO and its corresponding shader program.
 *
 * Provides an easy way to switch between VBOs, especially those which use
 * different shaders, or which have different attribute sets.
 */
class VBOBox {
  /**
   * @param {String} VERTEX_SHADER The vertex shader for this box.
   * @param {String} FRAGMENT_SHADER The fragment shader for this box.
   * @param {Float32Array} vertex_array An array of vertices to be loaded into the VBO.
   * @param {GLenum} draw_method The mode to be used when calling WebGLRenderingContext.drawArrays().
   * @param {number} attribute_count The number of attributes each vertex has.
   * @param {[string: number]} attributes A dictionary of attributes stored in the VBO, where keys are the
   *        attribute names, and values are how many floats are stared in the VBO for the given attribute.
   * @param {number} box_num The index of this box.
   */
  constructor(VERTEX_SHADER, FRAGMENT_SHADER, vertex_array, draw_method,
    attribute_count, attributes, box_num, adjust_function) {
    /* GLSL shader code */
    this.VERTEX_SHADER = VERTEX_SHADER;
    this.FRAGMENT_SHADER = FRAGMENT_SHADER;

    /* VBO contents */
    this._vbo = vertex_array;

    /* VBO metadata */
    // Number of vertices in the VBO
    this.vertex_count = this._vbo.length / attribute_count;
    // Number of bytes each float requires
    this.FSIZE = this._vbo.BYTES_PER_ELEMENT;
    // Total size of the VBO in bytes
    this.vbo_size = this._vbo.length * this.FSIZE;
    // Size of a single vertex in bytes
    this.vbo_stride = this.vbo_size / this.vertex_count;
    // How to interpret the vertices
    this.draw_method = draw_method;

    /* GPU memory locations */
    this.vbo_loc;
    this.shader_loc;

    /* Attribute metadata */
    this.attributes = [];
    for (var attribute in attributes) {
      this.attributes.push({
        name: attribute,
        count: attributes[attribute][1],
        offset: attributes[attribute][0]  * this.FSIZE,
        location: ''
      });
    }

    /* Uniform variables and locations */
    this._model_matrix = glMatrix.mat4.create();
    this.u_model_matrix_loc;
    this._view_matrix = glMatrix.mat4.create();
    this.u_view_matrix_loc;
    this._projection_matrix = glMatrix.mat4.create();
    this.u_projection_matrix_loc;

    /* VBOBox index */
    this.box_num = box_num;

    /* Adjust function */
    this.custom_adjust = adjust_function;
  }

  get model_matrix() {
    return this._model_matrix;
  }
  get program() {
    return this.shader_loc;
  }
  get projection_matrix() {
    return this._projection_matrix;
  }
  get vbo() {
    return this._vbo;
  }
  get view_matrix() {
    return this._view_matrix;
  }

  set model_matrix(matrix) {
    this._model_matrix = matrix;
  }
  set projection_matrix(matrix) {
    this._projection_matrix = matrix;
  }
  set vbo(vbo) {
    this._vbo = vbo;
  }
  set view_matrix(matrix) {
    this._view_matrix = matrix;
  }

  /**
   * Initializes a VBOBox, finds GPU locaiton of all variables.
   */
  init() {
    // Set up shader
    this.shader_loc =
      createProgram(gl, this.VERTEX_SHADER, this.FRAGMENT_SHADER);
    if (!this.shader_loc) {
      console.log(this.constructor.name +
        '.init() failed to create executable Shaders on the GPU.');
      return;
    }
    gl.program = this.shader_loc;

    this.vbo_loc = gl.createBuffer();
    if (!this.vbo_loc) {
      console.log(this.constructor.name +
        '.init() failed to create VBO in GPU.');
      return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo_loc);
    gl.bufferData(gl.ARRAY_BUFFER, this.vbo, gl.STATIC_DRAW);

    // Set up attributes
    this.attributes.forEach((attribute, i) => {
      attribute.location =
        gl.getAttribLocation(this.shader_loc, attribute.name);
      if (attribute.locaiton < 0) {
        console.log(this.constructor.name +
          '.init() Failed to get GPU location of ' +
          attribute.name);
        return;
      }
    });

    // Set up uniforms
    this.u_model_matrix_loc =
      gl.getUniformLocation(this.shader_loc, 'u_model_matrix_' + this.box_num);
    if (!this.u_model_matrix_loc) {
      console.log(this.constructor.name +
        '.init() failed to get GPU location for u_model_matrix_' + this.box_num + ' uniform');
      return;
    }

    this.u_view_matrix_loc =
      gl.getUniformLocation(this.shader_loc, 'u_view_matrix_' + this.box_num);
    if (!this.u_view_matrix_loc) {
      console.log(this.constructor.name +
        '.init() failed to get GPU location for u_view_matrix_' + this.box_num + ' uniform');
      return;
    }

    this.u_projection_matrix_loc =
      gl.getUniformLocation(this.shader_loc, 'u_projection_matrix_' + this.box_num);
    if (!this.u_projection_matrix_loc) {
      console.log(this.constructor.name +
        '.init() failed to get GPU location for u_projection_matrix_' + this.box_num + ' uniform');
      return;
    }
  }

  /**
   * Enables a VBOBox, switching the GPU over to the box's program and enables
   * the current program's attributes.
   */
  enable() {
    gl.useProgram(this.shader_loc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo_loc);

    this.attributes.forEach((attribute, _) => {
      gl.vertexAttribPointer(
        attribute.location,
        attribute.count,
        gl.FLOAT,
        false,
        this.vbo_stride,
        attribute.offset
      );
      gl.enableVertexAttribArray(attribute.location);
    });
  }

  /**
   * Ensures that this VBOBox is ready to be used.
   */
  validate() {
    if (gl.getParameter(gl.CURRENT_PROGRAM) != this.shader_loc) {
      console.log(this.constructor.name +
        '.validate(): shader program at this.shader_loc not in use!');
      return false;
    }
    if (gl.getParameter(gl.ARRAY_BUFFER_BINDING) != this.vbo_loc) {
      console.log(this.constructor.name +
        '.validate(): vbo at this.vbo_loc not in use!');
      return false;
    }
    return true;
  }

  /**
   * Adjusts matrices every frame, sends new values to the GPU.
   */
  adjust() {
    this.custom_adjust();
    glMatrix.mat4.perspective(this.projection_matrix, 30 * Math.PI / 180, aspect, 1, 100);
    glMatrix.mat4.lookAt(
      this.view_matrix,
      glMatrix.vec3.fromValues(g_perspective_eye[0], g_perspective_eye[1], g_perspective_eye[2]),
      glMatrix.vec3.fromValues(g_perspective_lookat[0], g_perspective_lookat[1], g_perspective_lookat[2]),
      glMatrix.vec3.fromValues(g_perspective_up[0], g_perspective_up[1], g_perspective_up[2]),
    );
    glMatrix.mat4.identity(this.model_matrix);
    gl.uniformMatrix4fv(this.u_model_matrix_loc, false, this.model_matrix);
    gl.uniformMatrix4fv(this.u_view_matrix_loc, false, this.view_matrix);
    gl.uniformMatrix4fv(this.u_projection_matrix_loc, false, this.projection_matrix);
  }

  /**
   * Draws the current VBOBox, using the currently loaded program, variables
   * and VBO contents.
   */
  draw() {
    if (!this.validate()) {
      console.log('ERROR: Before .draw() you need to call .enable()');
    }
    gl.drawArrays(this.draw_method, 0, this.vertex_count);
  }

  /**
   * Reloads the contents of the VBO.
   *
   * Useful if independent vertices should move. Modifications to this VBOBox's
   * vbo array will be substituted into the GPU's VBO.
   */
  reload(data, index = 0) {
    gl.bufferSubData(gl.ARRAY_BUFFER, index * this.FSIZE, data);
  }
}
