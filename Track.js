'use strict';
/**
* Abstract Track class.  Lays the foundation for a Track object, and implements finding all the needed DOM elements, updating the track from a tokenized update string from Reaper, and updating the display of the various GUI components.
*/
class AbstractTrack
{
	//Track properties
	stateString = "";
	trackFlagsString = "";
	
	id;
	name;
	recArmed = -1;
	vol = -1;
	volStr = "";
	pan = -1;
	mute = -1;
	solo = -1;
	color = 0;
	hidden = 0;
	isFolder = -1;
	trackClipped;
	recieveCount=0;
	icon;
	
	recArmEnabled = 1;
	
	//Track sends collection.
	sends = null;
	
	//Send listeners.
	observers;
	
	//Track DOM objects
	trackDiv;
	trackRow1Content;
	trackRow2Content;
	trackText;
	recarmOffButton;
	recarmOnButton;
	soloOffButton;
	soloOnButton;
	muteOffButton;
	muteOnButton;
	folderIcon;
	rcvIndicator;
	sendIndicator;
	trackBg;
	clipIndicator;
	meterReadout;
	volThumb;
	slider;
	
	//Event Listeners
	faderEventListener;
	clearClipEventListener;
	trackExpandListener;
	
	//External objects
	comms;
	immutableTrack;
	
	/**
	* @param {Object} trackDiv is a reference to the track DIV DOM object.
	* @param {TrackManager} trackManager is a reference to the track manager object.  Needed for sends.
	*/
	constructor(trackDiv)
	{
		//Make sure people aren't building an abstract class
		if (this.constructor === AbstractTrack)
			throw "Cannot instantiate an abstract class"
		
		//Verify inputs
		if (trackDiv == null)
			throw "Track input invalid";
		
		//Store/init objects.
		this.trackDiv = trackDiv;
		this.comms = new ReaperComms();
		
		this.id = AbstractTrack.extractIDFromDiv(trackDiv);
		
		//Build sends manager
		this.sends = new SendManager(this.id, trackDiv);
		
		//Get DOM objects
		this.trackRow1Content = this.trackDiv.getElementsByClassName("trackRow1")[0];
		this.trackRow2Content = this.trackDiv.getElementsByClassName("trackRow2")[0];
		this.trackText = this.trackRow1Content.getElementsByClassName("trackName")[0];
		this.recarmOffButton = this.trackRow1Content.getElementsByClassName("recarm-off")[0];
		this.recarmOnButton = this.trackRow1Content.getElementsByClassName("recarm-on")[0];
		this.soloOffButton = this.trackRow1Content.getElementsByClassName("solo-off")[0];
		this.soloOnButton = this.trackRow1Content.getElementsByClassName("solo-on")[0];
		this.muteOffButton = this.trackRow1Content.getElementsByClassName("mute-off")[0];
		this.muteOnButton = this.trackRow1Content.getElementsByClassName("mute-on")[0];
		this.folderIcon = this.trackRow1Content.getElementsByClassName("folder_icon")[0];
		this.rcvIndicator = this.trackRow1Content.getElementsByClassName("r_on")[0];
		this.sendIndicator = this.trackRow1Content.getElementsByClassName("s_on")[0];
		this.trackBg = this.trackRow1Content.getElementsByClassName("trackrow1bg")[0];
		this.clipIndicator = this.trackRow1Content.getElementsByClassName("clip_on")[0];
		this.meterReadout = this.trackRow1Content.getElementsByClassName("meterReadout")[0];
		this.volThumb = this.trackRow2Content.getElementsByClassName("fader")[0];
		
		//Set the event handlers associated with the buttons.
		//We want the control to modify the proper channel in Reaper.
		var recarm = this.trackRow1Content.getElementsByClassName("recarm")[0];
		if (recarm)
			recarm.onclick = () => {this.comms.setTrackRecArm(this.id, ReaperComms.onoff.TOGGLE); this.comms.setTrackRecordMonitor(this.id, ReaperComms.onoff.OFF);};
		
		var mute = this.trackRow1Content.getElementsByClassName("mute")[0];
		if (mute)
			mute.onclick = () => {this.comms.setTrackMute(this.id, ReaperComms.onoff.TOGGLE);};
		
		var solo = this.trackRow1Content.getElementsByClassName("solo")[0];
		if (solo)
			solo.onclick = () => {this.comms.setTrackSolo(this.id, ReaperComms.onoff.TOGGLE);};
		var trackDel = this.trackDiv.getElementsByClassName("delTrackBackground")[0];
		
		if (trackDel)
			trackDel.onclick = () => {this.comms.deleteTrack(this.id);};
		
		var trackDelPath = this.trackDiv.getElementsByClassName("delTrackPath")[0];
		if (trackDelPath)
			trackDelPath.onclick = () => {this.comms.deleteTrack(this.id);};
		
		//Build observer server
		this.observers = new Observable();
	
		//Build event handlers.
		this.faderEventListener = new TrackFaderEventHandler(this.trackDiv);
		this.clearClipEventListener = new ClearClipEventHandler(this.trackDiv);	
		this.trackExpandListener = new TrackExpandEventHandler(this, trackDiv);
		
		//Build immutable track object
		this.immutableTrack = new ImmutableTrack(this);
		
		this.disableRecArm();
	}
	
