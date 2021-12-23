'use strict';	

/**
* This object builds a button that has two states.  It automatically hides and displays SVG elements based on its state.
*/
class ToggleButton
{
	onStateDisplay;
	offStateDisplay;
	enabled = -1;
	
	/**
	* @param {Object} onStateDiv is a reference to the DOM on state of the button.
	* @param {Object} offStateDiv is a reference to the DOM off state of the button.  This parameter is optional.
	* @param {number} enabled is the state the buttn it will be initialized to (on or off).
	*/
	constructor(onStateDiv, offStateDiv, enabled=0)
	{
		if (onStateDiv== null && offStateDiv==null)
			throw "At least one element must not be null";
		
		if ((onStateDiv != null) && (onStateDiv instanceof SVGElement))
			onStateDiv = [onStateDiv];
		
		if ((offStateDiv != null) && (offStateDiv instanceof SVGElement))
			offStateDiv = [offStateDiv];
		
		//Set up internal variables.
		this.offStateDisplay = offStateDiv; 
		this.onStateDisplay = onStateDiv; 
		
		if (enabled)
			this.enable();
		else
			this.disable();
	}
	
	/**
	* Getter function.  Gets whether the button is enabled or disabled.
	*/
	get enabled()
	{
		return this.enabled;
	}
	
	/**
	* Enables the button, if disabled.
	*/
	enable()
	{
		if (!this.enabled)
			this.enable();
	}
	
	/**
	* Disables the button, if enabled.
	*/
	disable()
	{
		if (this.enabled)
			this.disable();
	}
	
	/**
	* Sets the state of the button to the given.
	* @param {number} state of the object 1=on and 0=off.
	*/
	setState(state)
	{
		if (state)
			this.enable();
		else
			this.disable();
	}
	
	/**
	* Toggles the button state.
	*/
	toggleState()
	{
		//Toggle internal variable.
		var enabled = !this.enabled;
		this.setState(enabled); 
	}
	
	/*  Private Methods  */
	enable()
	{
		var x;
		if (this.offStateDisplay)
			for (x=0; x < this.offStateDisplay.length; x++)
				this.offStateDisplay[x].style.visibility = "hidden"; 
		
		if (this.onStateDisplay)
			for (x=0; x < this.onStateDisplay.length; x++)
				this.onStateDisplay[x].style.visibility = "visible"; 
		
		this.enabled = 1;
	}
	
	disable()
	{
		var x;
		if (this.offStateDisplay)
			for (x=0; x < this.offStateDisplay.length; x++)
				this.offStateDisplay[x].style.visibility = "visible"; 
		
		if (this.onStateDisplay)
			for (x=0; x < this.onStateDisplay.length; x++)
				this.onStateDisplay[x].style.visibility = "hidden"; 
		
		this.enabled = 0;
	}
};

class FlashingToggleButton extends ToggleButton
{
	flashing=-1;
	onDivs;
	offDivs;
	timer;
	time;
	
	constructor(onStateDiv, offStateDiv, flashTime=1000, enabled=0)
	{
		if (flashTime <= 0)
			throw "Invalid flash time";
		
		super(onStateDiv, offStateDiv, enabled);
		if ((onStateDiv != null) && !(onStateDiv instanceof Array))
			onStateDiv = [onStateDiv];
		if ((offStateDiv != null) && !(offStateDiv instanceof Array))
			offStateDiv = [offStateDiv];
		
		//Store Divs
		this.onDivs = onStateDiv;
		this.offDivs = offStateDiv;
		
		//Init object to passed in state.
		if (enabled)
		{
			this.flashing=0;
			this.enable();
		}
		else
			this.disable();
	}
	
	enable()
	{
		if (!this.flashing)
		{
			this.flashing = 1;
			super.enable();
			this.timer = setInterval(() => {this.toggleFlash()}, 1000);
		}
	}
	
	disable()
	{
		if (this.flashing)
		{
			this.flashing = 0;
			super.disable();
			if (this.timer)
				clearInterval(this.timer);
			this.timer = 0;
		}
	}
	
	get enabled()
	{
		return this.flashing;
	}
	
	toggleFlash()
	{
		if (super.enabled)
			super.disable();
		else
			super.enable();
	}
};