// Code by Caleb Biasco (biasc007)
// for Project 3 of CSCI 4611, Fall 2016

"use strict";


//////////////////// VARIABLES ////////////////////

var canvas;
var gl;
var programId;
var mode = "start";
var programMode;

// Program information
var sweepAngle = 16;
var curveSteps = 16; // must be divisible by 8
var lightDir;
var lightDirection;
var lPhi = 0.0;
var lTheta = 0.0;
var interpolateLight = true;

// Vertex information
var dashedLines;
var dottedLines;
var controlPoints;
var bezierCurve;
var bezierApprox;
var modelVertices;
var normalArray;
var texCoordArray;

var pointSize;
var numDots = 8;
var grabbedPoint;

// Group locations within buffers
var dashLoc;
var dotLoc;
var bezLoc;
var contLoc;
var boolLoc;
var colorLoc;
var modelLoc;
var vertexBufferLength;

// Buffers
var vBuffer;
var nBuffer;
var cBuffer;
var dBuffer;
var tBuffer;
var mBuffer;

// Material variables
var ambient, diffuse, specular;
var shine;

var ambientProduct, diffuseProduct, specularProduct;
var shininess;

var textureEnabled;
var texLocation;
var texCoordLocation;

// Model view variables (taken from Angel Ch. 5)
var near = -10;
var far = 10;
var radius = 1.0;
var theta  = 0.0;
var phi    = 0.0;
var dr = 1.0 * Math.PI/180.0;

var zoom = 1.0;

var mvMatrix, pMatrix;
var modelView, projection;
var eye;
var up;

var at = vec3(0.0, 0.0, 0.0);


//////////////////// BUTTON CALLBACK FUNCTIONS ////////////////////

// Callback for changing between "View Mode" and "Draw Mode"
function selectMode() {
    var elem = document.getElementById("modeButton");
    if (elem.value=="View Mode")
    {
        mode = "view";
        document.getElementById("settingsDiv").style.visibility = "visible";
        document.getElementById("radioDiv").style.visibility = "visible";
        document.getElementById("interpDiv").style.visibility = "visible";
        
		gl.uniform1i(programMode, 1);
        theta = 0.0;
        phi = 0.0;
		lTheta = 0.0;
		lPhi = 0.0;
        zoom = 1.0;
        formModel();
        updateBuffers();
        viewMethod();
        document.getElementById("demo").innerHTML = "View Mode";
        elem.value = "Draw Mode";
    }
    else
    {
        mode = "draw";
        document.getElementById("settingsDiv").style.visibility = "hidden";
        document.getElementById("radioDiv").style.visibility = "hidden";
        document.getElementById("interpDiv").style.visibility = "hidden";
        
		gl.uniform1i(programMode, 0);
        drawMethod();
        document.getElementById("demo").innerHTML = "Draw Mode";
        elem.value = "View Mode";
    }
}

// Callback for changing the sweep of the 3D render
function changeAngleSweep() {
    var elem = document.getElementById("sweepField");
    var num = parseInt(elem.value);
    sweepAngle = num;
        
    formModel();
    updateBuffers();
    viewMethod();
}

// Callback for changing the precision of the bezier curves in the 3D render
function changeSteps() {
    var elem = document.getElementById("stepsField");
    var num = parseInt(elem.value);
    if (num%8 == 0) {
        curveSteps = num;
        
        formModel();
        updateBuffers();
        viewMethod();
    }
    else {
        elem.value = curveSteps;
    }
}

// Callback for quitting.
// Does not work because JavaScript can only close windows that it opened itself.
function quit() {
    window.top.close();
}

