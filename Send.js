'use strict';	

//To do:
//1.  Implement track registration
//2.  Implenent update on track update

/**
* A send class manages the graphics and state of a track send and communicates send updates to Reaper.
*/
class Send
{
	//DOM object references
	sendDiv;
	sendTitleText;
	fader;
	sendMuteOff;
	sendMuteOn;
	sendLine;
	sDbText;
	
	//Send properties
	stateString = "";
	enabled = 0;
	trackID;
	sendID;
	mute;
	vol;
	volStr;
	trackRef = -2;
	trackName = "";
	trackColor = -1;
	faderOpacity=0;
	
	//Event listeners
	faderHandler;
	
	//Track storage container
	trackManager;
	
	//Reaper comms object
	comms;
	
	/**
	* Constructs a new Send object.
	* @param {number} trackID is the parent track ID.
	* @param {number} sendID is this send's ID.
	* @param {Object} sendsDiv is a reference to the to the parent track send Div object to attach the newly created send div to.
	*/
	constructor(trackID, sendID, sendsDiv)
	{
		//Check and store input parameters
		if (trackID == null || trackID < 0)
			throw "Invalid track ID";
		
		if (sendID == null || sendID < 0)
			throw "Invalid send ID";
		
		//Build/store object
		this.trackManager = new TrackManager();
		this.comms = new ReaperComms();
		this.trackID = trackID;
		this.sendID = sendID;
		
		//Build the send div
		this.sendDiv = this.buildSend(trackID, sendID);
		sendsDiv.appendChild(this.sendDiv);
		
		//Get all necessary DOM references
		this.sendTitleText = this.sendDiv.firstChild.getElementsByClassName("sendTitleText")[0];
		this.sendMuteOff = this.sendDiv.firstChild.getElementsByClassName("send_mute_off")[0];
		this.sendMuteOn = this.sendDiv.firstChild.getElementsByClassName("send_mute_on")[0];
		this.fader = this.sendDiv.firstChild.getElementsByClassName("sendThumb")[0];
		this.sendLine = this.sendDiv.firstChild.getElementsByClassName("sendLine")[0];
		this.sDbText = this.sendDiv.firstChild.getElementsByClassName("sDbText")[0];
		
		//Connect event listeners
		this.faderHandler = new SendFaderEventHandler(this.sendDiv);
		
		//Launch Send
		this.enable();
	}
	
	/**
	* Updates the state of the send object and GUI.  This function does not do any data validation for the sake of speed, so keep that in mind when using it.
	* @param {CommandCollection} is a tokenized command collection.
	*/
	updateSend(tok)
	{
		//Now let's start updating the send where needed.
		this.updateTrackReference(tok[6]);
		
		//Update volume label and slider
		this.updateSendVol(tok[4]);
		
		//Let's see if we have to update the mute button.
		this.updateSendMute(tok[3]);
	}
	
	/**
	* Enables and displays the send, if disabled.
	*/
	enable()
	{
		if (!this.enabled)
		{
			this.enabled = 1;
			this.sendDiv.style.display = "block";
			this.comms.wwr_req_recur("GET/TRACK/" + this.trackID + "/SEND/" + this.sendID + ";");
		}
	}

	/**
	* Disabled and hides the send, if enabled.
	*/
	disable()
	{
		if (this.enabled)
		{
			this.enabled = 0;
			this.sendDiv.style.display = "none";
			comms.wwr_req_recur_cancel("GET/TRACK/" + this.trackID + "/SEND/" + this.sendID + ";");
		}
	}
	
	/**
	* Returns the send's parent ID.
	*/
	get parentID()
	{
		return this.trackID;
	}

	/**
	* Returns the send's ID.
	*/
	get sendID()
	{
		return this.sendID();
	}

	/**
	* A static method that extracts the parent ID from a send div object.
	* @param {Object} sendDiv a reference to a send Div DOM object.
	* @returns {number} the ID of the parent track.
	*/
	static getSendDivParentID(sendDiv)
	{
		return sendDiv.id.split(" ")[1];
	}

	/**
	* A static method that extracts the send ID from a send div object.
	* @param {Object} sendDiv a reference to a send Div DOM object.
	* @returns {number} the ID of the send.
	*/
	static getSendDivID(sendDiv)
	{
		return sendDiv.id.split(" ")[3];
	}
	
	
	/*  Private Methods  */	
	buildSend(trackID, sendID)
	{
		//Build div
		var trackSend = document.getElementById("trackSendSvg");
		var sendDiv = document.createElement("div");
		sendDiv.className = ("sendDiv");
		sendDiv.id = "Track " + trackID + " send " + sendID;
		sendDiv.appendChild(trackSend.cloneNode(true));
		
		//Get track div SEND div
		var s = document.getElementById("sendsTrack" + trackID);
		s.appendChild(sendDiv);
		
		//Connect mute button.
		var sendMuteButton = sendDiv.firstChild.getElementsByClassName("send_mute")[0];
		sendMuteButton.onmousedown = () => {this.comms.setSendMute(trackID, sendID, ReaperComms.onoff.TOGGLE);};
		
		return sendDiv;
	}
	
	updateSendMute(sendConfig)
	{
		var mute = (sendConfig&8);
		if (mute != this.mute)
		{
			this.mute = mute;
			
			if (this.enabled)
			{
				this.sendMuteOff.style.visibility = this.mute ? "hidden" : "visible";
				this.sendMuteOn.style.visibility = this.mute ? "visible" : "hidden";
			}
		}
	}
	