	/**
	* Updates the track state given a tokenized Reaper TRACK command string.
	* @param {CommandCollection} is a tokenized command collection object.
	*/
	updateTrack(tok)
	{
		//Update track controls.
		//Update Track Buttons needs to be first since it checks to see if the track is enabled or disabled.
		var buttonsUpdated = this.updateTrackButtons(tok[3]);
		var nameUpdated = this.updateTrackName(tok[2]);
		this.updateTrackReceives(tok[11]);
		var colorUpdated = this.updateTrackColor(tok[13]);
		this.updateTrackClip(tok[6]);
		this.updateTrackVolume(tok[4]);
		this.updateTrackSends(tok[10], tok[12]);
		
		//Notify listeners that object has changed.
		if (buttonsUpdated || nameUpdated || colorUpdated)
			this.observers.notifyListeners(this.immutableTrack);
	}
	
	/**
	* Enables track and displays it in the GUI.
	*/
	enable()
	{
		if (this.hidden)
		{
			this.hidden = 0;
		}
	}
	
	/**
	* Disables track and hides it in the GUI.
	*/
	disable()
	{
		if (!this.hidden)
		{
			//Raise flag
			this.hidden = 1;
			
			//Reset some fields
			this.recArmed = 0;
			
			//Let the listeners know.
			this.observers.notifyListeners(this.immutableTrack);
		}
	}
	
	show()
	{
		this.trackDiv.style.display = "block";
	}
	
	hide()
	{
		this.trackDiv.style.display = "none";
	}
	
	/**
	* This method enables the rec arm button.
	*/
	enableRecArm()
	{
		this.recArmEnabled = 1;
		this.recarmOffButton.style.display = "block"; 
		this.recarmOnButton.style.display = "block";
	}
	
	/**
	* This method disables the rec arm button.
	*/
	disableRecArm()
	{
		this.recArmEnabled = 0;
		this.recarmOffButton.style.display = "none"; 
		this.recarmOnButton.style.display = "none";
	}
	
	/**
	* This function takes in a function, registers it as a listener, and invokes it whenever this object's internal state is updated.
	* @param {Object} listener is a function that is invoked whenever the track's internal state updates.
	*/
	registerListener(listener)
	{
		this.observers.registerListener(listener);
	}
	
	/**
	* This function unregisters a previously registered function as a listener.
	* @param {Object} listener is a function that needs to be removed as a listener.
	*/
	unregisterListener(listener)
	{
		this.observers.unregisterListner(listener);
	}
	
	/**
	* Updates a track's send state given a tokenized Reaper SEND command string.
	* @param {CommandCollection} is a tokenized command collection.
	*/
	updateSend(tok)
	{
		this.sends.updateSend(tok);
	}
	
	get trackExpandListener()
	{
		return this.trackExpandListener;
	}
	
	/**
	* Getter.  Returns an ImmutableTrack object for external modification.
	*/
	get immutableTrack()
	{
		return this.immutableTrack;
	}
	
	/**
	* Getter.  Returns the track ID.
	*/
	get id()
	{
		return this.id;
	}
	
	/**
	* Getter.  Returns the track name.
	*/
	get name()
	{
		return this.name;
	}
	
	/**
	* Getter.  Returns a flag indicating wether the track is record armed or not.
	*/
	get recArmed()
	{
		return this.recArmed;
	}
	
	/**
	* Getter.  Returns a raw volume value for the track.
	*/
	get vol()
	{
		return this.vol;
	}
	
	/**
	* Getter.  Returns a string with the track's volume in dB.
	*/
	get volStr()
	{
		return this.volStr;
	}
	
	/**
	* Getter.  Returns a raw pan value for the track.
	*/
	get pan()
	{
		return this.pan;
	}
	
	/**
	* Getter.  Returns a flag indicating wether the track is muted or not.
	*/
	get mute()
	{
		return this.mute;
	}
	
	/**
	* Getter.  Returns a flag indicating wether the track is soloed or not.
	*/
	get solo()
	{
		return this.solo;
	}
	
	/**
	* Getter.  Returns an RGB color string.
	*/
	get color()
	{
		return this.color;
	}
	
	/**
	* Getter.  Returns a flag indicating wether the track is a folder or not.
	*/
	get isFolder()
	{
		return this.isFolder;
	}
	
	/**
	* Getter.  Returns the number of sends the track currently has.
	*/
	get sendCount()
	{
		return this.sends.sendCount;
	}
	
	/**
	* Getter.  Returns the number of recieves the track currently has.
	*/
	get recieveCount()
	{
		return this.recieveCount;
	}
	