function changeInterpolation() {
	normalArray = [];
	
	if (document.getElementById("interpolate").checked) {
		var bezierPoints1 = generateBezierCurve(controlPoints.slice(0, 4), curveSteps);
        var bezierPoints2 = generateBezierCurve(controlPoints.slice(3, 7), curveSteps);
		var bezierNormals = generateBezierNormals(bezierPoints1).concat(generateBezierNormals(bezierPoints2));
        var bezierPoints = bezierPoints1.concat(bezierPoints2);
		
		var prevRotation, curRotation;
		curRotation = rotate(0, 0, 1, 0);
		for (var i = 1; i <= sweepAngle; i++) {
			prevRotation = curRotation;
			curRotation = rotate((360/sweepAngle)*i, 0, 1, 0);
			for (var j = 0; j < bezierPoints.length - 1; j++) {
				// triangle 1 normals
				normalArray.push(mm(prevRotation, bezierNormals[j]));
				normalArray.push(mm(curRotation, bezierNormals[j+1]));
				normalArray.push(mm(curRotation, bezierNormals[j]));
				
				// triangle 2 normals
				normalArray.push(mm(prevRotation, bezierNormals[j]));
				normalArray.push(mm(prevRotation, bezierNormals[j+1]));
				normalArray.push(mm(curRotation, bezierNormals[j+1]));
			}
		}
	}
	else {
		var e1, e2, n;
		
		for (var i = 0; i < modelVertices.length; i += 3) {
			e1 = calcVec(modelVertices[i+1], modelVertices[i]);
			e2 = calcVec(modelVertices[i+2], modelVertices[i]);
			n = vec4(cross(e1, e2), 0);
			
			normalArray.push(n);
			normalArray.push(n);
			normalArray.push(n);
		}
	}
	
	updateNBuffer();
	viewMethod();
}

// Callback for changing material.
function changeMaterial() {
    var value = document.querySelector('input[name="material"]:checked').value;
    if (value == "plastic") {
        gl.uniform1i(textureEnabled, 0);
        ambient = vec4(.2, .2, 0, 1);
        diffuse = vec4(.7, .7, 0, 1);
        specular = vec4(.4, .4, .2, 1);
        shine = .25*128;
    }
    else if (value == "metal") {
        gl.uniform1i(textureEnabled, 0);
        ambient = vec4(.329412, .223529, .027451, 1);
        diffuse = vec4(.780392, .568627, .113725, 1);
        specular = vec4(.992157, .941176, .807843, 1);
        shine = .21794872*128;
    }
    else if (value == "texture") {
        gl.uniform1i(textureEnabled, 1);
        ambient = vec4(0, 0, 0, 1);
        diffuse = vec4(0, 0, 0, 1);
        specular = vec4(.3, .3, .3, 1);
        shine = .1*128;
    }
    else {
        gl.uniform1i(textureEnabled, 0);
        ambient = vec4(.5, 0, 0, 1);
        diffuse = vec4(0, .5, 0, 1);
        specular = vec4(0, 0, .5, 1);
        shine = .50*128;
    }
    
    viewMethod();
}


//////////////////// MODES ////////////////////

// The 3D Mode for Viewing the Surface of Revolution
function viewMethod() {
	gl.enable(gl.DEPTH_TEST);
	
    document.getElementById("demo").innerHTML = "View Mode";
    // Ensure OpenGL viewport is resized to match canvas dimensions
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    
    // Set screen clear color to R, G, B, alpha; where 0.0 is 0% and 1.0 is 100%
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    
    // Enable color; required for clearing the screen
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Clear out the viewport with solid black color
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    
    // Set the model viewing variables
    eye = vec3(radius*Math.sin(-phi)*Math.cos(theta), 
        radius*Math.sin(theta), radius*Math.cos(phi)*Math.cos(theta));
    up = vec3(0, Math.cos(theta), 0);
    mvMatrix = lookAt(eye, at, up);
    pMatrix = ortho(-zoom, zoom, -zoom, zoom, near, far);
	
	// Set the point light
	lightDir = vec3(radius*Math.sin(lPhi)*Math.cos(-lTheta),
		radius*Math.sin(-lTheta), radius*Math.cos(-lPhi)*Math.cos(-lTheta));
    
    // Set the uniforms
    gl.uniformMatrix4fv(modelView, false, flatten(mvMatrix));
    gl.uniformMatrix4fv(projection, false, flatten(pMatrix));
    
	gl.uniform4fv(lightDirection, flatten(vec4(lightDir, 0.0)));
    gl.uniform4fv(ambientProduct, flatten(ambient));
    gl.uniform4fv(diffuseProduct, flatten(diffuse));
    gl.uniform4fv(specularProduct, flatten(specular));
    gl.uniform1f(shininess, shine);
    
    // Draw the axes and triangles
    gl.drawArrays(gl.LINES, dashLoc, dashedLines.length);
    
    for (var i = 0; i < modelVertices.length; i = i+3) {
         gl.drawArrays(gl.TRIANGLES, modelLoc + i, 3);;
    }
}

