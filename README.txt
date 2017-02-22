## Code by Caleb Biasco (biasc007)
## for CSCI 4611, Fall 2016

!!! NOTE !!!
My solution uses the WebGL variable gl_FrontFacing. This works in the most recent version of Chrome, but not in Firefox. I decided to still use the variable considering the only other viable option (using dot(eye_position, point_normal) < 0.0) causes nasty artifacts on the edges of the object.
If opened in Firefox, the lighting will not be accurate for both faces of the object, but the rest of the program will still run.
------------

To run, simply open program3.html in a supported browser (current version of Chrome is known to work; Firefox has one issue, detailed above).

In Draw Mode, you can use the left mouse button to select and drag the control points and change the bezier curve.

In View Mode, you can use the left mouse button to click and drag the screen to rotate the object in the XZ plane and the YZ plane. You can also zoom closer to the object with the '<' (or ',') key and further with '>' (or '.'). The number of angles made in the rotation of the curve and the steps taken to approximate the curve can both be modified below the canvas.
If you press Shift then hold the left mouse button down, you can change the direction of the light in the scene.
There are three materials to choose from for the rendered object: yellow plastic, brass metal, and tiled. Selecting them changes how the light interacts with the object and what colors are rendered.
There is also an option for interpolating normals, if you wish to disable it.

The Quit button still does not work, since neither JavaScript nor browsers have changed since the last assignment.