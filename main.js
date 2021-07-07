'use strict';

/************ Global Variables ************/
//GUI objects
var comms;
var tlist;
var optionsBar;
var transport;

/************ Main Code ************/
function init()
{
	//Set up touch OS stuff.
	if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream) 
	{
		for (let l = 0; l < document.styleSheets.length; l ++) 
		{
			let ss = document.styleSheets[l];
			if (ss.cssRules) 
			for (let i=0; i < ss.cssRules.length; i++)
			{
				let st = ss.cssRules[i].selectorText;
				if (st != undefined && st.startsWith(".button")) 
					ss.removeRule(i--);
			}
		}
	}
	
	//Init GUI objects
	//Set max FPS to 60.
	var rtime = 1000/60;
	comms = new ReaperComms(rtime);
	tlist = new TrackManager(rtime);          //Auto-registers with ReaperComms as a listener
	optionsBar = new OptionsBar(rtime);       //Auto-registers with ReaperComms as a listener
	transport = new Transport(tlist, rtime);  //Auto-registers with ReaperComms as a listener	
	
	//run reaper comms
	comms.startComms(); 
}