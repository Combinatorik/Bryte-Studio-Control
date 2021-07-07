/**
* The Abstract Animation Engine class defines an interface for a unified animation engine independent of a specific implementation.
*/
class AbstractAnimationEngine
{
	time=200;
	
	/**
	* Static method.  Returns an instance of the current developer-recommended animation engine.  Decouples the rest of the code from specific animation engine implementations which allows easy updating across the entire system.
	*/
	static getSuggestedEngine()
	{
		return new jQueryAnimationEngine();
	}
	
	constructor()
	{
		if (this.constructor === AbstractAnimationEngine)
			throw "Cannot instantiate abstract object";
	}
	
	/**
	* Translates an object.
	* @param{Object} is the DOM element to be translated.
	* @param{number} is either the x distance or the final x position of the object, depending on its configuration.
	* @param{number} is either the y distance or the final y position of the object, depending on its configuration.
	*/
	translate(object, xfinal=0, yfinal=0)
	{
		throw "Cannot call abstract method";
	}
	
	/**
	* Rotates an object.
	* @param{Object} is the DOM element to be rotated.
	* @param{number} is either the change in angle or the final angle of the object, depending on its configuration.
	* @param{number} is the x coordinate of the center of rotation.
	* @param{number} is the y coordinate of the center of rotation.
	*/
	rotate(object, dtheta=0, cx=0, cy=0)
	{
		throw "Cannot call abstract method";
	}
	
	/**
	* Scales an object.
	* @param{Object} is the DOM element to be scaled.
	* @param{number} is the amount by which the x direction will be scaled.  1 is the same size, 0 makes it vanish.
	* @param{number} is the amount by which the y direction will be scaled.  1 is the same size, 0 makes it vanish.
	*/
	scale(object, x=1, y=1)
	{
		throw "Cannot call abstract method";
	}
	
	/**
	* Resizes an object to a specific number of pixels.
	* @param{Object} is the DOM element to be rezied.
	* @param{number} is the number of pixels the x direction occupies.  A value of -1 tells the method to not resize.
	* @param{number} is the number of pixels the y direction occupies.  A value of -1 tells the method to not resize.
	*/
	resize(object, x=-1, y=-1) 
	{
		throw "Cannot call abstract method";
	}

	/**
	* Resizes an SVG object's viewbox.
	* @param{Object} is the DOM element to be rezied.
	*/
	resizeViewbox(object, svg, symbol, marker, pattern)
	{
		throw "Cannot call abstract method";
	}
	
	/**
	* Fades an object in or out.
	* @param{Object} is the DOM element to be faded.
	* @param{number} specifies the animation to be applied.  1 fades the object in, 0 out.
	*/
	fade(object, state)
	{
		throw "Cannot call abstract method";
	}
	
	/**
	* Returns the animation execution time in ms.
	*/
	get executionTime()
	{
		return this.time;
	}
	
	/**
	* Updates the execution time of the animations.
	* @param{number} the animation length in ms.  Must be a positive number.
	*/
	set executionTime(timeInMS)
	{
		if (!('number' == typeof timeInMS))
		{
			timeInMS = parseFloat(timeInMS);
			if (isNaN(timeInMS) || timeInMS == null)
				throw "Time parameter must be a number or a string of a number";
		}
		
		if (timeInMS <= 0)
			throw "Transition time must be a positive number";
		
		this.time=timeInMS;
	}
};

/**
* The jQuery Animation Engine class uses jQuery and jQuery SVG to implement animations.  See Abstract Animation Engine for method details.
*/
class jQueryAnimationEngine extends AbstractAnimationEngine
{
	operations;
	obj;
	svgElement=0;
	fadeFlag=0;
	
	constructor()
	{
		super();
	}
	