	/**
	* Static method.  Figures out what the track ID is given a track div DOM object.
	* @param {Object} trackDiv is a track div DOM object reference.
	* @returns {number} the ID of the track.
	*/
	static extractIDFromDiv(trackDiv)
	{
		return parseInt(trackDiv.id.split(" ")[1]);
	}
	
	/**
	* Static method.  Gets the default track color.  Used to set the global default.
	* @returns {number} a string contining an RGB color.
	*/
	static get defaultColor()
	{
		return "#9DA5A5";
	}
	
	/**
	* Static method.  Returns a pre-defined SVG template for a track faceplate, including name, buttons, etc.
	*/
	static getFaceplateSvgClone()
	{
		var clone = document.getElementById("trackRow1Svg").cloneNode(true);
		if (!clone)
			throw "Unable to find faceplate SVG in document";
		clone.id = ""
		
		return clone;
	}
	
	/**
	* Static method.  Returns a pre-defined SVG template for a track fader track and fader.
	*/
	static getFaderTrackSvgClone()
	{
		var clone = document.getElementById("trackRow2Svg").cloneNode(true);
		if (!clone)
			throw "Unable to find fader SVG in document";
		clone.id = ""
		
		return clone;
	}
	
	/**
	* Static method.  Determines if a Rec Armed flag is set from a Reaper parameter byte list.
	* @param {Object} Reaper parameters list.
	*/
	static recArmedFlagSet(flags)
	{
		return (flags&64) ? 1 : 0;
	}
	
	
	/*  Private methods  */
	updateTrackSends(sendsCount, hwOutCount)
	{
		sendsCount = parseInt(sendsCount);
		hwOutCount = parseInt(hwOutCount);
		var count = sendsCount + hwOutCount;
		if (count != this.sends.sendCount)
		{
			//Update sends indicator, if one exists
			if (this.sendIndicator)
			{
				if (count == 0)
					this.sendIndicator.style.visibility = "hidden";
				else if (this.sends.sendCount == 0)
					this.sendIndicator.style.visibility = "visible";
			}
			
			//Update sends container
			this.sends.updateSendsCount(count);
		}
	}
	
	updateTrackVolume(vol)
	{
		if (vol != this.vol)
		{
			//Update string readout and fader position.
			this.vol = vol;
			this.volStr = (ReaperComms.mkvolstr(vol));
			this.volThumb.volSetting = (Math.pow(vol, 1/4) * 194.68);
			var vteMove = "translate(" + this.volThumb.volSetting + " 0)";
			
			//Update the display if the track isn't hidden.
			if(!this.hidden)
			{
				if (this.meterReadout)
					this.meterReadout.textContent = this.volStr;
				
				if(!this.faderEventListener.mouseIsDown)
					this.volThumb.setAttributeNS(null, "transform", vteMove);
			}
		}
	}
	
	updateTrackClip(clip)
	{
		if(!this.trackClipped && clip>=0)
		{
			this.trackClipped = 1;
			
			if (this.clipIndicator && !this.hidden)
				this.clipIndicator.style.visibility = "visible";
		}
	}
	
	updateTrackColor(color)
	{
		var updated = 0;
		//Calculate color
		if (this.trackBg)
		{
			if (color>0)
				color = ("#" + (color|0x1000000).toString(16).substr(-6));
			else
				color = AbstractTrack.defaultColor;
				
			if(color != this.color)
			{
				//Set color
				this.color = color;
				updated = 1;
				
				if (!this.hidden)
					this.trackBg.style.fill = color;
			}
		}
		
		return updated;
	}
	
	updateTrackReceives(recieves)
	{
		var updated=0;
		recieves = parseInt(recieves);
		
		if(this.recieveCount != recieves)
		{
			//First let's see if we need to update the indicator
			//We only need to update the indicator if we're turning it on or off, which means we're going from 0 recieves or to 0 recieves.
			if (this.rcvIndicator && !this.hidden && (this.recieveCount == 0 || recieves == 0))
				this.rcvIndicator.style.visibility = (recieves>0) ? "visible" : "hidden";
			
			//Now let's store the new recieve count.
			this.recieveCount = recieves;
			updated=1;
		}
		
		return updated;
	}
	
	updateTrackName(name)
	{
		var updated = 0;
		if(name != this.name)
		{
			this.name = name;
			updated =1;
			
			if (this.trackText && !this.hidden)
				this.trackText.textContent = name;
		}
		
		return updated;
	}
	
	updateTrackButtons(buttonsStr)
	{
		var updated = 0;
		if(buttonsStr != this.trackFlagsString)
		{
			//this.updateHidden(buttonsStr);
			updated = updated || this.updateRecArm(buttonsStr);
			updated = updated || this.updateSolo(buttonsStr);
			updated = updated || this.updateMute(buttonsStr);
			updated = updated || this.updateFolderIcon(buttonsStr);
		}
		
		return updated;
	}
	