// The 2D Mode to draw the Bezier Curver
function drawMethod() {
	gl.disable(gl.DEPTH_TEST);
	
    document.getElementById("demo").innerHTML = "Draw Mode";
    // Ensure OpenGL viewport is resized to match canvas dimensions
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    
    // Set screen clear color to R, G, B, alpha; where 0.0 is 0% and 1.0 is 100%
    gl.clearColor(0.5, 1.0, 1.0, 1.0);
    
    // Enable color; required for clearing the screen
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Clear out the viewport with solid black color
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    
    // Draw the lines and points
    gl.drawArrays(gl.LINES, dashLoc, dashedLines.length/3); // Only draw the axis of rotation
    gl.drawArrays(gl.POINTS, dotLoc, dottedLines.length);
    gl.drawArrays(gl.LINE_STRIP, bezLoc, bezierCurve.length);
    gl.drawArrays(gl.POINTS, contLoc, controlPoints.length);
}


//////////////////// INITIALIZATION ////////////////////

window.onload = function() {
    // Find the canvas on the page
    canvas = document.getElementById("gl-canvas");
    
    // Initialize a WebGL context
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { 
        alert("WebGL isn't available"); 
    }
    
    // Load shaders
    programId = initShaders(gl, "vertex-shader", "fragment-shader");
    
    gl.useProgram(programId);
    
    // Initialize vertices
    dashedLines = [
        // vertical line
        vec4(0, -1, 0, 1),
        vec4(0, -.85, 0, 1),
        vec4(0, -.7, 0, 1),
        vec4(0, -.55, 0, 1),
        vec4(0, -.4, 0, 1),
        vec4(0, -.25, 0, 1),
        vec4(0, -.1, 0, 1),
        vec4(0, 0.05, 0, 1),
        vec4(0, .2, 0, 1),
        vec4(0, .35, 0, 1),
        vec4(0, .5, 0, 1),
        vec4(0, .65, 0, 1),
        vec4(0, .8, 0, 1),
        vec4(0, .95, 0, 1),
        
        // horizontal line
        vec4(-1, 0, 0, 1),
        vec4(-.85, 0, 0, 1),
        vec4(-.7, 0, 0, 1),
        vec4(-.55, 0, 0, 1),
        vec4(-.4, 0, 0, 1),
        vec4(-.25, 0, 0, 1),
        vec4(-.1, 0, 0, 1),
        vec4(0.05, 0, 0, 1),
        vec4(.2, 0, 0, 1),
        vec4(.35, 0, 0, 1),
        vec4(.5, 0, 0, 1),
        vec4(.65, 0, 0, 1),
        vec4(.8, 0, 0, 1),
        vec4(.95, 0, 0, 1),
        
        // forward line
        vec4(0, 0, -1, 1),
        vec4(0, 0, -.85, 1),
        vec4(0, 0, -.7, 1),
        vec4(0, 0, -.55, 1),
        vec4(0, 0, -.4, 1),
        vec4(0, 0, -.25, 1),
        vec4(0, 0, -.1, 1),
        vec4(0, 0, 0.05, 1),
        vec4(0, 0, .2, 1),
        vec4(0, 0, .35, 1),
        vec4(0, 0, .5, 1),
        vec4(0, 0, .65, 1),
        vec4(0, 0, .8, 1),
        vec4(0, 0, .95, 1)
    ];
    
    controlPoints = [
        vec4(.5, -.6, 0, 1),
        vec4(.5, -.4, 0, 1),
        vec4(.5, -.2, 0, 1),
        vec4(.5, 0, 0, 1),
        vec4(.5, .2, 0, 1),
        vec4(.5, .4, 0, 1),
        vec4(.5, .6, 0, 1)
    ];
    
    // Initialize the bezier curves
    bezierCurve = generateBezierCurve(controlPoints.slice(0, 4), 50);
    bezierCurve = bezierCurve.concat(generateBezierCurve(controlPoints.slice(3, 7), 50));
    
    // Initialize the dotted lines
    dottedLines = [];
    for (var i = 0; i < controlPoints.length - 1; i++) {
        dottedLines = dottedLines.concat(generateDottedLine(controlPoints[i], controlPoints[i+1]));
    }
    pointSize = 10/Math.min(canvas.width, canvas.height);
    
    // Store the group locations of all vertices
    dashLoc = 0;
    dotLoc = dashedLines.length;
    bezLoc = dotLoc + dottedLines.length;
    contLoc = bezLoc + bezierCurve.length;
    modelLoc = contLoc + controlPoints.length;
    
    // Initialize the model vertices
    formModel();
    vertexBufferLength = modelLoc + modelVertices.length;
    
    // Initialize the vertex buffer
    var aPosition = gl.getAttribLocation(programId, "a_position");
    vBuffer = gl.createBuffer();
    updateVBuffer();
    gl.vertexAttribPointer(aPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aPosition);
    
    // Initialize the normal buffer
    var aNormal = gl.getAttribLocation(programId, "a_normal");
    nBuffer = gl.createBuffer();
    updateNBuffer();
    gl.vertexAttribPointer(aNormal, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aNormal);
    
    // Initialize the color buffer
    var aColor = gl.getAttribLocation(programId, "a_color");
    cBuffer = gl.createBuffer();
    updateCBuffer();
    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aColor);
    
    // Initialize the dotted line buffer
    var aDottedLine = gl.getAttribLocation(programId, "a_dottedLine");
    dBuffer = gl.createBuffer();
    updateDBuffer();
    gl.vertexAttribPointer(aDottedLine, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aDottedLine);
    
    // Initialize the material indication buffer
    var aMaterial = gl.getAttribLocation(programId, "a_hasMaterial");
    mBuffer = gl.createBuffer();
    updateMBuffer();
    gl.vertexAttribPointer(aMaterial, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aMaterial);
    
    // Initialize uniforms
	programMode = gl.getUniformLocation(programId, "mode");
    modelView = gl.getUniformLocation(programId, "modelView");
    projection = gl.getUniformLocation(programId, "projection");
	lightDirection = gl.getUniformLocation(programId, "lightDirection");
    
    ambientProduct = gl.getUniformLocation(programId, "AmbientProduct");
    diffuseProduct = gl.getUniformLocation(programId, "DiffuseProduct");
    specularProduct = gl.getUniformLocation(programId, "SpecularProduct");
    shininess = gl.getUniformLocation(programId, "Shininess");
    
    // Initialize the texture
    texCoordLocation = gl.getAttribLocation(programId, "a_texcoord");
    tBuffer = gl.createBuffer();
    updateTBuffer();
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
    
    // Initialize a placeholder texture while ours loads
    textureEnabled = gl.getUniformLocation(programId, "textureEnabled");
    gl.uniform1i(textureEnabled, 0);
    
    texLocation = gl.getUniformLocation(programId, "u_texture");
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(texLocation, 0);
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    var image = document.getElementById("tile-img");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    
    // Set the material (yellow plastic).
    ambient = vec4(.2, .2, 0, 1);
    diffuse = vec4(.7, .7, 0, 1);
    specular = vec4(.4, .4, .2, 1);
    shine = .25*128;
};