	translate(object, xfinal=0, yfinal=0, time=this.executionTime)
	{
		//Verify parameters	
		if (!object)
			throw "No object to animate passed in";
				
		if (!('number' == typeof xfinal))
		{
			xfinal = parseFloat(xfinal);
			if (isNaN(xfinal) || xfinal == null)
				throw "Horizontal translation parameter must be a number or a string of a number";
		}
		
		if (!('number' == typeof yfinal))
		{
			yfinal = parseFloat(yfinal);
			if (isNaN(yfinal) || yfinal == null)
				throw "Vertical translation parameter must be a number or a string of a number";
		}

		//Translate uses the GPU to produce smooth results
		this.operations = {};	
		this.svgElement=object instanceof SVGElement;
		this.updateTransform('translate', [xfinal, yfinal]);
		$(object).animate(this.operations, time);
	}
	
	rotate(object, finalDelta=0, cx=0, cy=0)
	{
		//Verify parameters
		if (!object)
			throw "No object to animate passed in";
		
		if (!('number' == typeof finalDelta))
		{
			finalDelta = parseFloat(finalDelta);
			if (isNaN(finalDelta) || finalDelta == null)
				throw "Final angle parameter must be a number or a string of a number";
		}
		
		if (!('number' == typeof cx))
		{
			cx = parseFloat(cx);
			if (isNaN(cx) || cx == null)
				throw "Center of rotation x parameter must be a number or a string of a number";
		}
		
		if (!('number' == typeof cy))
		{
			ccyx = parseFloat(cy);
			if (isNaN(cy) || cy == null)
				throw "Center of rotation y parameter must be a number or a string of a number";
		}
		
		//Rotate uses the GPU to produce smooth results	
		this.operations = {};	
		this.svgElement=object instanceof SVGElement;
		this.updateTransform('rotate', [finalDelta, cx, cy]);
		$(object).animate(this.operations, this.executionTime);
	}
	
	scale(object, x=1, y=1) 
	{
		//Verify parameters
		if (!object)
			throw "No object to animate passed in";
		
		if (!('number' == typeof x))
		{
			x = parseFloat(x);
			if (isNaN(x) || x == null)
				throw "X scale parameter must be a number or a string of a number";
		}
		
		if (!('number' == typeof y))
		{
			ccyx = parseFloat(y);
			if (isNaN(y) || y == null)
				throw "Y scale parameter must be a number or a string of a number";
		}
		
		//Rotate uses the GPU to produce smooth results
		this.operations = {};
		this.svgElement=object instanceof SVGElement;
		this.updateTransform('scale', [finalDelta, x, y]);
		$(object).animate(this.operations, this.executionTime);
	}
	
	resizeViewbox(object, svg, symbol, marker, pattern, time=this.executionTime)
	{
		//Check to see if we're dealing with an SVG
		if (!object)
			throw "No object to animate passed in";
		
		if (object instanceof SVGElement)
		{
			//Verify parameters
			if (!('number' == typeof svg))
			{
				svg = parseFloat(svg);
				if (isNaN(svg) || svg == null)
					throw "svg parameter must be a number or a string of a number";
			}
			
			if (!('number' == typeof symbol))
			{
				symbol = parseFloat(symbol);
				if (isNaN(symbol) || symbol == null)
					throw "symbol parameter must be a number or a string of a number";
			}
			
			//Rotate uses the GPU to produce smooth results
			var ops = {};
			ops.svgViewBox = "" + svg.toString() + ", " + symbol.toString() + ", " + marker.toString() + ", " + pattern.toString();
			$(object).animate(ops, time);
		}
	}
	
	resize(object, x=-1, y=-1) 
	{
		//Verify parameters
		if (!object)
			throw "No object to animate passed in";
		
		if (!object)
			throw "No object to animate passed in";
		
		if (!('number' == typeof x))
		{
			x = parseFloat(x);
			if (isNaN(x) || x == null)
				throw "X scale parameter must be a number or a string of a number";
		}
		
		if (!('number' == typeof y))
		{
			ccyx = parseFloat(y);
			if (isNaN(y) || y == null)
				throw "Y scale parameter must be a number or a string of a number";
		}
		
		//Rotate uses the GPU to produce smooth results
		var ops = {};
		var isSVG = object instanceof SVGElement;
		var animate=0;
		if (x > -1)
		{
			animate=1;
			if (isSVG)
				ops.svgWidth = x.toString() + "px";
			else
				ops.width = x.toString() + "px";
		}
	
		if (y > -1)
		{
			animate=1;
			if (isSVG)
				ops.svgHeight = y.toString() + "px";
			else
				ops.height = y.toString() + "px";
		}
		
		if (animate)
			$(object).animate(ops, this.executionTime);
	}
	