	updateRecArm(buttonsStr)
	{
		var updated = 0;
		buttonsStr = (buttonsStr&64) ? 1 : 0;
		if(this.recArmEnabled && (buttonsStr) != this.recArmed)
		{	
			this.recArmed = buttonsStr;
			updated = 1;
			
			if (this.recarmOffButton && this.recarmOnButton && !this.hidden)
			{
				this.recarmOffButton.style.visibility = (this.recArmed) ? "hidden" : "visible"; 
				this.recarmOnButton.style.visibility = (this.recArmed) ? "visible" : "hidden";
			}
		}
		
		return updated;
	}
	
	updateSolo(buttonsStr)
	{
		var updated = 0;
		buttonsStr = (buttonsStr&16) ? 1 : 0;
		
		if(buttonsStr != this.solo)
		{
			this.solo = buttonsStr;
			updated = 1;
			
			if (this.soloOffButton && this.soloOnButton && !this.hidden)
			{
				this.soloOffButton.style.visibility = (this.solo) ? "hidden" : "visible"; 
				this.soloOnButton.style.visibility = (this.solo) ? "visible" : "hidden";
			}
		}
		
		return updated;
	}
	
	updateMute(buttonsStr)
	{
		var updated = 0;
		buttonsStr = (buttonsStr&8) ? 1 : 0;
		
		if(buttonsStr != this.mute)
		{
			this.mute = buttonsStr;
			updated = 1;
			
			if (this.muteOffButton && this.muteOnButton && !this.hidden)
			{
				this.muteOffButton.style.visibility = (this.mute) ? "hidden" : "visible"; 
				this.muteOnButton.style.visibility = (this.mute) ? "visible" : "hidden";
			}
		}
		
		return updated;
	}
	
	updateFolderIcon(buttonsStr)
	{
		var updated = 0;
		if((buttonsStr&1) != this.isFolder)
		{
			this.isFolder = (buttonsStr&1);
			updated = 1;
			
			if (this.folderIcon && !this.hidden)
				this.folderIcon.style.visibility = (this.isFolder) ? "visible" : "hidden";
		}
		
		return updated;
	}
	
	updateHidden(buttonsStr)
	{
		this.setTrackEnabled((buttonsStr&512));
	}
};
/**
* An object with the same interface as an AbstractTrack.  The only difference is whenever a method that modifies the state of the track, besides registering/unregistering listeners, is called the object throws an exception.  The methods outlined here are the ones that throw an exception, for all others see the AbstractTrack class documentation.
*/
class ImmutableTrack //extends AbstractTrack
{
	track;
	
	constructor (track)
	{
		if (!(track instanceof AbstractTrack))
			throw "Object not a track";
		
		//super(0,1);
		
		this.track = track;
	}
	
	/**
	* Throws an exception if invoked.
	*/
	updateTrack(tok)
	{
		throw "Unable to update track from outside track manager";
	}
	
	/**
	* Throws an exception if invoked.
	*/
	enable()
	{
		throw "Unable to enable from outside track manager";
	}
	
	/**
	* Throws an exception if invoked.
	*/
	disable()
	{
		throw "Unable to disable from outside track manager";
	}
	
	/**
	* Throws an exception if invoked.
	*/
	show()
	{
		throw "Unable to show from outside track manager";
	}
	
	/**
	* Throws an exception if invoked.
	*/
	hide()
	{
		throw "Unable to hide from outside track manager";
	}
	
	registerListener(listener)
	{
		this.track.registerListener(listener);
	}
	
	unregisterListener(listener)
	{
		this.track.unregisterListener(listener);
	}
	
	/**
	* Throws an exception if invoked.
	*/
	updateSend(tok, stateStr)
	{
		throw "Unable to update send from outside track manager";
	}
	
	get immutableTrack()
	{
		return this;
	}
	
	get id()
	{
		return this.track.id;
	}
	
	get name()
	{
		return this.track.name;
	}
	
	get recArmed()
	{
		return this.track.recArmed;
	}
	
	get vol()
	{
		return this.track.vol;
	}
	
	get volStr()
	{
		return this.track.volStr;
	}
	
	get pan()
	{
		return this.track.pan;
	}
	
	get mute()
	{
		return this.track.mute;
	}
	
	get solo()
	{
		return this.track.solo;
	}
	
	get color()
	{
		return this.track.color;
	}
	
	get isFolder()
	{
		return this.track.isFolder;
	}
	
	get sendCount()
	{
		return this.track.sendCount;
	}
	
	get recieveCount()
	{
		return this.track.recieveCount;
	}
};
/**
* Track class.  Defines how to build a regular track and then calls it's parent to take advantage of the rest of the track functionality in AbstractTrack.  Defines no new functions.
*/
class Track extends AbstractTrack
{
	trackDeleteEventListener;
	trackRenameListener;
	row1SVG;
	animations;
	static animationTime=20;
	
