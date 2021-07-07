'use strict';

/**
* High-level transport object.  Initializes all objects on the transport panel, such as the time display, play, stop, etc.
*/
class Transport
{
	timekeeper;
	timeDisplay;
	playbutton;
	pausebutton;
	stopbutton;
	recordbutton;
	repeatbutton;
	recarmCounter;
	beatDisplay;
	abortbutton;
	prevMarkerButton;
	nextMarkerButton;
	newMarkerButton;
	jogger;
	trackAddButton;
	timeSignature;
	
	playstate=-1;
	repeat=-1;
	comms;
	
	static instance;
	
	/**
	* @param {TrackManager} trackList is a reference to the track list object.
	* @param {number} refreshTime is the time in ms that Transport requests ReaperComms to be updated.
	*/
	constructor(trackList, refreshTime=100)
	{
		if (!Transport.instance)
		{
			//Validate params
			if (!(trackList instanceof TrackManager))
				throw "trackList parameter must be a TrackManager object";
			
			if (refreshTime < 0)
				throw "Refresh time must be a positive value";
			
			//Set the instance to this
			Transport.instance = this;
			
			//Build components
			this.comms = new ReaperComms(refreshTime);
			this.timekeeper = new Timekeeper(refreshTime);

			//Build GUI components
			//Play button
			var playButtonOff = document.getElementById("playButtonOff"); 
			var playButtonOn = document.getElementById("playButtonOn"); 
			document.getElementById("play").onclick = () => {this.comms.play()};
			this.playbutton = new ToggleButton(playButtonOn, playButtonOff);
		
			//Pause button
			var pauseButtonOff = document.getElementById("pauseButtonOff"); 
			var pauseButtonOn = document.getElementById("pauseButtonOn");
			document.getElementById("pause").onclick = () => {this.comms.pause();};
			this.pausebutton = new ToggleButton (pauseButtonOn, pauseButtonOff);
			
			//Repeat button
			var repeatOff = document.getElementById("repeat_off");
			var repeatOn = document.getElementById("repeat_on");
			document.getElementById("repeatButton").onclick = () => {this.comms.togglePlaybackRepeat();};
			this.repeatbutton = new ToggleButton(repeatOn, repeatOff);
			
			//Misc components
			document.getElementById("prevButton").onclick = () => {this.comms.jumpToPrevMarker();};
			document.getElementById("nextButton").onclick = () => {this.comms.jumpToNextMarker();};
			document.getElementById("dropMarker").onclick = () => {this.comms.createMarkerAtPlaybackPos();};
			document.getElementById("stopButton").onclick = () => {this.comms.stop();};
			
			//Object components
			this.recarmCounter = new RecArmCounter(trackList);
			this.jogger = new Jogger(refreshTime);
			this.timeDisplay = new TimeDisplay(this.jogger);
			this.recordbutton = new RecordButton(this.recarmCounter);
			this.beatDisplay =  new BeatDisplay(this.jogger);
			this.abortbutton = new AbortButton();
			this.timeSignature = new TimeSignature();
			
			var trackAddDiv = document.getElementById("trackAdd");
			if (!trackAddDiv)
				throw "Unable to locate track add button DOM object";
			this.trackAddButton = new TrackAddButton(trackAddDiv);
			
			//Register this as a listener in the TimeKeeper object
			this.timekeeper.registerStateListener((toks) => {this.update(toks)});
		}
		
		return Transport.instance;
	}

	get recArmCounter()
	{
		return this.recarmCounter;
	}
	
	update(timeKeeper)
	{
		this.updatePlayState(timeKeeper.playstate);
		this.updateRepeatButton(timeKeeper.repeat);
	}
	
	updateRepeatButton(repeat)
	{
		if (this.repeat != repeat)
		{
			this.repeat = repeat;
			this.repeatbutton.setState(repeat);
		}
	}
	
	updatePlayState(state)
	{
		if (this.playstate != state)
		{
			this.playstate = state;
			
			if (state == Transport.playState.STOPPED)
			{
				this.playbutton.disable();
				this.pausebutton.disable();
				this.recordbutton.disable();
				this.abortbutton.disable();
				this.recarmCounter.enable();
			}
			else if (state == Transport.playState.PLAYING)
			{
				this.playbutton.enable();
				this.pausebutton.disable();
				this.recordbutton.disable();
				this.abortbutton.disable();
				this.recarmCounter.enable();
			}
			else if (state == Transport.playState.PAUSED)
			{
				this.playbutton.enable();
				this.pausebutton.enable();
				this.recordbutton.disable();
				this.abortbutton.disable();
				this.recarmCounter.enable();
			}
			else if (state == Transport.playState.REC)
			{
				this.playbutton.enable();
				this.pausebutton.disable();
				this.recordbutton.enable();
				this.abortbutton.enable();
				this.recarmCounter.disable();
			}
			else if (state == Transport.playState.RECPAUSED)
			{
				this.playbutton.enable();
				this.pausebutton.enable();
				this.recordbutton.enable();
				this.abortbutton.enable();
				this.recarmCounter.disable();
			}
		}
	}
	static playState =
	{
		STOPPED: 0,
		PLAYING: 1,
		PAUSED: 2,
		REC: 5, 
		RECPAUSED: 6
	}
}

/**
* Timekeeper is a centralized repository of the project time that updates all components that require the project time.
*/
class Timekeeper
{
	playstate=-1;
	repeat = -1;
	num = -1;
	den = -1;
	position_seconds=0;
	full_beat_position=0;
	measure_cnt=0;
	beats_in_measure=-1;
	timeString;
	timeUpdated=0;
	
	observers;
	timeObservers;
	sigObservers;
	stateObservers;
	
	static instance;
	
	/**
	* @param {number} refreshTime is the time in ms that Timekeeper requests ReaperComms to be updated.
	*/
	constructor(refreshTime=100)
	{
		if (!Timekeeper.instance)
		{
			this.observers = new Observable();
			this.timeObservers = new Observable();
			this.sigObservers = new Observable();
			this.stateObservers = new Observable();
			
			var comms = new ReaperComms();
			comms.wwr_req_recur(ReaperComms.beatPosCmd(), refreshTime);
			comms.wwr_req_recur(ReaperComms.transportCmd(), refreshTime);
			comms.registerListener((toks) => {this.update(toks);});
			
			Timekeeper.instance = this;
		}
		
		return Timekeeper.instance;
	}
	
	/**
	* This function takes in a function and stores it internally to be called whenever the time is updated.
	* @param {Object} listener is a function to store and call.
	*/
	registerListener(listener)
	{
		this.observers.registerListener(listener);
	}
	