//////////////////// BUFFER FUNCTIONS ////////////////////

// Updates the buffer arrays on the GPU with the correct value
// (important for the 3D viewer)
function updateBuffers() {
    updateVBuffer();
    updateNBuffer();
    updateCBuffer();
    updateDBuffer();
    updateTBuffer();
    updateMBuffer();
}

// Updates only the vertex position attribute buffer
function updateVBuffer() {
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(dashedLines.concat(dottedLines.concat(bezierCurve.concat(controlPoints.concat(modelVertices))))), gl.DYNAMIC_DRAW);
}

// Updates only the normal attribute buffer
function updateNBuffer() {
    var modelNormals = [];
    for (var i = 0; i < modelLoc; i++) {
		modelNormals.push(vec4(1, 1, 1, 1));
    }
    modelNormals = modelNormals.concat(normalArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(modelNormals), gl.DYNAMIC_DRAW);
}

// Updates only the vertex color attribute buffer
function updateCBuffer() {
    var colorArray = [];
    for (var i = 0; i < vertexBufferLength; i++) {
        if (grabbedPoint >= 0 && i == grabbedPoint + contLoc)
            colorArray.push(vec4(1, 1, 0, 1));
        else if (i >= dashLoc && i < dashLoc + dashedLines.length)
            colorArray.push(vec4(1, 0, 0, 1));
        else if (i >= modelLoc && i < modelLoc + modelVertices.length)
            colorArray.push(vec4(1, 1, 1, 1));
        else
            colorArray.push(vec4(0, 0, 0, 1));
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colorArray), gl.DYNAMIC_DRAW);
}