	constructor(allTracksDiv, trackID)
	{
		if (allTracksDiv == null)
			throw "Invalid track storage div object reference";
		
		if (trackID == null)
			throw "No track ID passed in";
		
		if (typeof trackID != "number")
			throw "Track ID passed is not a number";
		
		if (trackID < 1)
			throw "Invalid track ID";
		
		//Build track div.
		var trackDiv = document.createElement("div");
		trackDiv.id = ("Track " + trackID);
		trackDiv.className = ("trackDiv");
	
		//Attach track div to all tracks div
		allTracksDiv.appendChild(trackDiv);
		
		//Build sub-divs
		var trackRow1Div = document.createElement("div");
		trackRow1Div.className = ("trackRow1");
		var slider = document.createElement("div");
		slider.className = ("trackRow2");
		slider.id = trackID;
		
		//Attach sub-divs
		trackDiv.appendChild(trackRow1Div);
		trackDiv.appendChild(slider);
	
		//Build the first row of the control (all the buttons)
		var trackRow1Content = trackDiv.childNodes[0];
		trackRow1Content.appendChild(AbstractTrack.getFaceplateSvgClone());
		
		//Set the channel display.
		var trackNumber = trackRow1Content.firstChild.getElementsByClassName("trackNumber")[0];
		trackNumber.textContent = trackID;
		
		//Build and attach sub-divs common to all tracks
		var trackSendsDiv = document.createElement("div");
		trackSendsDiv.id = ("sendsTrack" + trackID);
		trackSendsDiv.classList.add("SendsDiv");
		trackDiv.appendChild(trackSendsDiv);
		
		//Build the second row of the controls (volume fader).
		var trackRow2Content = trackDiv.childNodes[1];
		trackRow2Content.appendChild(AbstractTrack.getFaderTrackSvgClone());
		
		super(trackDiv);
		
		//Register regular track event listeners.
		//this.trackDeleteEventListener = new TrackDeleteEventHandler(trackDiv, super.trackExpandListener);
		this.trackRenameListener = new TrackRenameEventHandler(trackDiv);
		
		//Build animation object and fade in track
		this.animations = AbstractAnimationEngine.getSuggestedEngine();
		this.row1SVG = trackRow1Div.childNodes[0].childNodes[1];
		this.animations.resizeViewbox(this.row1SVG, 0,1,320,53)
	}
	
	enable()
	{
		var translateX = "translate(0, 0)";
		this.row1SVG.setAttribute("transform", translateX);
		this.animations.resizeViewbox(this.row1SVG, 0, 1, 320, 53);
		super.enable();
	}
	
	disable()
	{
		this.animations.translate(this.row1SVG, -800, 0);
		this.animations.resizeViewbox(this.row1SVG, 0,1,320,0.000001, 5);
		super.disable();
	}
};
/**
* Singleton MasterTrack class.  Defines how to build a master track and then calls it's parent to take advantage of the rest of the track functionality in AbstractTrack.
*/
class MasterTrack extends AbstractTrack
{
	static instance;
	trackExpandListener;
	masterRecArmButton;
	soloClear;
	
	constructor()
	{
		if (!MasterTrack.instance)
		{
			//Find all master track components.
			var masterTrack = document.getElementById("Track 0");
			var masterMuteOffButton = document.getElementById("master-mute-off");
			var masterMuteOnButton = document.getElementById("master-mute-on");
			var masterClipOn = document.getElementById("master-clip_on");
			var masterClipOff = document.getElementById("master-clip_off");
			var masterMeterReadout = document.getElementById("masterDb");
			var muteDiv = document.getElementById("mute")
		
			//Validate master track components
			if (!masterTrack)
				throw "Could not locate master track div in document";
			if (!masterMuteOffButton)
				throw "Could not locate master track mute off button in document"; 
			if (!masterMuteOnButton)
				throw "Could not locate master track mute on button in document"; 
			if (!masterClipOn)
				throw "Could not locate master track clip on indicator in document"; 
			if (!masterClipOff)
				throw "Could not locate master track clip off indicator in document"; 
			if (!masterMeterReadout)
				throw "Could not locate master track volume readout indicator in document"; 
			if (!muteDiv)
				throw "Could not locate master track mute div in document";
			
			//Give the master track components the proper class names to make AbstractClass be able to detect them.
			masterMeterReadout.classList.add("meterReadout");
			masterMuteOffButton.classList.add("mute-off");
			masterMuteOnButton.classList.add("mute-on");
			masterClipOn.classList.add("clip_on");
			masterClipOff.classList.add("clip_off");
			muteDiv.classList.add("mute");
			
			//Build fader on the master channel.
			var masterTrackRow2Content = masterTrack.childNodes[3];  
			masterTrackRow2Content.appendChild(AbstractTrack.getFaderTrackSvgClone());
			var trackSendsDiv = document.createElement("div");
			trackSendsDiv.id = ("sendsTrack0");
			trackSendsDiv.classList.add("SendsDiv");
			masterTrack.appendChild(trackSendsDiv);
			
			//Call parent constructor.
			super(masterTrack);
			this.masterRecArmButton = new MasterRecArmButton();
			this.soloClear = new SoloClearButton();
			
			MasterTrack.instance = this;
		}
		
		return MasterTrack.instance;
	}
	