	/**
	* This function takes in a function and unregisters it from the internal update listerner database.
	* @param {Object} listener is a function to unregister.
	*/
	unregisterListener(listener)
	{
		this.observers.unregisterListener(listener);
	}
	
	registerTimeListener(listener) 
	{
		this.timeObservers.registerListener(listener);
	}
	
	unregisterTimeListener(listener) 
	{
		this.timeObservers.unregisterListener(listener);
	}
	
	registerSignatureListener(listener) 
	{
		this.sigObservers.registerListener(listener);
	}
	
	unregisterSignatureListener(listener) 
	{
		this.sigObservers.unregisterListener(listener);
	}
	
	registerStateListener(listener) 
	{
		this.stateObservers.registerListener(listener);
	}
	unregisterStateListener(listener) 
	{
		this.stateObservers.unregisterListener(listener);
	}
	
	/**
	* Gets the current play position in seconds.
	*/
	get posInSeconds()
	{
		return this.position_seconds;
	}
	
	/**
	* Gets the current play position in beats.
	*/
	get fullBeatPos()
	{
		return this.full_beat_position;
	}
	
	/**
	* Gets the current play position measure count.
	*/
	get measureCount()
	{
		return this.measure_cnt;
	}
	
	/**
	* Gets the current play position in beats in the current measure.
	*/
	get beatsInMeasure()
	{
		return this.beats_in_measure;
	}
	
	/**
	* Gets the time signature numerator.
	*/
	get num()
	{
		return this.num;
	}
	
	/**
	* Gets the time signature denominator.
	*/
	get den()
	{
		return this.den;
	}
	
	/**
	* Gets the play state.
	*/
	get playstate()
	{
		return this.playstate;
	}
	
	/**
	* Gets the repeat state.
	*/
	get repeat()
	{
		return this.repeat;
	}
	
	/**
	* Gets Reaper time format.
	*/
	get reaperTimeFormat()
	{
		
		var format = this.timeString;
		
		if (!this.timeUpdated)
		{
			var statusPositionAr = this.timeString.split(".");
			this.timeUpdated=1;
			
			if(statusPositionAr[1]==undefined)
			{
				if(statusPositionAr[0].match(":"))
				{
					this.timeString = Timekeeper.ReaperTime.SECONDS;
				}
				else
				{
					this.timeString = Timekeeper.ReaperTime.SAMPLES;
				}
			}
			else
			{
				if(statusPositionAr[1].length==3)
				{
					if(statusPositionAr[0].match(":"))
					{
						this.timeString = Timekeeper.ReaperTime.SECONDS;
					}
					else
					{
						this.timeString = Timekeeper.ReaperTime.SECONDS;
					}	
				}
				else
				{
					this.timeString = Timekeeper.ReaperTime.MEASURES;
				}
			}
		}
		
		return this.timeString;
	}
	
	/**
	* Static enum.  Defines Reaper time types.
	*/
	static ReaperTime = 
	{
		SECONDS: 1,
		MEASURES: 2,
		SAMPLES: 3
	};
	
	/**
	* A static method that converts a number of seconds to a HR:MIN:SEC string.
	*/
	static convertSecondsToHMSStr(seconds)
	{
		if ((typeof seconds) != 'number')
			throw "seconds must be a number";
		
		var sign = Math.sign(seconds);
		var hours=0;
		var min=0;
		var sec;
		
		seconds = Math.abs(seconds);
		var time = parseFloat(seconds);
		if (time > 3600)
		{	
			hours = Math.floor(time / 3600);
			time -= hours*3600;
		}
		
		if (time > 60)
		{
			min = Math.floor(time / 60);
			time -= min*60;
		}
		
		sec = time.toFixed(3);
		
		time = hours + ":" + min + ":" + sec;
		
		if (sign < 0)
			time = "-" + time;
		
		return time;
	}
	
	/*  Private Methods  */
	update(toks)
	{
		var beatPos = 0;
		var transportPos = 0;
		
		for (var x=0; x < toks.length; x++)
		{
			if (toks.cmd(x)[0] == ReaperComms.beatPosCmd())
			{
				beatPos = x;
				if (beatPos && transportPos)
					break;
			}
			else if (toks.cmd(x)[0] == ReaperComms.transportCmd())
			{
				transportPos = x;
				if (beatPos && transportPos)
					break;
			}
		}
		
		if (beatPos)
		{
			var cmd = toks.cmd(beatPos);
			var posupdated = this.setposInSeconds(cmd[2]);
			var beatupdated = this.setfullBeatPos(cmd[3]);
			var measurecountupdated = this.setmeasureCount(cmd[4]);
			var beatsmeasureupdated = this.setbeatsInMeasure(cmd[5]);
			var numupdated = this.setNum(cmd[6]);
			var denupdated = this.setDen(cmd[7]);
			
			var timeUpdated = posupdated || beatupdated || measurecountupdated || beatsmeasureupdated;
			var sigUpdated = numupdated || denupdated;
			if (timeUpdated || sigUpdated)
			{
				if (timeUpdated)
					this.timeObservers.notifyListeners(this);
				
				if (sigUpdated)
					this.sigObservers.notifyListeners(this);
					
				this.observers.notifyListeners(this);
			}
		}
		
		if (transportPos)
		{
			var cmd = toks.cmd(transportPos);
			var playstateUpdated = this.setPlayState(cmd[1]);
			var repeatUpdated = this.setRepeat(cmd[3]);
			
			if (playstateUpdated || repeatUpdated)
			{
				this.stateObservers.notifyListeners(this);
				this.observers.notifyListeners(this);
			}
			
			// this.timeUpdated=0;
			// this.timeString = toks.cmd(transportPos)[4];
		}
	}
	
	setPlayState(state)
	{
		var updated = 0;
		state = parseInt(state);
		
		if (this.playstate != state)
		{
			this.playstate = state;
			updated = 1;
		}
		
		return updated;
	}
	
	setRepeat(repeat)
	{
		var update = 0;
		repeat = parseInt(repeat);
		
		if (this.repeat != repeat)
		{
			this.repeat = repeat;
			update = 1;
		}
		
		return update;
	}
	
	setposInSeconds(pos)
	{
		var updated = 0;
		if (pos != this.position_seconds)
		{
			this.position_seconds = pos;
			updated =1;
		}
		
		return updated;
	}
	