// Updates only the dotted line attribute buffer (for changing point size)
function updateDBuffer() {
    var dottedArray = [];
    for (var i = 0; i < vertexBufferLength; i++) {
        if (i > dotLoc && i < dotLoc + dottedLines.length)
            dottedArray.push(1.0);
        else
            dottedArray.push(0.0);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, dBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(dottedArray), gl.DYNAMIC_DRAW);
}

// Updates only the texture coordinate attribute buffer
function updateTBuffer() {
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoordArray), gl.DYNAMIC_DRAW);
}

// Updates only the "has a material" attribute buffer
function updateMBuffer() {
    var hasMaterialArray = [];
    for (var i = 0; i < vertexBufferLength; i++) {
        if (i < modelLoc)
            hasMaterialArray.push(0.0);
        else
            hasMaterialArray.push(1.0);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, mBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(hasMaterialArray), gl.DYNAMIC_DRAW);
}


//////////////////// MOUSE AND KEYBOARD CALLBACK FUNCTIONS ////////////////////

document.onmousedown = function(downMouseEvent) {
    // If viewing: rotate the vertices about the origin
    if (mode == "view") {
        var x = convertX(downMouseEvent.clientX);
        var y = convertY(downMouseEvent.clientY);
        if (downMouseEvent.button != 0 || x < -1 || x > 1 || y < -1 || y > 1)
            return;
		
		if (!!downMouseEvent.shiftKey) {
			document.onmousemove = function(dragMouseEvent) {
				lPhi += dragMouseEvent.movementX*dr;
				lTheta += dragMouseEvent.movementY*dr;
				
				viewMethod();
			}
		}
		else {
			document.onmousemove = function(dragMouseEvent) {
				phi += dragMouseEvent.movementX*dr;
				theta += dragMouseEvent.movementY*dr;

				viewMethod();
			}
		}
    }
    // If drawing: grab the nearest in-range point and move it
    else if (mode == "draw") {
        if (downMouseEvent.button != 0)
            return;

        var point = grabPoint(downMouseEvent.clientX, downMouseEvent.clientY);
        if (point == -1)
            return;

        grabbedPoint = point;

        updateCBuffer();
        drawMethod();

        document.onmousemove = function(dragMouseEvent) {
            if (dragMouseEvent.button == 0)
                movePoint(dragMouseEvent.clientX, dragMouseEvent.clientY, point);
        };
    }
}

// Resets the mouse movement callback after release
document.onmouseup = function(upMouseEvent) {
    if (mode == "view") {
        if (upMouseEvent.button == 0) {
            document.onmousemove = null;
            
            viewMethod();
        }
    }
    else if (mode == "draw") {
        if (upMouseEvent.button != 0)
            return;
        
        document.onmousemove = null;
        grabbedPoint = -1;

        updateCBuffer();
        drawMethod();
    }
};

document.onkeypress = function(keyboardEvent) {
    if (mode == "view") {
        if (keyboardEvent.key == '.') {
            zoom *= 0.9;

            viewMethod();
        }
        else if (keyboardEvent.key == ',') {
            zoom *= 1.1;

            viewMethod();
        }
    }
};


//////////////////// DRAW MODE FUNCTIONS ////////////////////

// Grab the nearest control point
function grabPoint(mouseX, mouseY) {
    var x = convertX(mouseX);
    var y = convertY(mouseY);
    if (x < -1 || x > 1 || y < -1 || y > 1)
        return -1;
    
    for (var i = 0, len = controlPoints.length; i < len; i++) {
        if (x > controlPoints[i][0] - pointSize &&
            x < controlPoints[i][0] + pointSize &&
            y > controlPoints[i][1] - pointSize &&
            y < controlPoints[i][1] + pointSize)
            return i;
    }
    return -1;
}

// Move the point and regenerate the vertex buffer
function movePoint(mouseX, mouseY, point) {
    var x = convertX(mouseX);
    var y = convertY(mouseY);
    if (x < -1 || x > 1 || y < -1 || y > 1)
        return -1;

    controlPoints[point][0] = x;
    controlPoints[point][1] = y;
    
    dottedLines = [];
    for (var i = 0; i < controlPoints.length - 1; i++) {
        dottedLines = dottedLines.concat(generateDottedLine(controlPoints[i], controlPoints[i+1]));
    }
    bezierCurve = generateBezierCurve(controlPoints.slice(0, 4), 50).concat(generateBezierCurve(controlPoints.slice(3, 7), 50));
	
    updateVBuffer();
    
    drawMethod();
}