	/**
	* The overriden disable function throws an exception, the master track can't be disabled.
	*/
	disable()
	{
		throw "Master track cannot be disabled";
	}
	
	/**
	* The overriden hide function throws an exception, the master track can't be hidden.
	*/
	hide()
	{
		throw "Master track cannot be hidden";
	}
};
/**
* This button keeps track of how many channels are soloed, and if activated, will clear all of them.  It's a simple dual state button and has no methods that need to be called.
*/
class SoloClearButton extends FlashingToggleButton
{
	trackManager;
	tracksReg=1;
	tracksSoloed=0;
	comms;
	
	constructor(soloButtonDiv)
	{
		var solo = document.getElementById("solo_clear");
		var soff = document.getElementById("solo_clear_off");
		var son = document.getElementById("solo_clear_on");
		super (son, soff, 500);
		
		//Build track list reference
		this.trackManager = new TrackManager();
		this.comms = new ReaperComms();
		
		//Attach listeners
		this.trackManager.registerListener((tlist) => {this.trackManagerUpdated(tlist)});
		solo.onclick = () => {this.disableAllSolos()};
	}
	
	trackManagerUpdated(tlist) 
	{
		while ((tlist.trackCount) >  this.tracksReg)
		{
			tlist.getTrackByID(this.tracksReg).registerListener((track) => {this.trackUpdated(track)});
			this.tracksReg++;
		}
	}
	
	trackUpdated(track) 
	{
		if (track.solo)
		{
			this.enable();
		}
		else
		{
			if (this.enabled)
			{
				var solo=0;
				var track;
				for (var x=1; x < this.trackManager.trackCount; x++)
				{
					track = this.trackManager.getTrackByID(x);
					if (track.solo)
					{
						solo=1;
						break;
					}
				}
				
				if (!solo)
					this.disable();
			}
		}
	}
	
	disableAllSolos() 
	{
		//Disable flashing and clear all solos
		this.disable();
		var track;
		for (var x=1; x < this.trackManager.trackCount; x++)
		{
			track = this.trackManager.getTrackByID(x);
			if (track.solo)
				this.comms.setTrackSolo(x, 0);
		}
	}
}

/**
* This class either mass-enables all tracks to record arm, or mass disableds them.
*/
class MasterRecArmButton extends ToggleButton
{
	comms;
	tracks;
	tracksArmed = 0;
	
	constructor()
	{		
		//Find on/off display elements
		var masterRecArmOff = document.getElementById("recArmClearOff");
		var masterRecArmOn = document.getElementById("recArmClearOn");
		
		//call parent constuctor
		super(masterRecArmOn, masterRecArmOff);
		
		//Build objects that we're gonna be using (ReaperComms and TrackManager) and store them locally
		this.comms = new ReaperComms();
		this.tracks = new TrackManager();
		document.getElementById("RecarmClear").onclick = () => {this.recArmToggle()};
		
		//register as a listener
		this.tracks.registerListener((tlist) => {this.tlistUpdated(tlist)} );
	}

	countUpdated(counter)
	{ 
		var count = counter.armedCount;
		if(this.enabled && count < (this.tracks.trackCount-1))
		{
			this.disable();
		}
		else if(count == (this.tracks.trackCount-1) && count > 0)
		{
			this.enable();
		}
	}
	
	tlistUpdated(tlist)
	{
		if (this.enabled)
		{
			while ((tlist.trackCount-1) > this.tracksArmed)
			{
				this.tracksArmed++;
				this.comms.setTrackRecArm(this.tracksArmed, 1);
			}
		}
	}

	recArmToggle()
	{
		this.toggleState();
		if (!this.enabled)
			this.recArmClear();
		else
			this.recArmEngage();
	}

	recArmClear()
	{
		for (var i = 1; i < this.tracks.trackCount; i++)
		{
			if (this.tracks.getTrackByID(i).recArmed)
				this.comms.setTrackRecArm(i, 0);
		}
		this.tracksArmed = 0;
	}

	recArmEngage()
	{
		for (var i = 1; i < this.tracks.trackCount; i++)
		{
			if (!this.tracks.getTrackByID(i).recArmed)
				this.comms.setTrackRecArm(i, 1);
		}
		
		this.tracksArmed = this.tracks.trackCount-1;
	}
}

/**
* This object clears the clip indicator when the indicator is clicked on.  It has no methods that need to be called externally.
*/
class ClearClipEventHandler
{
	//DOM object references.
	clipOnControl;
	clipOffControl;
	
	//Track manager (for clearing all clips)
	tracks;
	
	/**
	* @param {Object} trackDiv is a reference to the track div DOM object.  The object gets everything it needs from the div object.
	*/
	constructor(trackDiv)
	{
		if (trackDiv == null)
			throw "Invalid track div reference";
		
		
		this.clipOnControl = trackDiv.getElementsByClassName("clip_on")[0];
		this.clipOffControl = trackDiv.getElementsByClassName("clip_off")[0];
		
		if (!this.clipOnControl || !this.clipOffControl)
			throw "Unable to find clip on/off elements in track div";
		
		this.clipOnControl.addEventListener('click', this);
		this.clipOnControl.addEventListener('dblclick', this);
	}
	
