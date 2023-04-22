//To do:
/*
	3.  High level recurring update interface
	4.  Implement GetSetMediaTrackInfo interface
*/
'use strict';

/**
* Singleton Reaper communications class.  This class handles all communications with Reaper, and updates a list of registered listener functions when there's an update.  This class basically needs to be a singleton because of the way comms are built in this object, which is via the XMLHttpRequest interface.
*/
class ReaperComms
{
	//Static members
	static instance;
	
	//Internal variables
	g_wwr_timer_freq;
	g_wwr_req_list;
	g_wwr_req_recur;
	observers;
	running;
	udpateRecieved;
	g_wwr_req;
	
	//Command storage objects
	commandCollection;
	immCommandCollection;
	
	/**
	* @param {number} minUpdate is the smallest time, in ms, that ReaperComms allows updates to be requested from Reaper.  Ignored if the object has already been built.
	* @param {number} autostart determines wether the comms with Reaper should automatically start at the end of initialization or if it will be started manually later.  Ignored if the object has already been built.
	*/
	constructor(minUpdate = 100, autostart = 0)
	{
		//If the instance isn't created, let's build it.
		if (!ReaperComms.instance)
		{
			//Internal variables
			this.g_wwr_timer_freq = minUpdate;
			this.g_wwr_req_list = "";
			this.g_wwr_req_recur = new Array();
			this.observers = new Observable();
			this.running = 0;
			this.commandCollection = new CommandCollection();
			this.immCommandCollection = new ImmutableCommandCollection(this.commandCollection);
			
			//Init XMLHTTP
			try 
			{
				this.g_wwr_req = new XMLHttpRequest();
			} 
			catch (e1)
			{
				try 
				{ 
					this.g_wwr_req = window.createRequest(); 
				} 
				catch (e2) 
				{
					throw e1;
				}
			}
			  
			//Start the one-off reaper command send interval.
			//Setup events.
			this.g_wwr_req.onreadystatechange = () => {this.handleResponse();};
			
			//Send initial test request.
			this.g_wwr_req.open("GET","/_/" + ";", true);
			this.g_wwr_req.send(null);
			
			//Store the object.
			ReaperComms.instance = this;
			
			//Autostart if needbe
			if (autostart)
				this.startComms();
		}
		
		//Return the instance.
		return ReaperComms.instance;
	}
	
	/**
	* Getter.  Returns a flag indicating whether comms is communicating with Reaper or not.
	*/
	get running()
	{
		return this.running;
	}
	
	/**
	* Starts communicating with Reaper for updates if not already running.
	*/
	startComms()
	{
		if (!this.running)
		{
			this.udpateRecieved = 1;
			this.running = 1;
			this.runInterval = setInterval(() => {this.wwr_run_update();}, this.g_wwr_timer_freq);
		}
	}
	
	/**
	* Stops communicating with Reaper for updates if running.
	*/
	stopComms()
	{
		if (this.running)
		{
			this.running = 0;
			clearInterval(this.runInterval);
		}
	}
	
	/**
	* Getter.  Returns the min update time of the object in ms.
	*/
	get minUpdateTime()
	{
		return this.g_wwr_timer_freq;
	}
	
	/**
	* This function takes in a function, registers it as a listener, and invokes it whenever ReaperComms gets an update from Reaper.
	* @param {Object} listener is a function that is invoked whenever the ReaperComm gets an update.
	*/
	registerListener(func)
	{
		this.observers.registerListener(func);
	}
	
	/**
	* This function unregisters a previously registered function as a listener.
	* @param {Object} listener is a function that needs to be removed as a listener.
	*/
	unregisterListner(func)
	{
		this.observers.unregisterListner(func);
	}

	/**
	* This function sends a command, or series of commands separated by a semicolon, to Reaper once.  To send an update regularly use wwr_req_recur.
	* This is a low-level communication function.  For ease use one of the other high-level communication functions documented below.
	* @param {Object} name is a string or numeric command(s) to be sent to Reaper.
	*/
	wwr_req(name)
	{
		//First clean up the command.
		name = ReaperComms.stripCmd(name);
		
		//Next we add if it's not an empty command.
		if (name != "" && name != ";")
			this.g_wwr_req_list += name;
	}
	