	setfullBeatPos(pos)
	{
		var updated = 0;
		if (pos != this.full_beat_position)
		{
			this.full_beat_position = pos;
			updated =1;
		}
		
		return updated;
	}
	
	setmeasureCount(count)
	{
		var updated = 0;
		if (count != this.measure_cnt)
		{
			this.measure_cnt = count;
			updated =1;
		}
		
		return updated;
	}
	
	setbeatsInMeasure(count)
	{
		var updated = 0;
		if (count != this.beats_in_measure)
		{
			this.beats_in_measure = count;
			updated =1;
		}
		
		return updated;
	}
	
	setNum(num)
	{
		var updated = 0;
		if (num != this.num)
		{
			this.num = num;
			updated =1;
		}
		
		return updated;
	}
	
	setDen(den)
	{
		var updated = 0;
		if (den != this.den)
		{
			this.den = den;
			updated =1;
		}
		
		return updated;
	}
}

/**
* This class maintains the time diplay at the top of the transport section, including the current time, time units, and signature.
*/
class TimeDisplay
{
	//DOM references
	statusDisplay;
	timeUnits;
	tsNum;
	tsDen;
	
	//Internal config
	mode;
	num=-1;
	den=-1;
	time=-1;
	joggerPos=-2;
	
	//External object references
	jogger;
	comms;
	timekeep;
	
	/**
	* @param {Jogger} jogger is a reference to the Jogger object.
	*/
	constructor(jogger)
	{
		if (!(jogger instanceof Jogger))
			throw "Parameter must be a Jogger object";
		
		this.statusDisplay = document.getElementById("status");
		this.timeUnits = document.getElementById("timeUnits");
		this.tsNum = document.getElementById("tsNum");
		this.tsDen = document.getElementById("tsDen");
		
		if (!this.statusDisplay)
			throw "Unable to find status display DOM object";
		if (!this.timeUnits)
			throw "Unable to find time units display DOM object";
		
		//Configure the object
		this.jogger = jogger;
		this.statusDisplay.style.fill = "#a8a8a8";
		this.setDisplayMode(TimeDisplay.timeDisplayMode.SECONDS);
		this.statusDisplay.onclick = () => {this.prompt_seek();};
		
		//Register as a listener in the timekeeper class.
		this.comms = new ReaperComms();
		this.timekeep = new Timekeeper();
		this.timekeep.registerTimeListener((keeper) => {this.updateTime(keeper);});
	}
	
	/**
	* This function launches a dialog box and asks the user where to jump to in the project.
	*/
	prompt_seek() 
	{
		if (this.timekeep.playstate != Transport.playState.REC && this.timekeep.playstate != Transport.playState.RECPAUSED) 
		{
			var seekto = prompt("Seek to position:", this.statusDisplay.textContent);
			if (seekto != null) 
			{
				this.comms.jumpToPlaybackPos(seekto);
			}
		}
	}
	
	/**
	* Sets the diplay mode to either seconds or bars/beats.
	* @param {number} The mode to switch to.  See the static enum timeDisplayMode.
	*/
	setDisplayMode(mode) 
	{
		if (mode == TimeDisplay.timeDisplayMode.SECONDS)
		{
			this.timeUnits.textContent = "Hours:Minutes:Seconds.MS"
		}
		else if (mode == TimeDisplay.timeDisplayMode.BARS)
		{
			this.timeUnits.textContent = "Bars/Beats";
		}
		else
			throw "Invalid display mode";
		
		this.mode = mode;
	}
	
	/**
	* An enum for seconds (1) and bars (0).
	*/
	static timeDisplayMode =
	{
		SECONDS: 1,
		BARS: 0
	}
	
	updateTime(timekeeper) 
	{
		this.updateTimeDisplay(timekeeper.posInSeconds, timekeeper.measureCount, timekeeper.beatsInMeasure);
	}
	
	updateTimeDisplay(posInSeconds, measures, beats)
	{
		if (this.mode == TimeDisplay.timeDisplayMode.SECONDS)
		{
			var time = posInSeconds;
			if (time != this.time)
			{
				var hours=0;
				var min=0;
				var sec;

				this.time = time;
				time = parseFloat(time);
				if (time > 3600)
				{	
					hours = Math.floor(time / 3600);
					time -= hours*3600;
				}
				
				if (time > 60)
				{
					min = Math.floor(time / 60);
					time -= min*60;
				}
				
				sec = time.toFixed(3);
				
				time = hours + ":" + min + ":" + sec;
				this.statusDisplay.textContent = time;
			}
		}
		else
		{
			var time = measures + "/" + Math.floor(beats);
			if (time != this.time)
			{
				this.time = time;
				this.statusDisplay.textContent = time;
			}
		}
	}
}

class TimeSignature
{
	//Internal config
	num=-1;
	den=-1;
	
	//GUI references
	tsNum;
	tsDen;
	tsLine;
	
	//External objects
	comms;
	timekeeper;
	
	constructor()
	{
		//Look up GUI elements
		this.tsNum = document.getElementById("tsNum");
		this.tsDen = document.getElementById("tsDen");
		this.tsLine = document.getElementById("meterLine");
		
		//Make sure they were found
		if (!this.tsNum)
			throw "Unable to find time signature numerator display DOM object";
		if (!this.tsDen)
			throw "Unable to find time signature denominator display DOM object";
		if (!this.tsLine)
			throw "Unable to find time signature line DOM object";
			
		//Attach events to click
		this.tsNum.onclick = () => {this.promptSignatureChange();};
		this.tsDen.onclick = () => {this.promptSignatureChange();};
		this.tsLine.onclick = () => {this.promptSignatureChange();};
		
		//Register as a listener in timekeeper
		this.timekeeper = new Timekeeper();
		this.timekeeper.registerSignatureListener((timekeeper) => {this.updateSignature(timekeeper)});
		
		// <script type="text/template" id="demo1_template">
			// Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi a sapien lacus. Ut a eros quis lacus auctor aliquet eu.
			// <input type="text" class="text-field" placeholder="title">
			// <textarea class="text-field" placeholder="content"></textarea>
		// </script>
		
		var s = document.createElement("script");
		s.type = "text/template";
		s.id = "meterSet";
		$("head").append(s);
		
		var i = document.createElement("input");
		i.type = "text";
		i.class = "text-field";
		i.placeholder = "title";
		
		s.appendChild(i);
	}
	