//////////////////// VIEW MODE FUNCTIONS ////////////////////

// Rotates the bezier curves about the origin and generates faces at every
// appropriate place.
function formModel() {
    modelVertices = [];
    normalArray = [];
    texCoordArray = [];
    var bezierPoints1 = generateBezierCurve(controlPoints.slice(0, 4), curveSteps)
    var bezierPoints2 = generateBezierCurve(controlPoints.slice(3, 7), curveSteps);
    var bezierNormals = generateBezierNormals(bezierPoints1).concat(generateBezierNormals(bezierPoints2));
    var bezierPoints = bezierPoints1.concat(bezierPoints2);
    var interpolation = document.getElementById("interpolate").checked;
    
    for (var i = 0; i < modelLoc; i++) {
        texCoordArray.push(-1.0);
        texCoordArray.push(-1.0);
    }
    
    var prevRotation, curRotation, e1, e2, n;
    curRotation = rotate(0, 0, 1, 0);
    for (var i = 1; i <= sweepAngle; i++) {
        prevRotation = curRotation;
        curRotation = rotate((360/sweepAngle)*i, 0, 1, 0);
        for (var j = 0; j < bezierPoints.length - 1; j++) {
            // triangle 1
            modelVertices.push(mm(prevRotation, bezierPoints[j]));
            modelVertices.push(mm(curRotation, bezierPoints[j+1]));
            modelVertices.push(mm(curRotation, bezierPoints[j]));
            
            // triangle 2
            modelVertices.push(mm(prevRotation, bezierPoints[j]));
            modelVertices.push(mm(prevRotation, bezierPoints[j+1]));
            modelVertices.push(mm(curRotation, bezierPoints[j+1]));
            
            // triangle 1 texture coordinates
            texCoordArray.push(1 - ((i-1)/sweepAngle));
            texCoordArray.push(1 - (j/bezierPoints.length-1));
            texCoordArray.push(1 - (i/sweepAngle));
            texCoordArray.push(1 - ((j+1)/bezierPoints.length-1));
            texCoordArray.push(1 - (i/sweepAngle));
            texCoordArray.push(1 - (j/bezierPoints.length-1));
            
            // triangle 2 texture coordinates
            texCoordArray.push(1 - ((i-1)/sweepAngle));
            texCoordArray.push(1 - (j/bezierPoints.length-1));
            texCoordArray.push(1 - ((i-1)/sweepAngle));
            texCoordArray.push(1 - ((j+1)/bezierPoints.length-1));
            texCoordArray.push(1 - (i/sweepAngle));
            texCoordArray.push(1 - ((j+1)/bezierPoints.length-1));
            
			if (interpolation) {
				// triangle 1 normals
				normalArray.push(mm(prevRotation, bezierNormals[j]));
				normalArray.push(mm(curRotation, bezierNormals[j+1]));
				normalArray.push(mm(curRotation, bezierNormals[j]));
				
				// triangle 2 normals
				normalArray.push(mm(prevRotation, bezierNormals[j]));
				normalArray.push(mm(prevRotation, bezierNormals[j+1]));
				normalArray.push(mm(curRotation, bezierNormals[j+1]));
			}
			else {
				// triangle 1 normals
				e1 = calcVec(modelVertices[modelVertices.length - 5],
							modelVertices[modelVertices.length - 6]);
				e2 = calcVec(modelVertices[modelVertices.length - 4],
							modelVertices[modelVertices.length - 6]);
				n = vec4(cross(e1, e2), 0);
				normalArray.push(n);
				normalArray.push(n);
				normalArray.push(n);
				
				// triangle 2 normals
				e1 = calcVec(modelVertices[modelVertices.length - 2],
							modelVertices[modelVertices.length - 3]);
				e2 = calcVec(modelVertices[modelVertices.length - 1],
							modelVertices[modelVertices.length - 3]);
				n = vec4(cross(e1, e2), 0);
				normalArray.push(n);
				normalArray.push(n);
				normalArray.push(n);
			}
        }
    }
    vertexBufferLength = modelLoc + modelVertices.length;
}


//////////////////// BEZIER FUNCTIONS ////////////////////

// Approximates points on a bezier curve given control points and a step value
function generateBezierCurve(points, steps) {
    if (points.length == 0 || steps == 0)
        return [];
    var bezierPoints = [scale(1, points[0])];
    for (var i = 1; i <= steps; i++) {
        bezierPoints.push(deCasteljau(i/steps, points));
    }
    return bezierPoints;
}