	fade(object, state, time=this.executionTime)
	{
		//Apply animation
		if (!object)
			throw "No object to animate passed in";
		
		if (state)
			$(object).fadeIn(time);
		else
			$(object).fadeOut(time);
	}
	
	/* Private Methods */
	stripCommand(str, command)
	{
		//Find the position of translate and insert updated command
		var pos = str.indexOf(command);
		if(pos != -1)
		{
			var endPos = str.indexOf(')', pos);
			str = str.substring(0, pos) + str.substring(endPos+1);
		}
		
		return str;
	}
	
	buildCommand(command, paramsArray)
	{
		var str = command + "(";
		
		for (var x=0; x<paramsArray.length-1; x++)
			str += paramsArray[x].toString() + ",";
		
		str += paramsArray[paramsArray.length-1] + ")";
		
		return str;
	}
	
	updateTransform(command, paramsArray) 
	{
		var str;

		if (this.svgElement)
		{
			if (!this.operations.svgTransform)
				this.operations.svgTransform = "";
			str = this.operations.svgTransform;
		}
		else
		{
			if (!this.operations.transform)
				this.operations.transform = "";
			str = this.operations.transform;
		}
		
		//Find the position of translate and insert updated command
		str = this.stripCommand(str, command);
		str += this.buildCommand(command, paramsArray);
		
		if (this.svgElement)
			this.operations.svgTransform = str;
		else
			this.operations.transform = str;
	}
};


class SyncronizedAnimation extends AbstractAnimationEngine
{
	constructor()
	{
		if (this.constructor === SyncronizedAnimation)
			throw "Cannot instantiate abstract object";
		
		super();
	}

	static getSuggestedEngine()
	{
		return new jQuerySyncronizedAnimation();
	}
	
	animate()
	{
		throw "Cannot call abstract method";
	}
	
	clearAnimations()
	{
		throw "Cannot call abstract method";
	}
	
	enqueueObjects(objList) 
	{
		throw "Cannot call abstract method";
	}
	
	clearQueuedObjects() 
	{
		throw "Cannot call abstract method";
	}
};

class jQuerySyncronizedAnimation extends SyncronizedAnimation
{
	operations;
	obj;
	svgElement=0;
	fadeFlag=0;
	
	constructor()
	{
		super();
		this.clearAnimations();
		
		// this.obj = $(obj);
		// if (this.obj.length == 0)
			// throw "Unable to find object in DOM";
		
		// if (obj instanceof SVGElement)
			// this.svgElement=1;
	}
	
	translate(final=0, yfinal=0)
	{
		//Verify parameters		
		if (!('number' == typeof xfinal))
		{
			xfinal = parseFloat(xfinal);
			if (isNaN(xfinal) || xfinal == null)
				throw "Horizontal translation parameter must be a number or a string of a number";
		}
		
		if (!('number' == typeof yfinal))
		{
			yfinal = parseFloat(yfinal);
			if (isNaN(yfinal) || yfinal == null)
				throw "Vertical translation parameter must be a number or a string of a number";
		}

		//Translate uses the GPU to produce smooth results
		this.updateTransform('translate', [xfinal, yfinal]);
	}
	
	stripCommand(str, command)
	{
		//Find the position of translate and insert updated command
		var pos = str.indexOf(command);
		if(pos != -1)
		{
			var endPos = str.indexOf(')', pos);
			str = str.substring(0, pos) + str.substring(endPos+1);
		}
		
		return str;
	}
	
	buildCommand(command, paramsArray)
	{
		var str = command + "(";
		
		for (var x=0; x<paramsArray.length-1; x++)
			str += paramsArray[x].toString() + ",";
		
		str += paramsArray[paramsArra.length-1] + ")";
		
		return str;
	}
	