	promptSignatureChange()
	{
		// new Dialogify('#meterSet')
			// .title('Dialogify')
			// .buttons([
				// {
					// text: 'Cancel',
					// click: function(e){
						// console.log('cancel click');
						// this.close();
					// }
				// },
				// {
					// text: 'OK',
					// type: Dialogify.BUTTON_PRIMARY,
					// click: function(e){
						// console.log('ok click, title value: ' + this.$content.find('textarea.text-field').val());
					// }
				// }
			// ])
			// .showModal();
	}
	
	updateSignature(timekeeper) 
	{
		this.updateNum(timekeeper.num);
		this.updateDen(timekeeper.den);
	}
	
	updateNum(num)
	{
		if (num != this.num)
		{
			this.num = num;
			this.tsNum.textContent = num;
		}
	}
	
	updateDen(den)
	{
		if (den != this.den)
		{
			this.den = den;
			this.tsDen.textContent = den;
		}
	}
}

/**
* Abort recording button.  Stops recording and deletes clips in Reaper.
*/
class AbortButton extends ToggleButton
{
	comms;
	
	abortTextButton;
	abortCrossButton;
	
	constructor()
	{
		var abort = document.getElementById("abort");
		if (!abort)
			throw "Unable to locate abort button DOM object";
		
		var abortText = document.getElementById("abort_text");
		var abortCross = document.getElementById("abort_cross");
		super([abortText,abortCross]);
		
		this.abortTextButton = new ToggleButton(abortText);
		this.abortCrossButton = new ToggleButton(abortCross);
		
		this.comms = new ReaperComms();
		abort.onclick = () => {this.promptAbort();};
		
	}
	
	/**
	* Prompts the user about aborting and executes.
	*/
	promptAbort() 
	{
		if (confirm("abort recording? contents will be lost!"))
			this.comms.stopRecordAndDiscardClips();
	} 
}

/**
* Green beat display ring around the play button.
*/
class BeatDisplay
{
	playLineCirc = 301.1;
	playLine;
	drawnSig;
	drawnBeat;
	jogger;
	animations;
	timer=0;
	fade;
	fadeTime=1200;
	timekeeper;
	
	constructor(jogger)
	{
		if (!(jogger instanceof Jogger))
			throw "Jogger parameter must be an instance of the Jogger class";
		
		this.playLine = document.querySelector('#playLine'); 
		this.playLine.setAttributeNS(null, "stroke-dasharray", this.playLineCirc);
		
		this.timekeeper = new Timekeeper();
		this.timekeeper.registerListener((timekeeper) => {this.updateMeter(timekeeper);});
		this.animations = AbstractAnimationEngine.getSuggestedEngine();
		this.jogger = jogger;
		jogger.registerListener((jogger)=>{this.jogListener(jogger)});
	}
	
	updateMeter(timekeeper)
	{
		//If we do let's update the play line object.
		if (!this.jogger.mouseIsDown)
		{
			var thisSig=timekeeper.num;
			if (this.drawnSig!=thisSig)
			{
				var playLineArc = this.playLineCirc - (this.playLineCirc / thisSig);
				this.playLine.setAttributeNS(null, "stroke-dashoffset", playLineArc);
				this.drawnSig = thisSig;
			}
			
			var thisBeat=Math.floor(timekeeper.beatsInMeasure);
			if (this.drawnBeat!=thisBeat)
			{
				var playLineRotate = (360 / thisSig) * thisBeat;
				this.playLine.setAttribute("transform","rotate(" + playLineRotate + ",151.8,52.4)");
				this.drawnBeat = thisBeat;
			}
		}
		else
		{
			if (this.drawnSig!=thisSig)
			{
				var playLineArc = 0;
				this.playLine.setAttributeNS(null, "stroke-dashoffset", playLineArc); //dasharray
				this.drawnSig = -1;
				this.drawnBeat = -1;
			}
			
			if (!this.timer)
			{
				this.fade=1;
				this.altFade();
			}
		}
	}
	
	jogListener(jogger)
	{
		if (!this.jogger.mouseIsDown)
		{
			clearTimeout(this.timer);
			this.timer=0;
			this.animations.fade(this.playLine, 1, 100);
			this.updateMeter(this.timekeeper);
		}
	}
	
	altFade()
	{
		this.fade = !this.fade;
		this.animations.fade(this.playLine, this.fade, this.fadeTime);
		this.timer = setTimeout(()=> {this.altFade()}, this.fadeTime);
	}
}

/**
* Record Button object.  Starts recording.
*/
class RecordButton extends ToggleButton
{
	comms;
	recArmedCounter;
	
	/**
	* @param {RecArmCounter} recArmCounter is a reference to the record amred count object.
	*/
	constructor(recArmCounter)
	{
		if (!(recArmCounter instanceof RecArmCounter))
			throw "Invalid RecArmCounter object reference";
		
		var recordOff = document.getElementById("record_off");
		var recordOn = document.getElementById("record_on");
		super(recordOn, recordOff);
		
		//Initialize internal variables
		this.recArmedCounter = recArmCounter;
		this.comms = new ReaperComms();
		
		//Add event listener
		document.getElementById("button-record").onclick = () => {this.rec();};
	}
	
	/**
	* Starts recording.  If no channels are rec aremed it will prompt to confirm first.
	*/
	rec() 
	{
		//Start recording if we have at least one channel rec armed
		//Or if the user forces record, start recording.
		if (this.recArmedCounter.armedCount > 0 || confirm("No tracks are armed, start record?")) 
			this.comms.startRecord();
	}
}

/**
* Jogger object.  The control that fast-forwards and rewinds at the top of the screan.
*/
class Jogger extends AbstractMovableObjectEventHandler
{
	jogger;
	wheel;
	wheelClipRect;
	joggerWidth;
	jOffsetX = 0; 
	jMOffsetX;
	direction = 0;
	timer;
	multiplier = 5;
	control;
	tau;
	observers;
	
	//External objects
	comms;
	animations;
	timeKeeper;
	
