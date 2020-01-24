/**
 * Abstracted container for WebGL. Inspired by Tumblin's VBOBox.
 *
 * @author Michael Huyler
 */

/* Camera */
// where the camera is
var g_perspective_eye = [6, 0, 1];
// where the camera is pointing
var g_perspective_lookat = [0, 0, 0];
var g_perspective_up = [0, 0, 1];
var theta = 3.14;

/*
 * A complete encapsulation of a VBO and its corresponding shader program.
 *
 * Provides an easy way to switch between VBOs, especially those which use
 * different shaders, or which have different attribute sets.
 */
class VBOBox {
  constructor(VERTEX_SHADER, FRAGMENT_SHADER, vertex_array, draw_method,
    attribute_count, pos_count, norm_count, color_count, box_num) {
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

    /* Attribute metadata */
    this.vertex_pos_count = pos_count;
    this.vertex_pos_offset = 0;
    this.vertex_norm_count = norm_count;
    this.vertex_norm_offset = this.vertex_pos_count * this.FSIZE;
    this.vertex_color_count = color_count;
    this.vertex_color_offset =
      (this.vertex_pos_count + this.vertex_norm_count) * this.FSIZE;

    /* GPU memory locations */
    this.vbo_loc;
    this.shader_loc;

    /* Attribute locations */
    this.a_position_location;
    this.a_normal_location;
    this.a_color_location;

    /* Uniform variables and locations */
    this._model_matrix = glMatrix.mat4.create();
    this.u_model_matrix_loc;
    this._view_matrix = glMatrix.mat4.create();
    this.u_view_matrix_loc;
    this._projection_matrix = glMatrix.mat4.create();
    this.u_projection_matrix_loc;

    /* VBOBox index */
    this.box_num = box_num;
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

  init() {
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

    this.a_position_location =
      gl.getAttribLocation(this.shader_loc, 'a_position_' + this.box_num);
    if (this.a_position_location < 0) {
      console.log(this.constructor.name +
        '.init() Failed to get GPU location of a_position_' + this.box_num + ' attribute');
      return;
    }

    if (this.vertex_norm_count > 0) {
      this.a_normal_location =
        gl.getAttribLocation(this.shader_loc, 'a_normal_' + this.box_num);
      if (this.a_normal_location < 0) {
        console.log(this.constructor.name +
          '.init() failed to get the GPU location of a_normal_' + this.box_num + ' attribute');
        return;
      }
    }

    if (this.vertex_color_count > 0) {
      this.a_color_location =
        gl.getAttribLocation(this.shader_loc, 'a_color_' + this.box_num);
      if (this.a_color_location < 0) {
        console.log(this.constructor.name +
          '.init() failed to get the GPU location of a_color_' + this.box_num + ' attribute');
        return;
      }
    }

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

  enable() {
    gl.useProgram(this.shader_loc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo_loc);
    gl.vertexAttribPointer(
      this.a_position_location,
      this.vertex_pos_count,
      gl.FLOAT,
      false,
      this.vbo_stride,
      this.vertex_pos_offset);
    if (this.vertex_norm_count > 0) {
      gl.vertexAttribPointer(
        this.a_normal_location,
        this.vertex_norm_count,
        gl.FLOAT,
        false,
        this.vbo_stride,
        this.vertex_norm_offset);
    }
    if (this.vertex_color_count > 0) {
      gl.vertexAttribPointer(
        this.a_color_location,
        this.vertex_color_count,
        gl.FLOAT,
        false,
        this.vbo_stride,
        this.vertex_color_offset);
    }
    gl.enableVertexAttribArray(this.a_position_location);
    if (this.vertex_norm_count > 0) {
      gl.enableVertexAttribArray(this.a_normal_location);
    }
    if (this.vertex_color_count > 0) {
      gl.enableVertexAttribArray(this.a_color_location);
    }
  }

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

  adjust() {
    glMatrix.mat4.perspective(this.projection_matrix, 30 * aspect, aspect, 1, 100);
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

  draw() {
    if (!this.validate()) {
      console.log('ERROR: Before .draw() you need to call .enable()');
    }
    gl.drawArrays(this.draw_method, 0, this.vertex_count);
  }

  reload() {
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._vbo);
  }
}