	/**
	* This function sends a command, or series of commands separated by a semicolon, to Reaper every few miliseconds, as specified by the interval parameter
	* @param {Object} name is a string or numeric command(s) to be sent to Reaper regularly.
	* @param {number} interval is the number of miliseconds between each send of the command.  Minimum time is whatever the internal ReaperComms minimum was set to in the constructor.
	*/
	wwr_req_recur(name, interval=this.g_wwr_timer_freq)
	{
		name = ReaperComms.stripCmd(name);
		
		//Next we add if only if it isn't in our command and not an empty command.
		if (name != "" && name != ";")
		{
			var found = 0;
			var l = this.g_wwr_req_recur.length;
			for (var i=0; i < l; ++i)
			{
				if (interval == this.g_wwr_req_recur[i][1])
				{
					clearInterval(this.g_wwr_req_recur[i][2])
					name += this.g_wwr_req_recur[i][0];
					this.g_wwr_req_recur[i][0] = name;
					this.g_wwr_req_recur[i][2] = 0;
					found = 1;
					break;
				}
			}
			
			if (!found)
			{
				this.g_wwr_req_recur.push([name, interval, 0]); 
			}
		}
	}
	
	/**
	* This function takes in a command, or series of commands separated by a semicolon, previously registered for regular sending to Reaper and removes it from the recurring communication list.
	* @param {Object} name is a string or numeric command(s) to be sent to be removed.
	*/
	wwr_req_recur_cancel(name) 
	{
		//Let's see if we can find said request
		name = ReaperComms.stripCmd(name);
		if(name != "" && name != ";")
		{
			for (var i=0; i < this.g_wwr_req_recur.length; ++i) 
			{
				//If we can let's get rid of it.
				var cmd = this.g_wwr_req_recur[i][0];
				if (cmd.indexOf(name) != -1) 
				{
					clearInterval(this.g_wwr_req_recur[i][2]);
					cmd = cmd.replace(name, "");
					
					if (cmd != "")
					{
						this.g_wwr_req_recur[i][0] = cmd;
						this.g_wwr_req_recur[i][2] = 0;
					}
					else
						this.g_wwr_req_recur.splice(i,1);
				}
			}
		}
	}
	
	/**
	* This function sends an OSC command Reaper along with a parameter, if given
	*/
	sendOSC(command, param=null)
	{
		if (command != "" && command != null)
		{
			//Encode command
			command = command.toString();
			command = "OSC/" + command;
			
			//Encode parameter
			if (param != null)
				command += encodeURIComponent(":" + param.toString());
			
			//Send
			this.wwr_req(command);
		}
		
	}
	
	/**
	* This function sends a command to undo the last action in Reaper. 
	*/
	undo()
	{
		this.wwr_req(40029);
	}
	
	/**
	* This function sends a command to redo the last action in Reaper. 
	*/
	redo()
	{
		this.wwr_req(40030);
	}
	
	/**
	* Tells Reaper to toggle the metronome. 
	*/
	toggleMetronome()
	{
		this.wwr_req(40364);
	}
	
	/**
	* Tells Reaper to toggle clip snapping to grid. 
	*/
	toggleSnap()
	{
		this.wwr_req(1157);
	}
	
	/**
	* Tells Reaper to start recording. 
	*/
	startRecord()
	{
		this.wwr_req(1013)
	}
	
	/**
	* Tells Reaper to stop recording and delete all the clips it just created. 
	*/
	stopRecordAndDiscardClips()
	{
		this.wwr_req(40668);
	}
	
	/**
	* Tells Reaper to play from whatever position it's at. 
	*/
	play()
	{
		this.wwr_req(1007);
	}
	
	/**
	* Tells Reaper to stop playback. 
	*/
	stop()
	{
		this.wwr_req(40667);
	}
	
	/**
	* Tells Reaper to pause playback. 
	*/
	pause()
	{
		this.wwr_req(1008);
	}
	
	setTempo(bpm)
	{
		if (bpm <= 0)
			throw "BPM must be positive"
		
		this.sendOSC("tempo/raw", bpm);
	}
	
	/**
	* Tells Reaper to repeat playback in some selected area. 
	*/
	togglePlaybackRepeat()
	{
		this.wwr_req(1068);
	}
	
	/**
	* Tells Reaper to jump to a specific playback location.
	* @param {string} pos is a position string, most easy if just a minute:second time string.
	*/
	jumpToPlaybackPos(pos)
	{
		this.wwr_req("SET/POS_STR/" + encodeURIComponent(pos));
	}
	