	updateTransform(command, paramsArray) 
	{
		var str;

		if (this.svgElement)
		{
			if (!this.operations.svgTransform)
				this.operations.svgTransform = "";
			str = this.operations.svgTransform;
		}
		else
		{
			if (!this.operations.transform)
				this.operations.transform = "";
			str = this.operations.transform;
		}
		
		//Find the position of translate and insert updated command
		str = this.stripCommand(str, command);
		str += this.buildCommand(command, paramsArray);
		
		if (this.svgElement)
			this.operations.svgTransform = str;
		else
			this.operations.transform = str;
	}
	
	rotate(finalDelta=0, cx=0, cy=0)
	{
		//Verify parameters
		if (!('number' == typeof finalDelta))
		{
			finalDelta = parseFloat(finalDelta);
			if (isNaN(finalDelta) || finalDelta == null)
				throw "Final angle parameter must be a number or a string of a number";
		}
		
		if (!('number' == typeof cx))
		{
			cx = parseFloat(cx);
			if (isNaN(cx) || cx == null)
				throw "Center of rotation x parameter must be a number or a string of a number";
		}
		
		if (!('number' == typeof cy))
		{
			ccyx = parseFloat(cy);
			if (isNaN(cy) || cy == null)
				throw "Center of rotation y parameter must be a number or a string of a number";
		}
		
		//Rotate uses the GPU to produce smooth results		
		this.updateTransform('rorate', [finalDelta, cx, cy]);
	}
	
	scale(x=1, y=1) 
	{
		//Verify parameters
		if (!('number' == typeof x))
		{
			x = parseFloat(x);
			if (isNaN(x) || x == null)
				throw "X scale parameter must be a number or a string of a number";
		}
		
		if (!('number' == typeof y))
		{
			ccyx = parseFloat(y);
			if (isNaN(y) || y == null)
				throw "Y scale parameter must be a number or a string of a number";
		}
		
		//Rotate uses the GPU to produce smooth results
		this.updateTransform('scale', [finalDelta, x, y]);
	}
	
	resizeViewbox(svg, symbol, marker, pattern)
	{
		//Check to see if we're dealing with an SVG
		if (this.svgElement)
		{
			//Verify parameters
			if (!('number' == typeof svg))
			{
				svg = parseFloat(svg);
				if (isNaN(svg) || svg == null)
					throw "svg parameter must be a number or a string of a number";
			}
			
			if (!('number' == typeof symbol))
			{
				symbol = parseFloat(symbol);
				if (isNaN(symbol) || symbol == null)
					throw "symbol parameter must be a number or a string of a number";
			}
			
			//Rotate uses the GPU to produce smooth results
			this.operations.svgViewBox = "" + svg.toString() + ", " + symbol.toString() + ", " + marker.toString() + ", " + pattern.toString();
		}
	}
	
	resize(x=-1, y=-1) 
	{
		//Verify parameters
		if (!('number' == typeof x))
		{
			x = parseFloat(x);
			if (isNaN(x) || x == null)
				throw "X scale parameter must be a number or a string of a number";
		}
		
		if (!('number' == typeof y))
		{
			ccyx = parseFloat(y);
			if (isNaN(y) || y == null)
				throw "Y scale parameter must be a number or a string of a number";
		}
		
		//Rotate uses the GPU to produce smooth results
		if (x > -1)
		{
			if (this.svgElement)
				this.operations.svgWidth = x.toString() + "px";
			else
				this.operations.width = x.toString() + "px";
		}
	
		if (y > -1)
		{
			if (this.svgElement)
				this.operations.svgHeight = y.toString() + "px";
			else
				this.operations.height = Y.toString() + "px";
		}
	}
	
	fade(state)
	{
		//Apply animation
		if (state)
			this.fadeFlag=1;//$(object).fadeIn(this.executionTime);
		else
			this.fadeFlag=0;//$(object).fadeOut(this.executionTime);
	}
	
	animate()
	{
		// if (this.fadeFlag)
		this.obj.animate(this.operations, this.executionTime);//.fadeIn(this.executionTime);
	}
	
	clearAnimations()
	{
		this.operations={};;
	}
	
	enqueueObjects(objList) 
	{
		throw "Cannot call abstract method";
	}
	
	clearQueuedObjects() 
	{
		this.obj = null;
	}
};