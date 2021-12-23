'use strict';	

/**
* The OptionsBar object is a high-level object that initializes the options bar at the top of the page, registers continuous metronome and snap button button updates from Reaper, and begins listening to ReaperComms for updates, updating the bar whenever it recieves the appropriate update string. 
*/
class OptionsBar
{
	//Internal variables
	optionsBarOpen=0;
	
	undoButton;
	redoButton;
	metroButton;
	snapButton;
	tapTempo;
	clearClipButton;
	comms;
	optionsMenu;
	animations;
	
	resizeObject;
	
	static instance;
	
	/**
	* @param {number} refreshRate is the update rate OptionsBar will request Reaper update the metronome and snap state in milliseonds.
	*/
	constructor(refreshRate=100)
	{
		if (!OptionsBar.instance)
		{
			OptionsBar.instance = this;
			
			//Build components
			//this.optionsMenu = new OptionsWindow();
			this.animations = AbstractAnimationEngine.getSuggestedEngine();
			this.comms = new ReaperComms(refreshRate);
			var tap = document.getElementById("tapButton");
			this.tapTempo = new TapTempo(tap);
			
			//Metronome toggle button
			var metButton = document.getElementById("buttonMetro");
			var offState = metButton.getElementsByClassName("gloss")[0];
			var onState = metButton.getElementsByClassName("active")[0];
			metButton.onclick = () => {this.comms.toggleMetronome();};
			this.metroButton = new ToggleButton(onState, offState);
			
			//Snap toggle button
			var snapButton = document.getElementById("buttonSnap");
			var offState = snapButton.getElementsByClassName("gloss")[0];
			var onState = snapButton.getElementsByClassName("active")[0];
			snapButton.onclick = () => {this.comms.toggleSnap();};
			this.snapButton = new ToggleButton(onState, offState);
			
			//Misc components
			document.getElementById("clipClearButton").onclick = () => {this.comms.wwr_req(40527);};
			document.getElementById("redoButton").onclick = () => {this.comms.redo();};
			document.getElementById("undoButton").onclick = () => {this.comms.undo();};
		
			//Setup events
			var bar = document.getElementById("optionsBar");
			document.getElementById("options").onclick = () => {this.toggleOptionsBar();};
			this.resizeObject = new ResizeOptionsBarEventHandler(this);
			
			//Setup reaper comms
			this.comms.wwr_req_recur("GET/40364;GET/1157", refreshRate);
			this.comms.registerListener((toks) => {this.updateOptionsBar(toks);});
		}
		
		return OptionsBar.instance;
	}
	
	/**
	* Hides/shows options bar on the top of the screen.
	*/
	toggleOptionsBar()
	{
		this.optionsBarOpen = !this.optionsBarOpen;
		this.resizeObject.handleEvent(0);
	};
	
	get isOpen()
	{
		return this.optionsBarOpen;
	}
	
	updateOptionsBar(toks) 
	{
		var cmd;
		for (var x=0; x < toks.length; x++)
		{
			cmd = toks.cmd(x);
			//Update the metronome button.
			if (cmd[1] == 40364)
				this.metroButton.setState(parseInt(cmd[2]));
			//Update snap button.
			else if (cmd[1] == 1157) 
				this.snapButton.setState(parseInt(cmd[2]));
		}
	}
}

/**
* Handles resizing the options bar whenever the window is resized.
*/
class ResizeOptionsBarEventHandler
{
	options;
	transportR2;
	scaleFactor=1;
	barDiv;
	animations;
	lastState=-1;
	
	/**
	* @param {OptionsBar} optionsBar is a reference to the OptionsBar object.
	*/
	constructor(optionsBar)
	{
		if (!(optionsBar instanceof OptionsBar))
			throw "parameter must be an OptionsBar object";
		
		this.transportR2 = document.getElementById("transport_r2");
		
		if(!this.transportR2)
			throw "could not find transport_r2 DOM object";
		
		this.barDiv = document.getElementById("optionsBar");
		this.options = optionsBar;
		window.addEventListener('resize', this, false); 
		
		this.animations = AbstractAnimationEngine.getSuggestedEngine();
	
		//Calculate window scale
		this.handleEvent(0);
		this.animations.executionTime = 200;
	}
	
	/**
	* Returns the current scale factor of the options bar.
	*/
	get scaleFactor()
	{
		return this.scaleFactor;
	}
	
	handleEvent(e)
	{
		var drawnWidth = this.transportR2.clientWidth;
		this.scaleFactor = drawnWidth/303.6;
		var size;
		
		if(this.options.isOpen==1)
			size = this.scaleFactor*104;//50;
		else
			size = 0;
		
		this.animations.resize(this.barDiv, -1, size);
	}
}

/**
* Allows the user to tap in a BPM and sends it to Reaper.
*/
class TapTempo
{
	timer=0;
	sum=0;
	clicks=0;
	lastClickTime=0;
	
	comms;
	timekeeper;
	
	/**
	* @param {SVGObject} is an SVG element to attach the tap functionality to.
	*/ 
	constructor(tapButton) 
	{
		if (!(tapButton instanceof SVGElement))
			throw "Tap Button must be an SVG element";
		
		//Attach tap function to tap button
		tapButton.onclick = (event) => {this.tap(event);};
		
		//Get external objects
		this.comms = new ReaperComms();
		this.timekeeper = new Timekeeper();
	}
	
	/**
	* Called whenever the tap button is pushed.  Calculates BPM and sets a timer to reset tap tempo functionality.
	*/
	tap(event)
	{	
		//Increment clicks counter
		this.clicks++;
		
		//Calculate BPM if we have more than one click.
		if (this.clicks > 1)
		{
			var elapsed = (event.timeStamp - this.lastClickTime) / 1e3;
			
			//Calculate instantaneous bpm
			var bpm = 60 / elapsed;
			
			//Calculate bpm average
			this.sum += bpm;
			bpm = this.sum / (this.clicks-1);
			
			//Send
			this.comms.setTempo(bpm);
			
			//Send time to keep it at the same spot
			this.comms.jumpToPlaybackPos(Timekeeper.convertSecondsToHMSStr(parseFloat(this.timekeeper.posInSeconds)));
		}
		
		//Store tap time
		this.lastClickTime = event.timeStamp;
		
		//Reset timer;
		if (this.timer)
			clearTimeout(this.timer);
		this.timer = setTimeout(() => {this.reset()}, 2000);
	}
	
	reset()
	{
		this.timer=0;
		this.sum=0;
		this.clicks=0;
		this.lastClickTime=0;
	}
}

/**
* This class opens an options window where the mixer can be contacted and IP settings can be entered.
*/
class OptionsWindow
{
	popupMenu;
	enabled=0;
	animations;
	
	constructor()
	{
		var settingsButton = document.getElementById("settingsButton");
		this.popupMenu = document.getElementById("popupMenu");
		
		if (!settingsButton)
			throw "Unable to locate settings button DOM object";
		
		if (!this.popupMenu)
			throw "Unable to find settings popup menu DOM object";
		
		this.animations = AbstractAnimationEngine.getSuggestedEngine();
		settingsButton.onclick = () => {this.toggleSettingsMenu();};
		this.popupMenu.onclick = () => {this.toggleSettingsMenu();};
	}
	
	/**
	* Opens/closes menu.
	*/
	toggleSettingsMenu()
	{
		this.enabled = !this.enabled;
		this.animations.fade(this.popupMenu, this.enabled);
	}
}