	/**
	* @param {float} is the time between sending Reaper updates when the mouse is down on the Jogger control.
	*/
	constructor(refreshTime)
	{
		//Check refresh time
		if (!('number' == typeof refreshTime))
		{
			refreshTime = parseFloat(refreshTime);
			
			if (!('number' == typeof refreshTime))
				throw "Refresh Time parameter must be a number or a string of a number"
		}
		
		if (refreshTime <= 0)
			throw "Refresh Time must be a positive number";
		
		//First build the parent object.
		var jogger = document.getElementById("jogger");
		super(jogger);
		
		this.jogger = jogger;
		this.wheel = document.getElementById("wheel");
		this.wheelClipRect = document.getElementById("clip_rect");
		
		if (!this.wheel)
			throw "Unable to locate wheel DOM object reference";
		if (!this.wheelClipRect)
			throw "Unable to locate wheel clip rectangle DOM object reference";
		
		this.joggerWidth = jogger.getBoundingClientRect()["width"];
		this.observers = new Observable();
		
		this.animations = AbstractAnimationEngine.getSuggestedEngine();
		this.comms = new ReaperComms();
		this.timeKeeper = new Timekeeper();
		
		this.tau = refreshTime/(1000/60);
		
		var speeds=
		{
			1: (e) => {this.coarse(e)},
			2: (e) => {this.fine(e)},
			3: (e) => {this.fast(e)}
		};
		
		this.control = new MultiClickHandler(jogger, speeds);
	}
	
	/**
	* Registers an object/function as a listener of the Jogger object.
	* @param {Object} is the object/function to register as a listener.
	*/
	registerListener(obj)
	{
		this.observers.registerListener(obj);
	}
	
	/**
	* Unregisters an object/function as a listener of the Jogger object.
	* @param {Object} is the object/function to unregister as a listener.
	*/
	unregisterListner(obj)
	{
		this.observers.unregisterListner(obj);
	}
	
	/**
	* Gets the direction that the Jogger is pointing in.
	*/
	get direction()
	{
		return this.direction;
	}
	
	mouseDownInit(event)
	{
		this.timer = setInterval(() => {this.joggerCounter()}, 17);
		this.coarse(event);
		this.observers.notifyListeners(this);
	}
	
	cleanup(event)
	{
		//Stop internal
		clearInterval(this.timer);
		
		//Send final time
		var time = this.timeKeeper.posInSeconds;
		time = parseFloat(time);
		time = Timekeeper.convertSecondsToHMSStr(time);
		this.comms.jumpToPlaybackPos(time);
		
		//Run reset animation
		this.animations.rotate(this.wheel, 0, 159, 181);
		this.animations.rotate(this.wheelClipRect, 0, 159, 181);
		
		//Reset variables
		this.direction = 0;
		this.jOffsetX = 0;
		this.observers.notifyListeners(this);
	}
	
	mouseMoveHandler(event)
	{
		if (event.changedTouches != undefined) 
			//we're doing touch stuff
			this.jOffsetX = (event.changedTouches[0].pageX - this.mouseDownX) / this.joggerWidth;
		else 
			this.jOffsetX = (event.pageX - this.mouseDownX) / this.joggerWidth;
		
		if(this.jOffsetX>0.5)
			this.jOffsetX=0.5;
		
		if(this.jOffsetX<-0.5)
			this.jOffsetX=-0.5;
		
		this.joggerRotate(this.jOffsetX*90);
		this.jMOffsetX = this.jOffsetX;
		this.direction = Math.sign(this.jOffsetX);
	}
	
	joggerCounter()
	{
		var time = this.timeKeeper.posInSeconds;
		time = parseFloat(time);
		
		time += this.jOffsetX * this.multiplier;
		if (time < 0)
			time = 0;
		
		time = Timekeeper.convertSecondsToHMSStr(time);
		
		this.comms.jumpToPlaybackPos(time);
	}
	
	joggerRotate(angle)
	{
		var wheelAngle = "rotate(" + angle + " 159 181)";
		var clipAngle = "rotate(" + (-1 * angle) + " 159 181)";
		this.wheel.setAttributeNS(null, "transform", wheelAngle);
		this.wheelClipRect.setAttributeNS(null, "transform", clipAngle);
	}
	
	fine(e)
	{
		this.multiplier=0.18 * this.tau;
		this.handleEvent(e);
	}
	
	coarse(e)
	{
		this.multiplier=1.13 * this.tau;
		this.handleEvent(e);
	}
	
	fast(e)
	{
		this.multiplier=3.4 * this.tau;
		this.handleEvent(e);
	}
}
	

/**
* Rec arm counter.  Keeps track of the number of channels record armed and displays it on screen.
*/
class RecArmCounter extends ToggleButton
{
	//State variables
	armedCount=0;
	prevArmedCount=-1;
	enabled=0;
	tracksRecArmedArray = [];
	tracksRegistered = 0;
	observers;
	
	//DOM references
	armedTextCtrl;
	armedCountCtrl;
	
	/**
	* @param {TrackManager} trackList is a reference to a track manager object.
	*/
	constructor()
	{
		//Set up DOM references.
		var text = document.getElementById("armed_text");
		var count = document.getElementById("armed_count");
		super([text, count], null, 1);
		this.armedTextCtrl = text;
		this.armedCountCtrl = count;
		
		//Next let's register this object as a listener to the TrackManager object
		var trackList = new TrackManager();
		trackList.registerListener((trackManager) => {this.updateTrackCount(trackManager);});
		
		//Now let's update the dispay
		this.observers = new Observable();
	}
	
	/**
	* This function takes in a function and stores it internally to be called whenever the time is updated.
	* @param {Object} listener is a function to store and call.
	*/
	registerListener(listener)
	{
		this.observers.registerListener(listener);
	}
	
	/**
	* This function takes in a function and unregisters it from the internal update listerner database.
	* @param {Object} listener is a function to unregister.
	*/
	unregisterListener(listener)
	{
		this.observers.unregisterListener(listener);
	}
	
	/**
	* Gets the current number of rec armed tracks.
	*/	
	get armedCount()
	{
		return this.armedCount;
	}
	
	/*  Private Methods  */
	update(track)
	{
		//if (!(track instanceof AbstractTrack))
		//	throw "Object reference must be a track";
		while (this.tracksRecArmedArray.length < track.id)
			this.tracksRecArmedArray.push(0);
		
		this.tracksRecArmedArray[track.id] = track.recArmed;
		this.armedCount=0;
		
		for(var x=0; x<this.tracksRecArmedArray.length; x++)
			this.armedCount += this.tracksRecArmedArray[x];
		
		this.updateDisplay();
	}
	
	updateTrackCount(trackManager)
	{
		if (!(trackManager instanceof TrackManager))
			throw "Parameter not an instance of a TrackManager object";
		
		//If new tracks have been created let's register this object as a listener to them.
		if (this.tracksRegistered < trackManager.trackCount)
		{
			for (var x=this.tracksRegistered; x<trackManager.trackCount; x++)
			{
				var track = trackManager.getTrackByID(x);
				track.registerListener((t) => {this.update(t);});
			}
			
			this.tracksRegistered = trackManager.trackCount;
		}
	}
	
