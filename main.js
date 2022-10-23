'use strict';

/************ Global Variables ************/
//GUI objects
var controller;

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
	controller = new ReaperController(60);
}