	handleEvent(event)
	{
		if (event.type == "click")
		{
			this.clipOnControl.style.visibility = "hidden";
			this.clipOffControl.style.visibility = "visible";
		}
	}
}
/**
* This object keeps track of the track fader movement.  It has no methods that need to be called externally.
*/
class TrackFaderEventHandler extends AbstractMovableObjectEventHandler
{
	//Track id.
	id;
	
	//DOM object references.
	fader;
	slider;
	
	//Reaper comms object.
	comms;
	/**
	* @param {Object} trackDiv is a reference to the track div DOM object.  The object gets everything it needs from the div object.
	*/
	constructor(trackDiv)
	{
		//Make sure all parameters passed in are valid.
		if (trackDiv == null)
			throw "Invalid track component DOM object reference";
		
		//Init object
		var fader = trackDiv.getElementsByClassName("fader")[0];
		if (fader == null)
			throw "No fader control found in track div";
		
		var slider = trackDiv.getElementsByClassName("trackRow2")[0];
		if (slider == null)
			throw "No slider found in track div";
		
		//Call parent constructor
		super(fader);
		
		//Store objects in local object
		this.fader = fader;
		this.slider = slider;
		this.comms = new ReaperComms();
		this.id = AbstractTrack.extractIDFromDiv(trackDiv);
		
		//Make sure Reaper comms is good		
		if (!(this.comms instanceof ReaperComms))
			throw "Invalid Reaper Comms object reference";
	}
	
	mouseMoveHandler(event)
	{
		var volTrackWidth = this.slider.getBoundingClientRect()["width"];
		var volThumbWidth = volTrackWidth * 0.14375;
		var volThumbTrackWidth = (volTrackWidth - volThumbWidth);
		var volThumbTrackLEdge = this.slider.getBoundingClientRect()["left"];
		var offsetX;
		if (event.changedTouches != undefined) 
			//we're doing touch stuff
			offsetX = (event.changedTouches[0].pageX - volThumbTrackLEdge - (volThumbWidth / 2));
		else
			offsetX = (event.pageX - volThumbTrackLEdge - (volThumbWidth / 2));
		
		if(offsetX < 0)
			offsetX = 0;
		
		if(offsetX > volThumbTrackWidth)
			offsetX = volThumbTrackWidth;
		//Update local display
		var offsetX320 = offsetX * (320 / volTrackWidth);
		var vteMove320 = "translate(" + offsetX320 + " 0)";
		this.fader.setAttributeNS(null, "transform", vteMove320);
		
		//Send update to Reaper
		var volOutput = (offsetX  / volThumbTrackWidth);
		var volOutputdB = Math.pow(volOutput, 4) * 4;
		this.comms.setTrackVol(this.id, volOutputdB);
	}
};
/**
* This object askes for a new track name when the track name is double clicked on, and updates the track with the new name.  It has no methods that need to be called externally.
*/
class TrackRenameEventHandler
{
	comms;
	trackID;
	
	/**
	* @param {Object} trackDiv is a reference to the track div DOM object.  The object gets everything it needs from the div object.
	*/
	constructor(trackDiv)
	{
		var trackText = trackDiv.getElementsByClassName("trackName")[0];
		
		if (!trackText)
			throw "Could not find track name control in track div"
		
		trackText.addEventListener("click", (e) => {this.handleEvent(e)});
		trackText.addEventListener("mousedown", (e) => {this.handleEvent(e)});
		
		this.comms = new ReaperComms();
		this.trackID = AbstractTrack.extractIDFromDiv(trackDiv);
		
		if (!this.trackID)
			throw "Track div reference did not have valid track ID";
	}
	
	handleEvent(e)
	{
		var name = prompt("Track name:");
		if (name != null)
			this.comms.setTrackName(this.trackID, name);
	}
}
/**
* This object expands and collapses fader and send view when the track face is clicked on.  It has no methods that need to be called externally.
*/
class TrackExpandEventHandler
{
	//
	parentTrack;
	id;
	trackRow2Svg;
	row2Controls;
	sendsDiv;
	
	//Hitbox control variables.
	transitionTime = 0;
	easingValue = 0;
	trackHeight = 0;
	trackHitboxMouseDown=0;
	enableHitbox=0;
	iteration;
	transitions;
	
	//External objects
	animationEngine;
	