	updateSendVol(volume)
	{
		if (volume != this.vol)
		{
			//Store new volume
			this.vol = volume;
			
			if (this.enabled)
			{
				//Update the volume label.
				this.sDbText.textContent = ReaperComms.mkvolstr(volume);
				
				//Only change the slider controls if they're not being modified by the user
				if(!this.faderHandler.mouseIsDown)
				{
					var vol = (Math.pow(volume, 1/4) * 154) + 27;
					this.sendLine.setAttribute("x2", vol);
					this.fader.setAttribute("cx", vol);
				}
			}
		}
	}
	
	targetTrackUpdated(track) 
	{
		var color = track.color;
		var name = track.name;
		
		this.updateSendColor(color);
		this.updateSendName(name);
	}
	
	updateOpacity(color)
	{
		var opacity=0.5;
		if (color == AbstractTrack.defaultColor)
			opacity = 1;
		
		if (opacity != this.faderOpacity && this.enabled)
		{
			this.faderOpacity = opacity;
			this.fader.setAttributeNS(null, "opacity", opacity);
		}
	}
	
	updateSendColor(color)
	{
		if (color != this.trackColor)
		{
			this.trackColor = color;
			
			if (this.enabled)
			{
				this.fader.style.fill = color;
				this.sendTitleText.style.fill = color;
				this.sDbText.style.fill=color;
			}
		}
	}
	
	updateSendName(name) 
	{
		if (name == "")
			name = "Track " + this.trackRef;
			
		if (name != this.trackName)
		{
			this.trackName = name;
			
			this.sendTitleText.textContent = name;
		}
	}
	
	updateTrackReference(trackID)
	{
		//Update send name
		if (trackID != this.trackRef)
		{
			var track;
			if (this.trackRef >= 0)
			{
				track = this.trackManager.getTrackByID(this.trackRef);
				track.unregisterListener((track) => {this.targetTrackUpdated(track);});
			}
			
			this.trackRef = trackID;
			if (trackID >= 0)
			{
				//Get track, register as listener, and update the send.
				track = this.trackManager.getTrackByID(trackID);
				track.registerListener((track) => {this.targetTrackUpdated(track);});
				this.targetTrackUpdated(track);
			}
			else
			{
				//If it's a hardware out, let's update the text and color without registering as a listener to a track.
				this.updateSendName("Hardware Out");
				this.updateSendColor("#9DA5A5");
				this.updateOpacity();
			}
		}
	}
};

/**
* This object keeps track of the send fader movement.  It has no methods that need to be called externally.
*/
class SendFaderEventHandler extends AbstractMovableObjectEventHandler
{
	//Track id.
	parentId;
	sendId;
	
	//DOM object references.
	fader;
	slider;
	sendLine;
	
	//Reaper comms object.
	comms;
	
	/**
	* @param {Object} sendDiv is the send div DOM object.  The constructor finds everything it needs from that object reference.
	*/
	constructor(sendDiv)
	{
		//Make sure all parameters passed in are valid.
		if (sendDiv == null)
			throw "Invalid send component DOM object reference";
		
		//Init object
		var fader = sendDiv.getElementsByClassName("sendThumb")[0];
		if (fader == null)
			throw "No fader control found in send div";
		
		var slider = sendDiv.getElementsByClassName("sendBg")[0];
		if (slider == null)
			throw "No slider found in send div";
		
		var sendLine = sendDiv.getElementsByClassName("sendLine")[0];
		if (sendLine == null)
			throw "No slider found in send div";
		
		//Call parent constructor
		super(fader);
		
		//Store objects in local object
		this.fader = fader;
		this.slider = slider;
		this.sendLine = sendLine;
		this.comms = new ReaperComms();
		
		//Get send and send numbers.
		this.parentId = Send.getSendDivParentID(sendDiv);
		this.sendId = Send.getSendDivID(sendDiv);
		
		//Make sure Reaper object is built
		if (!(this.comms instanceof ReaperComms))
			throw "Invalid Reaper Comms object reference";
	}
	
	mouseMoveHandler(event)
	{
        var sendTrackWidth = this.slider.getBoundingClientRect()["width"];
        var sendThumbWidth = this.slider.getBoundingClientRect()["height"];
        var sendThumbTrackWidth = (sendTrackWidth - sendThumbWidth);
        var sendThumbTrackLEdge = this.slider.getBoundingClientRect()["left"];
		var offsetX;

        //Calculate offset.
		//Let's see if we're in a touch interface
		if (event.changedTouches != undefined)
            offsetX = (event.changedTouches[0].pageX - sendThumbTrackLEdge - (sendThumbWidth / 2));
		else
			offsetX = event.pageX - sendThumbTrackLEdge - (sendThumbWidth / 2);

        if(offsetX<0)
			offsetX=0;
		
        if(offsetX>sendThumbTrackWidth)
			offsetX=sendThumbTrackWidth;

        var offsetX262 = offsetX * (262 / sendTrackWidth) + 26;
        this.fader.setAttributeNS(null, "cx", offsetX262 );
        this.sendLine.setAttributeNS(null, "x2", offsetX262 );

        var sendOutput = (offsetX  / sendThumbTrackWidth);
        var sendOutputdB = Math.pow(sendOutput, 4) * 4;
        comms.setSendVol(this.parentId, this.sendId, sendOutputdB);
	}
};