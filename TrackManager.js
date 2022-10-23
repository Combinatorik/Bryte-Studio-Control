'use strict';
/**
* Singleon object.  The TrackManager object creates and manages tracks.  It registers with ReaperComms as a listener and automatically updates whenever called by Reaper, so it is a self-initializing and updating object.
*/
class TrackManager
{
	//Internal configuration
	trackCount=0;
	tracks;
	immutableTracks;
	observers;
	
	//DOM object references.
	allTracksDiv;
	
	static instance;
	
	/**
	* @param {number} refreshRate is the time in MS that the track manager requests tracks be updated from Reaper.
	*/
	constructor(refreshRate=100, useMasterTrack=1)
	{
		if (!TrackManager.instance)
		{
			TrackManager.instance = this;
			this.allTracksDiv = document.getElementById("tracks");
			this.tracks = [];
			this.immutableTracks = [];
			if (!this.allTracksDiv)
				throw "Could not find track storage div";
			
			//Build object.
			this.observers = new Observable();
			
			if (useMasterTrack != 0)
			{
				var transport = new Transport(this, refreshRate);
				var recArmCounter = transport.recArmCounter;
				var masterTrack = new MasterTrack(recArmCounter);
				var mdiv = document.getElementById("Track 0");
				this.tracks.push(masterTrack);
			}
			
			//Register as listener to ReaperComms.
			var comms = new ReaperComms();
			comms.wwr_req_recur(ReaperComms.trackCmd(), refreshRate);
			comms.registerListener((toks) => {this.updateTracks(toks);});
		}
		
		return TrackManager.instance;
	}
	
	/**
	* This function takes in a function, registers it as a listener, and invokes it whenever this object's internal state is updated.
	* @param {Object} listener is a function that is invoked whenever the TrackManager's internal state updates.
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
		this.observers.unregisterListener(listener);
	}
	
	/**
	* This function returns an ImmutableTrack of the track number requested.  Throws an error if the ID is out of bounds.
	* @param {number} id of the track needed.
	* @returns {ImmutableTrack} an immutable track object.
	*/
	getTrackByID(id)
	{
		if (id > this.tracks.length)
			throw "Track ID out of bounds"
		
		return this.tracks[id].immutableTrack;
	}
	
	/**
	* Getter.  This function returns the current active number of tracks.
	*/
	get trackCount()
	{
		return this.trackCount;
	}
	
	/*  Private methods  */
	updateTracks(tokens) 
	{
		//First let's count and update the track count so we don't accidentally try updating a track that doesn't exist.
		//Also let's execute SEND commands, if we're getting a string for one then it's already created and registered with ReaperComms.
		var count = 0;
		var x;
		var cmd;
		for (x=0;x<tokens.length;x++)
		{
			cmd=tokens.cmd(x);
			if (cmd[0] == "TRACK")
				count++;
			else if (cmd[0] == "SEND")
			{
				var trackID = parseInt(cmd[1]);
				this.tracks[trackID].updateSend(cmd);
			}
		}
		
		//There will always be a master track, so let's make sure we have at least one track in the list of updates.
		//If not then we can just quit.
		if (count > 0)
		{
			//Let's update the track count if needbe.
			this.updateTrackCount(count);
		
			//Start execution loop
			for (x=0;x<tokens.length;x++)
			{
				cmd=tokens.cmd(x);
				if (cmd[0] == "TRACK")
				{
					let t = parseInt(cmd[1]);
					this.tracks[t].updateTrack(cmd);
				}
			}
		}
	}
	
	updateTrackCount(count)
	{
		if (count != this.trackCount) 
		{
			//First we need to see if we need to raise the recound rec armed flag.
			var trackDiv;
			
			//Get rid of any exatras we may have.
			if (this.trackCount > count)
			{
				var track;
				for (var t = count; t < this.tracks.length; t++)
				{
					this.tracks[t].disable();
				}
			}
			//Add tracks
			else
			{
				//Let's add as many tracks as we need.
				while (this.tracks.length < count)
				{
					//Create, configure, and store new track
					var newTrack = new Track(this.allTracksDiv, this.tracks.length);
					this.tracks.push(newTrack);
					
					this.trackCount++;
				}
				
				//Some of our tracks might be hidden.  Let's unhide them.
				this.trackCount = count;
				for (var t = 0; t < count; t++)
				{
					//Reset and hide channel
					this.tracks[t].enable();
				}
			}
			
			//Update number of channels.
			this.trackCount = count;
			this.observers.notifyListeners(this);
		}
	}
	
	updateTrack(trackID, tok)
	{
		this.tracks[trackID].updateTrack(tok);
	}
};