	/**
	* @param {AbstractClass} track is a reference to the track object.  It's needed to figure out how many sends we need to draw on expansion.
	* @param {Object} trackDiv is a reference to the track div DOM object.  The object gets everything it needs from the div object.
	*/
	constructor (track, trackDiv)
	{
		if (!(track instanceof AbstractTrack))
			throw "Track parameter must be instance of an AbstractTrack object";
		
		this.parentTrack = track;
		this.id = track.id;
		this.row2Controls = trackDiv.getElementsByClassName("trackRow2")[0];
		this.trackRow2Svg = this.row2Controls.firstChild.firstElementChild;
		this.sendsDiv = trackDiv.getElementsByClassName("SendsDiv")[0];
		
		// Init and connect hitboxes
		var hitboxes = trackDiv.getElementsByClassName("hitbox");
		for (var i = 0; i < hitboxes.length; i++)
		{
			hitboxes[i].addEventListener("mousedown", (e) => {this.handleEvent(e)});
			hitboxes[i].addEventListener("mouseup", (e) => {this.handleEvent(e)});
		}
		
		this.animationEngine = AbstractAnimationEngine.getSuggestedEngine();
	}
	
	enable()
	{
		this.enableHitbox=1;
	}
	
	disable()
	{
		this.enableHitbox=0;
	}
	
	handleEvent(e)
	{
		if(!event.defaultPrevented)
		{
			if (e.type == "mousedown")
				this.enable();
			else if(this.enableHitbox)
				this.hitbox();
		}
	}
	
	hitbox()
	{	
		var sizeFader;
		var sizeSends;
			
		if (this.trackHeight==0)
		{
			sizeFader=37;
			sizeSends=50;
		}
		else
		{
			sizeFader=0.0001;
			sizeSends=0.0001;
		}
		
		var sends = this.sendsDiv.getElementsByClassName("sendDiv");
		var send;
		this.animationEngine.resizeViewbox(this.trackRow2Svg, 0, 1, 320, sizeFader);		
		for(var x=0;x<sends.length;x++)
		{
			send = sends[x].childNodes[0].childNodes[1];
			this.animationEngine.resizeViewbox(send, 0, 1, 320, sizeSends);
		}
		
		this.trackHeight ^= 1;
	}
};
/**
* This object keeps track of the machenery to delete a track, like moving the faceplace and communicating the update to Reaper.  It has no methods that need to be called externally.
*/
class TrackDeleteEventHandler extends AbstractMovableObjectEventHandler
{
	//DOM object references.
	row1SVG;
	
	//Internal control variables.
	id;
	dx = 0;
	
	//External objects.
	comms;
	trackExpandEventHandler;
	animations;
	tlist;
	
	/**
	* @param {Object} trackDiv is a reference to the track div DOM object.  The object gets everything it needs from the div object.
	*/
	constructor(trackDiv, trackExpandEventHandler)
	{
		//First check to make sure the object is valid.
		if (trackDiv == null)
			throw "Invalid track component DOM object reference";
		
		if (!(trackExpandEventHandler instanceof TrackExpandEventHandler))
			throw "trackExpandEventHandler parameter must be an instance of a TrackExpandEventHandler object";
		//Get the row 1 controls g.
		//There should only be one.
		var cons = trackDiv.getElementsByClassName("trackRow1");
		var row1Controls = cons[0];
		super(row1Controls);
		
		this.row1SVG = cons[1];
		this.id = AbstractTrack.extractIDFromDiv(trackDiv);
		
		//Store the track div for later usage.
		this.comms = new ReaperComms();
		this.trackExpandEventHandler = trackExpandEventHandler;
		
		//Init delete buttons
		trackDiv.getElementsByClassName("delTrackBackground")[0].onclick = () => {this.deleteTrack();};
		trackDiv.getElementsByClassName("delTrackPath")[0].onclick = () => {this.deleteTrack();};
		
		//Store animation engine
		this.animations = AbstractAnimationEngine.getSuggestedEngine();
		this.tlist = new TrackManager();
	}
	
	/* Private Methods */	
	cleanup(e)
	{
		//Check to see if we need to run a restore animation.
		var xfinal=0;
		if (this.dx < -45)
		{
			xfinal=-45;
			this.animations.translate(this.row1SVG, xfinal, 0);
		}
		else if (this.dx < 0)
		{
			xfinal = 0;
			this.animations.translate(this.row1SVG, xfinal, 0);
		}
		
		this.dx=xfinal;
	}
	
	mouseMoveHandler(e)
	{
		if (e.defaultPrevented)
			return;	
		//Disable hitbox
		this.trackExpandEventHandler.disable();	
		//Calculate offset.
		//Let's see if we're in a touch environment
		if (e.changedTouches != undefined)
			this.dx = e.changedTouches[0].pageX - this.mouseDownX + this.dx;
		else
			this.dx = e.pageX - this.mouseDownX + this.dx;
		
		//Let's take the square root to give it a rubber band effect
		this.dx = Math.sign(this.dx) * 4.5 * Math.sqrt(Math.abs(this.dx));
		if (this.dx > 0)
			this.dx = 0;
		
		//Update control
		var translateX = "translate(" + this.dx + ", 0)";
		this.row1SVG.setAttribute("transform", translateX);
	}	
	
	deleteTrack()
	{
		//Send delete command
		this.comms.deleteTrack(this.id);
		
		//Reset track svg
		this.animations.translate(this.row1SVG, 0, 0);
	}
};