	/**
	* Tells Reaper to move the current playback position to the previous marker. 
	*/
	jumpToPrevMarker()
	{
		this.wwr_req(40172);
	}
	
	/**
	* Tells Reaper to move the current playback position to the next marker. 
	*/
	jumpToNextMarker()
	{
		this.wwr_req(40173);
	}

	/**
	* Tells Reaper to move the current playback position to the next recorded item. 
	*/	
	jumpToPrevClip()
	{
		this.wwr_req(40416);
	}

	/**
	* Tells Reaper to move the current playback position to the previous recorded item. 
	*/	
	jumpToNextClip()
	{
		this.wwr_req(40417);
	}
	
	/**
	* Tells Reaper to move the current playback position to the very beggining of the project. 
	*/
	jumpToStartOfProject()
	{
		this.wwr_req(40042);
	}
	
	/**
	* Tells Reaper to move the current playback position to the very end of the project. 
	*/
	jumpToEndOfProject()
	{
		this.wwr_req(40043);
	}
	
	/**
	* Tells Reaper to create a marker at the current playback position. 
	*/
	createMarkerAtPlaybackPos()
	{
		this.wwr_req(40157);
	}
	
	/**
	* Tells Reaper to remane a track.
	* @param {number} trackID is the track number that is to be renamed.
	* @param {string} name is the new track name.
	*/
	setTrackName(trackID, name)
	{
		this.wwr_req("SET/TRACK/" + trackID + "/P_NAME/" + name + ";")
	}
	
	/**
	* Tells Reaper to set a new volume of a track.
	* @param {number} trackID is the track number whole volume is to be changed.
	* @param {string} vol is the new track volume.  0=-inf dB, 1=0 dB.
	*/
	setTrackVol(trackID, vol)
	{
		this.wwr_req("SET/TRACK/" + trackID + "/VOL/" + vol + ";");
	}
	
	/**
	* Tells Reaper to select/deselect a track.
	* @param {number} trackID is the track number that is to be selected/deselected.
	* @param {number} state is the new selection status.  See ReaperComms.onoff for possible values.
	*/
	setTrackSelected(trackID, state)
	{
		this.wwr_req("SET/TRACK/" + trackID + "/SEL/" + state + ";")
	}
	
	/**
	* Tells Reaper to mute/unmute a track.
	* @param {number} trackID is the track number that is to be mute/unmute.
	* @param {number} state is the new mute/unmute status.  See ReaperComms.onoff for possible values.
	*/
	setTrackMute(trackID, state)
	{
		this.wwr_req("SET/TRACK/" + trackID + "/MUTE/" + state + ";");
	}
	
	/**
	* Tells Reaper to solo/unsolo a track.
	* @param {number} trackID is the track number that is to be solo/unsolo.
	* @param {number} state is the new solo/unsolo status.  See ReaperComms.onoff for possible values.
	*/
	setTrackSolo(trackID, state)
	{
		this.wwr_req("SET/TRACK/" + trackID + "/SOLO/" + state + ";");
	}
	
	/**
	* Tells Reaper to arm/disarm a track.
	* @param {number} trackID is the track number that is to be armed/disarmed.
	* @param {number} state is the new armed/disarmed status.  See ReaperComms.onoff for possible values.
	*/
	setTrackRecArm(trackID, state)
	{
		this.wwr_req("SET/TRACK/" + trackID + "/RECARM/" + state + ";");
	}
	
	/**
	* Tells Reaper to update the record monitor behaivor of a channel.
	* @param {number} trackID is the track number that is to be updated.
	* @param {number} state is the new state.  See ReaperComms.recMonOnOff for possible values.
	*/
	setTrackRecordMonitor(trackID, state)
	{
		this.wwr_req("SET/TRACK/" + trackID + "/RECMON/" + state + ";");
	}
	
	/**
	* Tells Reaper to update the hardare input of a channel.
	* @param {number} trackID is the track number that is to be updated.
	* @param {number} hardwareID is the new hardware ID. A value of <0 disables the hardware input.
	*/
	setTrackHardwareInput(trackID, hardwareID)
	{
		this.wwr_req("SET/TRACK/" + trackID + "/I_RECINPUT/" + hardwareID + ";");
	}
	
	/**
	* Tells Reaper to update the input of a channel to a ReaRoute channel.
	* @param {number} trackID is the track number that is to be updated.
	* @param {number} hardwareID is the new route ID.
	*/
	setTrackReaRouteInput(trackID, routeID)
	{
		this.setTrackHardwareInput(trackID, routeID+512);
	}
	
