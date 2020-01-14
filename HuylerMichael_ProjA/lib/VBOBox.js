/**
 * Abstracted container for WebGL.
 *
 * @author Michael Huyler
 */

class VBOBox {
  constructor(VERTEX_SHADER, FRAGMENT_SHADER, vbo, attribute_count,
    pos_count, norm_count, color_count, box_num) {
    /* GLSL shader code */
    this.VERTEX_SHADER = VERTEX_SHADER;
    this.FRAGMENT_SHADER = FRAGMENT_SHADER;

    /* VBO contents */
    this.vbo = vbo;

    /* VBO metadata */
    // Number of vertices in the VBO
    this.vertex_count = this.vbo.length / attribute_count;
    // Number of bytes each float requires
    this.FSIZE = this.vbo.BYTES_PER_ELEMENT;
    // Total size of the VBO in bytes
    this.vbo_size = this.vbo.length * this.FSIZE;
    // Size of a single vertex in bytes
    this.vbo_stride = this.vbo_size / this.vertex_count;

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
    this.model_matrix = glMatrix.mat4.create();
    this.u_model_matrix_loc;

    /* VBOBox index */
    this.box_num = box_num;
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
      return -1;
    }

    if (this.vertex_norm_count > 0) {
      this.a_normal_location =
        gl.getAttribLocation(this.shader_loc, 'a_normal_' + this.box_num);
      if (this.a_normal_location < 0) {
        console.log(this.constructor.name +
          '.init() failed to get the GPU location of a_normal_' + this.box_num + ' attribute');
        return -1;
      }
    }

    if (this.vertex_color_count > 0) {
      this.a_color_location =
        gl.getAttribLocation(this.shader_loc, 'a_color_' + this.box_num);
      if (this.a_color_location < 0) {
        console.log(this.constructor.name +
          '.init() failed to get the GPU location of a_color_' + this.box_num + ' attribute');
        return -1;
      }
    }

    this.u_model_matrix_loc =
      gl.getUniformLocation(this.shader_loc, 'u_model_matrix_' + this.box_num);
    if (!this.u_model_matrix_loc) {
      console.log(this.constructor.name +
        '.init() failed to get GPU location for u_model_matrix_' + this.box_num + ' uniform');
      return;
    }
  }

  enable() {
    gl.useProgram(this.shader_loc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo_loc);
    gl.vertexAttribPointer(
      this.a_pos_loc,
      this.vertex_pos_count,
      gl.FLOAT,
      false,
      this.vbo_stride,
      this.vertex_pos_offset);
    gl.enableVertexAttribArray(this.a_pos_loc);
    if (this.vertex_norm_count > 0) {
      gl.vertexAttribPointer(
        this.a_norm_loc,
        this.vertex_norm_count,
        gl.FLOAT,
        false,
        this.vbo_stride,
        this.vertex_norm_offset);
      gl.enableVertexAttribArray(this.a_norm_loc);
    }
    if (this.vertex_color_count > 0) {
      gl.vertexAttribPointer(
        this.a_color_loc,
        this.vertex_color_count,
        gl.FLOAT,
        false,
        this.vbo_stride,
        this.vertex_color_offset);
      gl.enableVertexAttribArray(this.a_color_loc);
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
    // TODO: Call a passed in adjust function?
  }

  draw() {
    if (!this.validate()) {
      console.log('ERROR: Before .draw() you need to call .enable()');
    }
    gl.uniformMatrix4fv(this.u_model_matrix_loc, false, this.model_matrix);
    gl.drawArrays(gl.LINES, 0, this.vertex_count);
  }

  reload() {
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vbo);
  }
}