// Converges on the point u along the bezier curve given by the control points
function deCasteljau(u, points) {
    var approxArray = [points];
    for (var j = 1; j < points.length; j++) {
        approxArray.push([]);
        for (var i = 0; i < points.length - j; i++) {
            approxArray[j][i] = add(scale((1-u), approxArray[j-1][i]), scale(u, approxArray[j-1][i+1]));
        }
    }
    return approxArray[points.length - 1][0];
}

// Generates the normals of the whole bezier curve
function generateBezierNormals(points) {
    if (points.length <= 1)
        return [];
    var bezierNormals = [];
    
    bezierNormals.push(vec4(normalize(cross(calcVec(points[1], points[0]), vec3(0, 0, 1))), 0));
    for (var i = 1; i < points.length - 1; i++) {
        var a = calcVec(points[i], points[i-1]);
        var b = calcVec(points[i+1], points[i]);
        var n = mix(a, b, 0.5);
        bezierNormals.push(vec4(normalize(cross(n, vec3(0, 0, 1))), 0));
    }
    bezierNormals.push(vec4(normalize(cross(calcVec(points[points.length-1], points[points.length-2]), vec3(0, 0, 1))), 0));
    
    return bezierNormals;
}

//////////////////// HELPER FUNCTIONS ////////////////////

// Creates a set number of points between a source and a destination
function generateDottedLine(src, dst) {
    var dotArray = [];
    var step = -1;
    
    step = subtract(dst, src);
    step = scale(1/numDots, step);
    for (var i = 0; i < numDots; i++) {
        dotArray.push(add(scale(i, step), src));
    }
    
    return dotArray;
}

// Helper functions for getting the correct mouse coordinates
function convertX(mouseX) {
    return (mouseX - canvas.offsetLeft)*2/canvas.width - 1;
}
function convertY(mouseY) {
    return -((mouseY - canvas.offsetTop)*2/canvas.height - 1);
}

// Subtracts one point off of another to get a vector without changing the homogeneous coordinate
function calcVec(dst, src) {
    if (dst.length != src.length) {
        throw "calcVec(): trying to subtract mismatched vectors";
    }
    
    var vec = [];
    
    for (var i = 0; i < dst.length - 1; i++) {
        vec.push(dst[i] - src[i]);
    }
    
    vec.push(1);
    return vec;
}

// Matrix multiplication function (the MV matrix multiplication function only
// works on matrices of the exact same dimensions)
function mm(u, v) {
    var result = [];
    
    if (u.matrix && v.matrix) {
        for (var i = 0; i < u.length; i++) {
            if (u[i].length != v.length) {
                throw "matMult(): trying to multiply mismatched matrices";
            }
        }
        
        for (var i = 0; i < v.length; i++) {
            if (u.length != v[i].length) {
                throw "matMult(): trying to multiply mismatched matrices";
            }
        }
        
        for (var i = 0; i < v.length; i++) {
            result.push([]);
            
            for (var j = 0; j < u.length; j++) {
                var sum = 0.0;
                for (var k = 0; k < v[i].length; k++) {
                    sum += u[k][j] * v[i][k];
                }
                result[i].push(sum);
            }
        }
        
        result.matrix = true;
    }
    else if (u.matrix) {
        for (var i = 0; i < u.length; i++) {
            if (u[i].length != v.length) {
                throw "matMult(): trying to multiply mismatched matrices";
            }
        }
        
        for (var i = 0; i < v.length; i++) {
            var sum = 0.0;
            for (var j = 0; j < u.length; j++) {
                sum += u[j][i] * v[j];
            }
            result.push(sum);
        }
    }
    else if (v.matrix) {
        for (var i = 0; i < v.length; i++) {
            if (u.length != v[i].length) {
                throw "matMult(): trying to multiply mismatched matrices";
            }
        }
        
        for (var i = 0; i < u.length; i++) {
            var sum = 0.0;
            for (var j = 0; j < v.length; j++) {
                sum += u[i] * v[i][j];
            }
            result.push(sum);
        }
    }
    else {
        if (u.length != v.length) {
            throw "matMult(): vectors are not the same dimension";
        }
        
        for (var i = 0; i < u.length; i++) {
            result.push(u[i]*v[i]);
        }
    }
    
    return result;
}