	/**
	* Tells Reaper to add a new track to the project.
	*/
	addTrack()
	{
		this.wwr_req(40702);
	}
	
	/**
	* Tells Reaper to delete a track from the project.
	* @param {number} trackID is the track number that is to be deleted.
	*/
	deleteTrack(trackID)
	{
		// if (trackID < 1)
			// throw "Invalid track selection";
		
		// //First we select the track we want to delete
		// var cmd = 40938 + trackID;
		// this.wwr_req(cmd);
		
		// //Then we delete it.
		// this.wwr_req(40697);
		
		this.wwr_req("SET/TRACK/" + trackID + "/DELETE_TRACK;");
	}
	
	/**
	* Tells Reaper to mute/unmute a send.
	* @param {number} trackID is the track number that is to be mute/unmute.
	* @param {number} sendID is the send number of said track that is to be mute/unmute.
	* @param {number} state is the new mute/unmute status.  See ReaperComms.onoff for possible values.
	*/
	setSendMute(trackID, sendID, state)
	{
		this.wwr_req("SET/TRACK/" + trackID + "/SEND/" + sendID + "/MUTE/" + state + ";");
	}
	
	/**
	* Tells Reaper to set a new volume of a send.
	* @param {number} trackID is the track number whole volume is to be changed.
	* @param {number} sendID is the send number of the track whole volume is to be changed.
	* @param {string} vol is the new track Reaper volume.  0=-inf dB, 1=0 dB.
	*/
	setSendVol(trackID, sendID, vol)
	{
		this.wwr_req("SET/TRACK/" + trackID + "/SEND/" + sendID + "/VOL/" + vol + ";");
	}
	
	/**
	* Static function.  Cleans up a command being sent to Reaper and appends a semicolon if one has not been appended.
	*/
	static stripCmd(cmd)
	{
		if ((typeof cmd) != "string")
			cmd = cmd.toString();

		//First let's clean up the command.
		var l;
		cmd = cmd.replace(/\s+/g,'');
		cmd = cmd.replace(/;{2,}/g,';');
		
		//Next let's make sure the command is properly terminated.
		l = cmd.length;
		if (l > 0 && cmd[l-1] != ';')
			cmd += ";";
		
		//Return the result.
		return cmd;
	}
	
	/**
	* Static function.  Converts a raw Reaper volume to a human-readible string.
	*/
	static mkvolstr(vol) 
	{
		var v = parseFloat(vol);
		if (v < 0.00000002980232) 
			return "-inf dB";
		v = Math.log(v)*8.68588963806;
		return v.toFixed(2) + " dB";
	}

	/**
	* Static function.  Converts a raw Reaper pan to a human-readible string.
	*/
	static mkpanstr(pan) 
	{
		if (Math.abs(pan) < 0.001) 
			return "center";
		if (pan > 0) 
			return (pan*100).toFixed(0) + "%R";

		return (pan*-100).toFixed(0) + "%L";
	}

	static simple_unescape(v) 
	{
		return String(v).replace(/\\t/g,"\t").replace(/\\n/g,"\n").replace(/\\\\/g,"\\");
	}
	
	static trackCmd()
	{
		return "TRACK";
	}
	
	static transportCmd()
	{
		return "TRANSPORT";
	}
	
	static beatPosCmd()
	{
		return "BEATPOS";
	}
	
	static numTracksCmd()
	{
		return "NTRACK";
	}
	
	static markerCmd()
	{
		return "MARKER";
	}
	
	static regionCmd()
	{
		return "REGION";
	}
	
	/**
	* Static enum.  Contains values for most control operation:  ON, OFF, and TOGGLE.
	*/
	static onoff = 
	{
		ON: 1,
		OFF: 0,
		TOGGLE: -1
	}
	
	/**
	* Static enum.  Contains values for record monitor operation:  AUTO, ON, OFF, and TOGGLE.
	*/
	static recMonOnOff = 
	{
		AUTO: 2,
		ON: 1,
		OFF: 0,
		TOGGLE: -1
	}
	