	updateDisplay()
	{
		if (this.armedCount != this.prevArmedCount)
		{
			//Notify listeners
			this.observers.notifyListeners(this);
			//Update armed count display.
			this.armedCountCtrl.textContent = this.armedCount;
			
			//We only need to change colors if we go down to zero or went up from zero.
			if (this.armedCount==0 || this.prevArmedCount==0)
			{
				this.armedCountCtrl.setAttributeNS(null, "fill", ((this.armedCount==0)?"#5D3729":"#00D87F"));
				this.armedTextCtrl.setAttributeNS(null, "fill", ((this.armedCount==0)?"#5D3729":"#00D87F"));
			}
		
			this.prevArmedCount = this.armedCount;
		}
	}
};

/**
* This is an immutable wrapper for the Rec Arm Counter object.  For the interface see Rec Arm Counter.
*/
class ImmutableRecArmCounter extends RecArmCounter
{
	recArmCounter;

	/**
	* @param {RecArmCounter} is a Rec Arm Counter object to wrap around.
	*/
	constructor(recArmCounterButton)
	{	
		this.recArmCounter = recArmCounterButton;
	}

	registerListener(listener)
	{
		this.recArmCounter.registerListener(listener);
	}

	unregisterListener(listener)
	{
		this.recArmCounter.unregisterListener(listener);
	}

	enable()
	{
		throw "Can not mutate an immutable object";
	}
	
	disable()
	{
		throw "Can not mutate an immutable object";
	}
	
	get armedCount()
	{
		return this.recArmCounter.armedCount;
	}
};

/**
* Track Add button.  Sends a signal to Reaper to add a track whenever clicked.  This is a single-state button and has no methods that need to be called.
*/
class TrackAddButton
{
	trackAddDiv;
	comms;
	handler;
	
	constructor(trackAddDiv)
	{
		if (!(trackAddDiv instanceof SVGElement))
			throw "Track Add Div must be an SVG element"
		
		var fs =
		{
			1: (e) => {this.addSingleTrack(e)},
			2: (e) => {this.addMultipleTracks(e)}
		};
		
		this.comms = new ReaperComms();
		this.handler = new MultiClickHandler(trackAddDiv, fs);
	}
	
	/**
	* Sends a signal to Reaper to add a single track.
	*/
	addSingleTrack(e)
	{
		this.comms.addTrack();
	}
	
	/**
	* Queries a user for the number of tracks to add to Reaper and adds that many tracks.
	*/
	addMultipleTracks(e) 
	{
		var tracks = prompt("Number of Tracks to Add:", 0);
		tracks = parseInt(tracks);
		
		if (tracks > 0)
		{
			for (var x = 0; x < tracks; x++)
				this.comms.addTrack();
		}
	}
};


// class RegionDisplay
//comms.wwr_req_recur("MARKER;REGION",500);
//Markers variables
// var pos, newPos = -1;
// var previ=-1, thisi=-1, nexti=-1;
// {
// var resetRegionList = function (tok, line)
// {
	// g_regions = []; 
// }

// var pushRegion = function (tok, line)
// {
	// g_regions.push(tok);
// }
   
// var resetMarkersList = function (tok, line)
// {
	// g_markers = [];
// }

// function lumaOffset(c)
// {
    // var c = c.substring(1);
    // var rgb = parseInt(c, 16);
    // var r = (rgb >> 16) & 0xff;
    // var g = (rgb >>  8) & 0xff;
    // var b = (rgb >>  0) & 0xff;
    // var luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // if (luma < 150) 
	// {
		// r = r+150; 
		// g = g+150; 
		// b = b+150;
	// }
	// if (luma > 150) 
	// {
		// r = r-120; 
		// g = g-120; 
		// b = b-120;
	// }
    
	// //Let's make sure our RGB values are within range.
	// if(r<0)
		// r=0;
	// if(g<0)
		// g=0;
	// if(b<0)
		// b=0;
    // if(r>255)
		// r=255; 
	// if(g>255)
		// g=255; 
	// if(b>255)
		// b=255;
	
    // return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
// }

