'use strict';

/**
* The SendManager class manages send objects for a track.
*/
class SendManager
{
	//Internal configuration
	parentID;
	sendCount=0;
	sends = [];
	
	//DOM object references.
	sendsDiv;

	/**
	* Constructs a new send manager object.  
	* @param {number} parentID is the parent track's ID number
	* @param {Object} trackDiv is a reference to the parent track Div reference to attach the new send div to the UI
	*/	
	constructor(parentID, trackDiv)
	{
		if (parentID == null)
			throw "Unkonwn parent ID type";
		
		if (trackDiv == null)
			throw "Invalid trackDiv parameter";
		
		this.parentID = parentID;
		this.sendsDiv = trackDiv.getElementsByClassName("SendsDiv")[0];
		
		if (!this.sendsDiv)
			throw "Track sends div not found";
	}
	
	/**
	* Updates the number of sends in a track.  
	* @param {number} count is the new number of sends.
	*/
	updateSendsCount(count)
	{
		if (count != this.sendCount)
		{
			//Let's get the sends div and add/remove sends as needed.
			var trackSendsContent;
			var send;
			
			//Add sends if need be.
			if (this.sendCount < count)
			{
				//Add channels if needbe.
				while (this.sends.length < count)
				{
					//Build div
					send = new Send(this.parentID, this.sends.length, this.sendsDiv);
					
					//Attach it to the parent
					this.sends.push(send);
				}
				
				//Then show as many channels as we need to display.
				for (var x=0; x < count; x++)
					this.sends[x].enable();
				
				this.sendCount = count;
			}
			else
			{
				//Remove sends if need be.
				while(this.sendCount > count)
				{
					this.sends[this.sendCount-1].disable();
					this.sendCount--;
				}
			}
		}
	}

	/**
	* Updates a track given a tokenized string from Reaper.
	* @param {Object} tok is a tokenized Send update string from Reaper
	*/
	updateSend(tok)
	{
		var sendID = parseInt(tok[2]);
		this.sends[sendID].updateSend(tok);
	}

	/**
	* Getter.  Returns the number of sends in the track.
	*/
	get sendCount()
	{
		return this.sendCount;
	}
};