	/*  Private Methods  */
	wwr_run_update()
	{
		if (this.running && this.udpateRecieved)
		{
			var str = "";
			var time = Date.now();
			
			if (this.g_wwr_req_list != "")
				str = this.g_wwr_req_list;
			
			for (var x=0; x<this.g_wwr_req_recur.length; x++)
			{
				if (this.g_wwr_req_recur[x][2]+this.g_wwr_req_recur[x][1] <= time)
				{
					str += this.g_wwr_req_recur[x][0];
					this.g_wwr_req_recur[x][2] = time;
				}
			}
			
			if (str != "")
			{
				this.g_wwr_req.open("GET","/_/" + str, true);
				this.udpateRecieved = 0;
				this.g_wwr_req.send(null);
				this.g_wwr_req_list = "";
			}
		}
	}
	
	//Called whenever there's an update from Reaper.
	handleResponse()
	{
		if (this.g_wwr_req.readyState==4) 
		{
			this.udpateRecieved = 1;
			if (this.g_wwr_req.responseText != "") 
			{
				this.commandCollection.parseCommands(this.g_wwr_req.responseText);
				this.observers.notifyListeners(this.immCommandCollection);
				this.updateReceived = 1;
			}
        }
    }
    
	parseString(response)
	{
		var ar = response.split("\n");
		var tokens = [];
		
		for (var x=0;x<ar.length; x++)
		{
			//Each command is separated by the parameters with a tab character.
			//Lets parse that and execute each command.
			tokens.push(ar[x].split("\t"));
		}
		
		return tokens;
	}
};

/**
* This class takes in command strings from Reaper, parses them, and stores them.
*/
class CommandCollection
{
	commands;
	numCommands=0;
	cmdSize=50;
	
	/**
	* @param {number} initial array length.  Default length is 250.
	*/
	constructor(initLength=250)
	{
		if (initLength < 0)
			throw "Length cannot be less than 0";
		
		this.commands = [];
		for (var x=0; x < initLength; x++)
			this.commands.push(new Array(this.cmdSize));
	}
	
	/**
	* Parses and stores a command string from Reaper.
	* @param {string} a raw string recieved from Reaper.
	*/
	parseCommands(cmdsStr)
	{
		this.numCommands=0;
		var loc=0;
		
		while (true)
		{
			loc=cmdsStr.indexOf("\n",loc);
			if (loc > 0)
			{
				loc++;
				this.numCommands++;
			}
			else
				break;
		}
		
		if (this.numCommands < this.numCommands+100)
			while (this.commands.length < this.numCommands+100)
				this.commands.push(new Array(this.cmdSize));
		
		var cmdLen = cmdsStr.length;
		var lastStopPos=-1;
		var cmdNum=0;
		var paramNum=0;
		for (var x=0;x<cmdLen; x++)
		{
			if (cmdsStr[x] == "\t")
			{
				this.commands[cmdNum][paramNum] = cmdsStr.substring(lastStopPos+1,x);
				paramNum++;
				lastStopPos=x;
			}
			else if (cmdsStr[x] == "\n")
			{
				this.commands[cmdNum][paramNum] = cmdsStr.substring(lastStopPos+1,x);
				cmdNum++;
				paramNum=0;
				lastStopPos=x;
			}
		}
	}
	
	/**
	* Returns the current number of commands stored in the object.
	*/
	get length()
	{
		return this.numCommands;
	}
	
	/**
	* Returns a command array stored in the object.
	* @param {number} the command number to get.
	*/
	cmd(cmdNum)
	{
		if (cmdNum >=this.numCommands)
			throw "Request out of bounds";
		
		return this.commands[cmdNum];
	}
};

/**
* This object stores and has the same interface as a CommandCollection object.  The only difference is it does not allow a new command string to be fed into it to keep it static.
*/
class ImmutableCommandCollection extends CommandCollection
{
	commandsCollection;
	
	/**
	* @param {CommandsCollection} a reference to a command collection object.
	*/
	constructor(commandsCollection)
	{
		if (!(commandsCollection instanceof CommandCollection))
			throw "commandsCollection parameter must be a CommandCollection object";
		
		super(0);
		this.commandsCollection = commandsCollection;
	}
	
	/**
	* Throws an exception if executed.
	* @param {string} is a raw string returned from Reaper.
	*/
	parseCommands(cmdsStr)
	{
		throw "Unable to parse commands in immutable version of CommandCollection";
	}
	
	/**
	* Returns the length of the embedded command collection object.
	*/
	get length()
	{
		return this.commandsCollection.length;
	}
	
	/**
	* Returns a command array stored in the object.
	* @param {number} the command number to get.
	*/
	cmd(cmdNum)
	{
		return this.commandsCollection.cmd(cmdNum);
	}
};