// var parseRegionList = function (tok, line)
// {
	// //Let's only proceed if we have regions/markers to process
	// if (g_regions.length > 0 || g_markers.length > 0)
	// {
		// //Here be dragons......
		
		// //assemble mrMap array : time, marker number, region start number, region end number.
		// for (var i=0; i<g_regions.length; i++) 
			// //Give uncoloured regions a colour.
			// if(g_regions[i][5]==0)
				// g_regions[i][5]=25198720; 
		
		// for (var i=0; i<g_markers.length; i++) 
			// //Give uncoloured markers a colour.
			// if(g_markers[i][4]==0)
				// g_markers[i][4]=25198720;
			
		// var mrMapAr = [];
		// for (var i=0; i<g_regions.length*2; i++) 
		// {
			// mrMapAr[i] = [];
			// if(i<g_regions.length)
			// {
				// //add the region starts to the ar
				// mrMapAr[i][0] = g_regions[i][3];
				// mrMapAr[i][2] = g_regions[i][2];
			// }
			// else
			// {
				// //add the region ends to the ar
				// mrMapAr[i][0] = g_regions[i-g_regions.length][4];
				// mrMapAr[i][3] = g_regions[i-g_regions.length][2];
			// }
		// }
		
		// for (var i=0; i<g_markers.length; i++) 
		// {
			// //add the markers to the ar
			// mrMapAr[i+(g_regions.length*2)] = [];
			// mrMapAr[i+(g_regions.length*2)][0] = g_markers[i][3];
			// mrMapAr[i+(g_regions.length*2)][1] = g_markers[i][2];
		// }
		
		// for (var i=0; i<mrMapAr.length; i++) 
		// {
			// //prep times for sorting
			// posToSix = parseFloat(mrMapAr[i][0]).toFixed(6);
			// mrMapAr[i][0] = parseFloat(posToSix);
		// }
		
		// mrMapAr.sort(
			// function(a, b) 
			// {
				// //sort into time order
				// return (a[0] === b[0] ? 0 : (a[0] < b[0] ? -1 : 1));
			// });
		
		// function mergeAt(idx)
		// {
			// if(mrMapAr[i-1][idx])
				// a=mrMapAr[i-1][idx]
			// else
				// a=0;
			
			// if(mrMapAr[i][idx])
				// b=mrMapAr[i][idx]
			// else
				// b=0;
			// mrMapAr[i-1][idx] = parseFloat(a)+parseFloat(b); 
		// }
		
		// var mergeDone=0;        
		// for (var i=1; i<mrMapAr.length; i++) 
		// {
			// //merge cells if at same time, delete the duplicate
			// if(mrMapAr[i-1] && mrMapAr[i][0]===mrMapAr[i-1][0])
			// {
				// mergeAt(1); mergeAt(2); mergeAt(3);
				// mrMapAr.splice(i,1);
			// }
			// if(i==(mrMapAr.length-1))
				// mergeDone=1;
		// }
		
		// var prevl=-1, thisl=-1, nextl=-1;
		// if(mergeDone==1)
		// {
			// for (var i=0; i<mrMapAr.length; i++)
			// {
				// var diff = (mrMapAr[i][0] - pos);
				// if(diff<0 && i>prevl)
					// prevl = i
				// else if (diff==0) 
					// thisl = i;
				// else if(diff>0 && i>nextl)
				// {
					// nextl = i; 
					// break;
				// }
			// }
		// }
			
		// function getValuesFromId(array,id,colourIdx) 
		// {
			// for (var i=0, len=array.length; i<len; i++) 
				// if(array[i][2]==id)
					// return [id,(array[i][1]),(array[i][colourIdx])]
					
			// return [0,0,0];
		// }
			 
		// var nextPrevSvg = document.getElementById("nextPrev")
		// if((pos!=newPos || mrMapAr.length!=newMrMapLength) && mergeDone==1 && nextPrevSvg)
		// {
			// var rIdxAsg = [];
			// // 4 is the maximum drawable number of regions
			// search: 
				// for(i=0; i<4; i++)
				// {      
					// //region end at prev?
					// if(mrMapAr[prevl] && mrMapAr[prevl][3]>=1)
					// {               
						// var q = parseFloat(mrMapAr[prevl][3]);
						// if(rIdxAsg.indexOf(q)==-1)
						// {
							// rIdxAsg[i] = q; 
							// continue search;
						// }
					// }
					
					// if(mrMapAr[prevl] && mrMapAr[prevl][2]>=1)
					// {               
						// //region start at prev?
						// var q = parseFloat(mrMapAr[prevl][2]);
						// if(rIdxAsg.indexOf(q)==-1)
						// {
							// rIdxAsg[i] = q; 
							// continue search;
						// }
					// }
					
					// if(mrMapAr[thisl] && mrMapAr[thisl][3]>=1)
					// {               
						// //region end at this?
						// var q = parseFloat(mrMapAr[thisl][3]);
						// if(rIdxAsg.indexOf(q)==-1)
						// {
							// rIdxAsg[i] = q;
							// continue search;
						// }
					// }
					
					// if(mrMapAr[thisl] && mrMapAr[thisl][2]>=1)
					// {               
						// //region start at this?
						// var q = parseFloat(mrMapAr[thisl][2]);
						// if(rIdxAsg.indexOf(q)==-1)
						// {
							// rIdxAsg[i] = q;
							// continue search;
						// }
					// }
					
					// if(mrMapAr[nextl] && mrMapAr[nextl][3]>=1)
					// {               
						// //region end at next?
						// var q = parseFloat(mrMapAr[nextl][3]);
						// if(rIdxAsg.indexOf(q)==-1)
						// {
							// rIdxAsg[i] = q; 
							// continue search;
						// }
					// }
					
					// if(mrMapAr[nextl] && mrMapAr[nextl][2]>=1)
					// {               
						// //region start at next?
						// var q = parseFloat(mrMapAr[nextl][2]);
						// if(rIdxAsg.indexOf(q)==-1)
							// rIdxAsg[i] = q;
					// }
				// }
			
			// function getValFromAr(array,id,idLoc,valLoc) 
			// {
				// for (var i=0, len=array.length; i<len; i++) 
				// {
					// if(array[i][idLoc]==id)
						// return array[i][valLoc];
				// }

				// return;
			// }
			
			// for(i=1;i<5;i++)
			// {
				// this['r'+i+'StalkLx'] = 45.6; 
				// this['r'+i+'StalkRx'] = 273.1;
				// if(rIdxAsg[i-1] && rIdxAsg[i-1]>=0)
				// {
					// this['r'+i+'Idx'] = rIdxAsg[i-1];
					// this['r'+i+'Name'] = getValFromAr(g_regions,rIdxAsg[i-1],2,1);
					// this['col'+i] = getValFromAr(g_regions,rIdxAsg[i-1],2,5);
					// this['rCol'+i] = "#" + (this['col'+i]|0x1000000).toString(16).substr(-6);
					// if(prevl>=0 && mrMapAr[prevl][3] == rIdxAsg[i-1])
						// this['r'+i+'StalkRx'] = 102.5;
					// if(prevl>=0 && mrMapAr[prevl][2] == rIdxAsg[i-1])
						// this['r'+i+'StalkLx'] = 102.5;
					// if(thisl>=0 && mrMapAr[thisl][2] == rIdxAsg[i-1])
						// this['r'+i+'StalkLx'] = 159.4;
					// if(thisl>=0 && mrMapAr[thisl][3] == rIdxAsg[i-1])
						// this['r'+i+'StalkRx'] = 159.4;
					// if(nextl>=0 && mrMapAr[nextl][2] == rIdxAsg[i-1])
						// this['r'+i+'StalkLx'] = 216.2;
					// if(nextl>=0 && mrMapAr[nextl][3] == rIdxAsg[i-1])
						// this['r'+i+'StalkRx'] = 216.2;
					
					// document.getElementById('region'+i).setAttributeNS(null, "visibility", "visible");
					// document.getElementById('r'+i+'Rect').setAttributeNS(null, "fill", this['rCol'+i]);
					// document.getElementById('r'+i+'StalkL').setAttributeNS(null, "x1", this['r'+i+'StalkLx']);
					// document.getElementById('r'+i+'StalkL').setAttributeNS(null, "x2", this['r'+i+'StalkLx']);
					// document.getElementById('r'+i+'StalkR').setAttributeNS(null, "x1", this['r'+i+'StalkRx']);
					// document.getElementById('r'+i+'StalkR').setAttributeNS(null, "x2", this['r'+i+'StalkRx']);
					// this['r'+i+'RectW'] = (this['r'+i+'StalkRx']) - (this['r'+i+'StalkLx']);
					// document.getElementById('r'+i+'Rect').setAttributeNS(null, "x", this['r'+i+'StalkLx']);
					// document.getElementById('r'+i+'Rect').setAttributeNS(null, "width", this['r'+i+'RectW']);
					// if(!this['r'+i+'Name']){this['r'+i+'Name'] = this['r'+i+'Idx']}
					// document.getElementById('r'+i+'Name').textContent = this['r'+i+'Name'];
					// document.getElementById('r'+i+'Name').setAttributeNS(null, "fill", lumaOffset(this['rCol'+i]));
					// this['r'+i+'NamePos'] = this['r'+i+'StalkLx'] + ((this['r'+i+'StalkRx']-this['r'+i+'StalkLx'])/2);
					// document.getElementById('r'+i+'Name').setAttributeNS(null, "transform", "matrix(1 0 0 1 "+this['r'+i+'NamePos']+" 31)");
				// }
				// else
				// {
					// document.getElementById('region'+i).setAttributeNS(null, "visibility", "hidden");
				// }
			// }
							
			// if(mrMapAr[prevl] && mrMapAr[prevl][1]>=1)
			// {
				// var mPrevIdx = mrMapAr[prevl][1];
				// var mPrevName = getValFromAr(g_markers,mPrevIdx,2,1);
				// var mPrevCol = getValFromAr(g_markers,mPrevIdx,2,4);
				// mPrevCol = "#" + (mPrevCol|0x1000000).toString(16).substr(-6);
				// document.getElementById("marker1").setAttributeNS(null, "visibility", "visible");
				// document.getElementById("marker1Bg").setAttributeNS(null, "fill", mPrevCol);
				// document.getElementById("marker1Number").textContent = mPrevIdx;
				// document.getElementById("marker1Number").setAttributeNS(null, "fill", lumaOffset(mPrevCol));
				// document.getElementById("prevMarkerName").textContent = (!mPrevName) ?("unnamed"):(mPrevName);
			// }
			// else
			// {
				// document.getElementById("marker1").setAttributeNS(null, "visibility", "hidden");
			// }
			
			// if(mrMapAr[thisl] && mrMapAr[thisl][1]>=1)
			// {
				// var mThisIdx = mrMapAr[thisl][1];
				// var mThisName = getValFromAr(g_markers,mThisIdx,2,1);
				// var mThisCol = getValFromAr(g_markers,mThisIdx,2,4);
				// mThisCol = "#" + (mThisCol|0x1000000).toString(16).substr(-6);
				// document.getElementById("marker2").setAttributeNS(null, "visibility", "visible");
				// document.getElementById("marker2Bg").setAttributeNS(null, "fill", mThisCol);
				// document.getElementById("marker2Number").textContent = mThisIdx ;
				// document.getElementById("marker2Number").setAttributeNS(null, "fill", lumaOffset(mThisCol));
				// document.getElementById("atMarkerName").textContent = (!mThisName) ?("unnamed"):(mThisName);
			// }
			// else
			// {
				// document.getElementById("marker2").setAttributeNS(null, "visibility", "hidden");
			// }
			
			// if(mrMapAr[nextl] && mrMapAr[nextl][1]>=1)
			// {
				// var mNextIdx = mrMapAr[nextl][1];
				// var mNextName = getValFromAr(g_markers,mNextIdx,2,1);
				// var mNextCol = getValFromAr(g_markers,mNextIdx,2,4);
				// mNextCol = "#" + (mNextCol|0x1000000).toString(16).substr(-6);
				// document.getElementById("marker3").setAttributeNS(null, "visibility", "visible");
				// document.getElementById("marker3Bg").setAttributeNS(null, "fill", mNextCol);
				// document.getElementById("marker3Number").textContent = mNextIdx ;
				// document.getElementById("marker3Number").setAttributeNS(null, "fill", lumaOffset(mNextCol));
				// document.getElementById("nextMarkerName").textContent = (!mNextName) ?("unnamed"):(mNextName);
			// }
			// else
			// {
				// document.getElementById("marker3").setAttributeNS(null, "visibility", "hidden");
			// }
			
			// if (prevl>=0)
			// {
				// homeIconVis = "hidden"; 
				// prevIconVis = "visible";
			// }
			// else
			// {
				// homeIconVis = "visible"; prevIconVis = "hidden";
				// if (pos>0)
				// {
					// document.getElementById("marker1").setAttributeNS(null, "visibility", "visible");
					// document.getElementById("prevMarkerName").textContent = "HOME";
					// document.getElementById("marker1Number").textContent = "H";
					// document.getElementById("marker1Bg").setAttributeNS(null, "fill", "#1a1a1a");
					// document.getElementById("marker1Number").setAttributeNS(null, "fill", "#A8A8A8");
				// }
				// else
				// {
					// document.getElementById("marker2").setAttributeNS(null, "visibility", "visible");
					// document.getElementById("atMarkerName").textContent = "HOME";
					// document.getElementById("marker2Number").textContent = "H";
					// document.getElementById("marker2Bg").setAttributeNS(null, "fill", "#1a1a1a");
					// document.getElementById("marker2Number").setAttributeNS(null, "fill", "#A8A8A8");
				// }
			// }
				
			// if (thisl<0 && pos!=0)
			// {
				// elAttribute("dropMarker","visibility","visible")
			// }
			// else
			// {
				// elAttribute("dropMarker","visibility","hidden")
			// }
			
			// if (nextl>=0)
			// {
				// endIconVis = "hidden"; nextIconVis = "visible"; 
			// }
			// else 
			// {
				// document.getElementById("marker3").setAttributeNS(null, "visibility", "visible");
				// document.getElementById("nextMarkerName").textContent = "END";
				// document.getElementById("marker3Number").textContent = "E";
				// document.getElementById("marker3Bg").setAttributeNS(null, "fill", "#1a1a1a");
				// document.getElementById("marker3Number").setAttributeNS(null, "fill", "#A8A8A8");
				// endIconVis = "visible"; nextIconVis = "hidden"; 
			// }
			
			// elAttribute("iconPrev","visibility",prevIconVis);
			// elAttribute("iconHome","visibility",homeIconVis);
			// elAttribute("iconNext","visibility",nextIconVis);
			// elAttribute("iconEnd","visibility",endIconVis);
			
			// newPos = pos;
			// newMrMapLength = mrMapAr.length;
		// }
	// }
// }

// var parseMarkerList = function (tok, line)
// {
	// pos = parseFloat(playPosSeconds);
	// previ=-1; 
	// thisi=-1;
	// nexti=-1;
// }

// var pushMarker = function (tok, line)
// {
	// g_markers.push(tok);
// }

// function elAttribute(id,attribute,value)
// {
    // if(document.getElementById(id))
        // document.getElementById(id).setAttributeNS(null, attribute, value);
// }
// }